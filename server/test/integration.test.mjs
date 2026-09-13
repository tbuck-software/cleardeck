import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '../src/http.mjs';
import { openStore } from '../src/store.mjs';

const exec = promisify(execFile);
const integrationEnabled = process.env.RUN_SERVER_INTEGRATION === '1';
const dockerReady = integrationEnabled && spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const skipReason = !integrationEnabled ? 'Postgres integration is opt-in: RUN_SERVER_INTEGRATION=1' : false;
const header = Buffer.from(`CLEARDECK-BACKUP-1:${'b'.repeat(64)}\n`);
const payload = (fill) => Buffer.concat([header, Buffer.alloc(256, fill)]);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function docker(args) {
  return (await exec('docker', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 })).stdout.trim();
}

async function startPostgres() {
  const name = `cleardeck-test-${process.pid}-${randomUUID().slice(0, 8)}`;
  const db = `cleardeck_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const user = 'cleardeck_test';
  const password = 'test-password-only';
  await docker([
    'run', '--detach', '--rm', '--name', name,
    '--env', `POSTGRES_DB=${db}`,
    '--env', `POSTGRES_USER=${user}`,
    '--env', `POSTGRES_PASSWORD=${password}`,
    '--publish', '127.0.0.1::5432',
    process.env.POSTGRES_TEST_IMAGE ?? 'postgres:16-alpine',
  ]);
  try {
    const published = await docker(['port', name, '5432/tcp']);
    const port = Number(published.match(/:(\d+)\s*$/m)?.[1]);
    if (!Number.isInteger(port) || port < 1) throw new Error(`Could not determine mapped Postgres port: ${published}`);
    const connectionString = `postgresql://${user}:${password}@127.0.0.1:${port}/${db}`;
    const probe = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 1000 });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
          await probe.query('SELECT 1');
          ready = true;
          break;
        } catch {
          await sleep(500);
        }
      }
      if (!ready) throw new Error('Postgres did not become ready within 30 seconds.');
    } finally {
      await probe.end();
    }
    return { name, connectionString };
  } catch (error) {
    await docker(['rm', '--force', name]).catch(() => undefined);
    throw error;
  }
}

async function startHttp(store) {
  const server = createApp(store);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function stopHttp(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function http(url, route, options = {}) {
  const response = await fetch(`${url}${route}`, options);
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type') ?? '';
  return {
    response,
    bytes,
    body: type.includes('application/json') && bytes.length ? JSON.parse(bytes.toString()) : bytes,
  };
}

test('Postgres store persists encrypted snapshots, revokes sessions, and enforces CAS', { skip: skipReason }, async () => {
  if (!dockerReady) throw new Error('Docker daemon is unavailable.');
  const container = await startPostgres();
  let store;
  let app;
  try {
    store = await openStore(container.connectionString);
    await store.setAccount('editor', 'old-editor-password', 'editor');
    await store.setAccount('second-editor', 'second-editor-password', 'editor');
    await store.setAccount('reader', 'reader-password', 'reader');

    const firstPayload = payload(0x11);
    const secondPayload = payload(0x22);
    const [first, second] = await Promise.all([
      store.write(0, firstPayload, 'editor'),
      store.write(0, secondPayload, 'second-editor'),
    ]);
    assert.equal([first, second].filter((result) => result?.revision === 1).length, 1);
    assert.equal([first, second].filter((result) => result === null).length, 1);
    const winningPayload = first?.revision === 1 ? firstPayload : secondPayload;
    const winningUser = first?.revision === 1 ? 'editor' : 'second-editor';
    const initial = await store.read();
    assert.equal(initial.revision, 1);
    assert.ok(initial.payload.equals(winningPayload));

    await store.close();
    store = await openStore(container.connectionString);
    const persisted = await store.read();
    assert.equal(persisted.revision, 1);
    assert.ok(persisted.payload.equals(winningPayload));

    await store.setAccount('disabled-user', 'disabled-user-password', 'reader');
    const disabledSession = await store.login('disabled-user', 'disabled-user-password');
    assert.ok(disabledSession);
    assert.equal(await store.disableAccount('disabled-user'), true);
    assert.equal(await store.authenticate(disabledSession.token), null);

    app = await startHttp(store);
    const oldLogin = await http(app.url, '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'editor', password: 'old-editor-password' }),
    });
    assert.equal(oldLogin.response.status, 200);
    const oldToken = oldLogin.body.token;

    await store.setAccount('editor', 'new-editor-password', 'editor');
    const revoked = await http(app.url, '/v1/snapshot', {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    assert.equal(revoked.response.status, 401);

    const readerLogin = await http(app.url, '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'reader', password: 'reader-password' }),
    });
    assert.equal(readerLogin.response.status, 200);
    const readerWrite = await http(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${readerLogin.body.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"1"',
        'X-ClearDeck-Instance': persisted.instanceId,
      },
      body: payload(0x33),
    });
    assert.equal(readerWrite.response.status, 403);

    const newLogin = await http(app.url, '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'editor', password: 'new-editor-password' }),
    });
    assert.equal(newLogin.response.status, 200);
    const editorHeaders = {
      Authorization: `Bearer ${newLogin.body.token}`,
      'Content-Type': 'application/octet-stream',
      'If-Match': '"1"',
      'X-ClearDeck-Instance': persisted.instanceId,
    };
    const saved = await http(app.url, '/v1/snapshot', {
      method: 'PUT', headers: editorHeaders, body: payload(0x44),
    });
    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.body, { revision: 2 });

    const changed = await store.read();
    assert.equal(changed.revision, 2);
    assert.ok(changed.payload.equals(payload(0x44)));

    const history = new pg.Pool({ connectionString: container.connectionString, max: 1 });
    try {
      const { rows } = await history.query('SELECT revision, username FROM changes ORDER BY revision');
      assert.deepEqual(rows, [
        { revision: 1, username: winningUser },
        { revision: 2, username: 'editor' },
      ]);
    } finally {
      await history.end();
    }

    const loggedOutToken = newLogin.body.token;
    const currentInstance = (await store.metadata()).instanceId;
    await store.logout(loggedOutToken);
    assert.deepEqual(
      await store.write(2, payload(0x55), 'editor', currentInstance, loggedOutToken),
      { forbidden: true },
    );

    // A physical restore must fence the old instance and sessions before the
    // service is started again. Verify the SQL runbook invariant directly.
    const fenceLogin = await store.login('editor', 'new-editor-password');
    assert.ok(fenceLogin);
    const fencedToken = fenceLogin.token;
    const oldInstance = (await store.metadata()).instanceId;
    const fence = new pg.Pool({ connectionString: container.connectionString, max: 1 });
    const fencedInstance = randomUUID();
    try {
      await fence.query('BEGIN');
      await fence.query('DELETE FROM sessions');
      await fence.query('UPDATE workspace SET instance_id=$1', [fencedInstance]);
      await fence.query('COMMIT');
    } finally {
      await fence.end();
    }
    assert.notEqual(oldInstance, (await store.metadata()).instanceId);
    assert.equal((await store.metadata()).instanceId, fencedInstance);
    assert.equal(await store.authenticate(fencedToken), null);
    assert.equal(await store.write(2, payload(0x55), 'editor', oldInstance), null);
    const afterRejectedRestoreWrite = await store.read();
    assert.equal(afterRejectedRestoreWrite.revision, 2);
    assert.ok(afterRejectedRestoreWrite.payload.equals(payload(0x44)));
    const replay = await http(app.url, '/v1/snapshot', {
      headers: { Authorization: `Bearer ${fencedToken}` },
    });
    assert.equal(replay.response.status, 401);
  } finally {
    if (app) await stopHttp(app.server).catch(() => undefined);
    if (store) await store.close().catch(() => undefined);
    await docker(['rm', '--force', container.name]).catch(() => undefined);
  }
});
