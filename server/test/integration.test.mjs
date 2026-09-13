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
    await store.setAccount('admin', 'admin-password', 'admin');
    await store.setAccount('editor', 'old-editor-password', 'editor');
    await store.setAccount('second-editor', 'second-editor-password', 'editor');
    await store.setAccount('reader', 'reader-password', 'reader');

    const firstPayload = payload(0x11);
    const secondPayload = payload(0x22);
    const first = await store.write(0, firstPayload, 'admin');
    const second = await store.write(0, secondPayload, 'second-editor');
    assert.deepEqual(first, { revision: 1 });
    assert.equal(second, null);
    const winningPayload = firstPayload;
    const winningUser = 'admin';
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
    const incompatibleLogin = await http(app.url, '/v2/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin-password', deviceId: randomUUID() }),
    });
    assert.equal(incompatibleLogin.response.status, 409);
    const preservedSnapshot = await store.read();
    assert.equal(preservedSnapshot.revision, 1);
    assert.ok(preservedSnapshot.payload.equals(winningPayload));
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

test('Postgres v2 sync keeps per-record CAS, atomic batches, receipts, tombstones, and instance fences', { skip: skipReason }, async () => {
  if (!dockerReady) throw new Error('Docker daemon is unavailable.');
  const container = await startPostgres();
  let store;
  let app;
  const employee = (id, name, note = null) => ({
    id, name, note, weeklyHours: null, fte: null, createdAt: '2026-01-01 00:00:00', birthDate: null, department: null,
  });
  const transaction = (id, instanceId, changes, initialize = false) => ({ id, instanceId, initialize, changes });
  try {
    store = await openStore(container.connectionString);
    await store.setAccount('editor', 'editor-password-v2', 'editor');
    await store.setAccount('admin', 'admin-password-v2', 'admin');
    await store.setAccount('reader', 'reader-password-v2', 'reader');
    app = await startHttp(store);

    const login = async (username, password, deviceId) => http(app.url, '/v2/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, deviceId }),
    });
    const first = await login('editor', 'editor-password-v2', randomUUID());
    assert.equal(first.response.status, 200);
    assert.equal(first.body.protocol, 2);
    assert.equal(first.body.deviceSlot, 1);
    assert.equal(first.body.revision, 0);
    const second = await login('editor', 'editor-password-v2', randomUUID());
    assert.equal(second.response.status, 200);
    assert.equal(second.body.deviceSlot, 2);
    const admin = await login('admin', 'admin-password-v2', randomUUID());
    assert.equal(admin.response.status, 200);
    assert.equal(admin.body.role, 'admin');
    assert.equal(admin.body.deviceSlot, 3);
    const instance = first.body.instanceId;
    const headers = (session) => ({ Authorization: `Bearer ${session.body.token}`, 'Content-Type': 'application/json' });

    const base = [employee(1, 'Alpha'), employee(2, 'Beta')];
    const initialBody = transaction(randomUUID(), instance, base.map((row) => ({
      table: 'employees', key: JSON.stringify([row.id]), before: null, after: row,
    })), true);
    const editorBootstrap = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(initialBody) });
    assert.equal(editorBootstrap.response.status, 403);
    const afterEditorBootstrap = await http(app.url, '/v2/changes?since=0', { headers: { Authorization: `Bearer ${first.body.token}` } });
    assert.equal(afterEditorBootstrap.response.status, 200);
    assert.equal(afterEditorBootstrap.body.initialized, false);
    assert.equal(afterEditorBootstrap.body.cursor, 0);
    assert.deepEqual(afterEditorBootstrap.body.changes, []);
    const initialized = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(admin), body: JSON.stringify(initialBody) });
    assert.equal(initialized.response.status, 200);
    assert.deepEqual(initialized.body, { cursor: 1 });

    const initialChanges = await http(app.url, '/v2/changes?since=0', { headers: { Authorization: `Bearer ${second.body.token}` } });
    assert.equal(initialChanges.response.status, 200);
    assert.equal(initialChanges.body.initialized, true);
    assert.equal(initialChanges.body.cursor, 1);
    assert.equal(initialChanges.body.changes.length, 2);

    // Two clients with the same stale cursor may edit unrelated rows.
    const editOne = transaction(randomUUID(), instance, [{
      table: 'employees', key: '[1]', before: employee(1, 'Alpha'), after: employee(1, 'Alpha', 'A'),
    }]);
    const editTwo = transaction(randomUUID(), instance, [{
      table: 'employees', key: '[2]', before: employee(2, 'Beta'), after: employee(2, 'Beta', 'B'),
    }]);
    const [one, two] = await Promise.all([
      http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(editOne) }),
      http(app.url, '/v2/transactions', { method: 'POST', headers: headers(second), body: JSON.stringify(editTwo) }),
    ]);
    assert.equal(one.response.status, 200);
    assert.equal(two.response.status, 200);
    assert.deepEqual([one.body.cursor, two.body.cursor].sort((a, b) => a - b), [2, 3]);
    const firstPage = await http(app.url, '/v2/changes?since=1&limit=1', { headers: { Authorization: `Bearer ${first.body.token}` } });
    assert.equal(firstPage.response.status, 200);
    assert.equal(firstPage.body.cursor, 2);
    assert.equal(firstPage.body.hasMore, true);
    const secondPage = await http(app.url, '/v2/changes?since=2&limit=1', { headers: { Authorization: `Bearer ${first.body.token}` } });
    assert.equal(secondPage.body.cursor, 3);
    assert.equal(secondPage.body.hasMore, false);

    const sameRowConflict = transaction(randomUUID(), instance, [{
      table: 'employees', key: '[1]', before: employee(1, 'Alpha'), after: employee(1, 'Alpha', 'stale'),
    }]);
    const conflict = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(second), body: JSON.stringify(sameRowConflict) });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.conflict.table, 'employees');

    // One bad CAS in a multi-row batch leaves the good row untouched.
    const atomic = transaction(randomUUID(), instance, [
      { table: 'employees', key: '[1]', before: employee(1, 'Alpha', 'A'), after: employee(1, 'Alpha', 'atomic') },
      { table: 'employees', key: '[2]', before: employee(2, 'Beta'), after: employee(2, 'Beta', 'should-not-commit') },
    ]);
    const atomicResult = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(atomic) });
    assert.equal(atomicResult.response.status, 409);
    const afterAtomic = await http(app.url, '/v2/changes?since=3', { headers: { Authorization: `Bearer ${first.body.token}` } });
    assert.equal(afterAtomic.body.changes.length, 0);

    // UUID receipts make retries safe and reject body reuse.
    const retryBody = transaction(randomUUID(), instance, [{
      table: 'employees', key: '[1]', before: employee(1, 'Alpha', 'A'), after: employee(1, 'Alpha', 'retry'),
    }]);
    const sent = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(retryBody) });
    const retried = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(retryBody) });
    assert.equal(sent.response.status, 200);
    assert.deepEqual(retried.body, sent.body);
    const reused = { ...retryBody, changes: [{ ...retryBody.changes[0], after: employee(1, 'Alpha', 'different') }] };
    const reusedResult = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(reused) });
    assert.equal(reusedResult.response.status, 409);

    const reader = await login('reader', 'reader-password-v2', randomUUID());
    const readerResult = await http(app.url, '/v2/transactions', {
      method: 'POST', headers: headers(reader), body: JSON.stringify(transaction(randomUUID(), instance, [{
        table: 'employees', key: '[1]', before: employee(1, 'Alpha', 'retry'), after: employee(1, 'Alpha', 'reader'),
      }])),
    });
    assert.equal(readerResult.response.status, 403);
    await store.disableAccount('reader');
    const revoked = await http(app.url, '/v2/changes?since=0', { headers: { Authorization: `Bearer ${reader.body.token}` } });
    assert.equal(revoked.response.status, 401);

    const invalidForeignKey = transaction(randomUUID(), instance, [{
      table: 'employment_periods', key: '[99]', before: null,
      after: { id: 99, employeeId: 404, startDate: '2026-01-01', endDate: null, qualification: null, note: null },
    }]);
    const invalidResult = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(invalidForeignKey) });
    assert.equal(invalidResult.response.status, 422);

    const deleteBody = transaction(randomUUID(), instance, [{
      table: 'employees', key: '[2]', before: employee(2, 'Beta', 'B'), after: null,
    }]);
    const deleted = await http(app.url, '/v2/transactions', { method: 'POST', headers: headers(first), body: JSON.stringify(deleteBody) });
    assert.equal(deleted.response.status, 200);
    const tombstone = await http(app.url, `/v2/changes?since=${deleted.body.cursor - 1}`, { headers: { Authorization: `Bearer ${first.body.token}` } });
    assert.equal(tombstone.body.changes.at(-1).row, null);

    // Changing the instance fences old sessions and leaves the records intact.
    const fencePool = new pg.Pool({ connectionString: container.connectionString, max: 1 });
    const nextInstance = randomUUID();
    try { await fencePool.query('UPDATE workspace SET instance_id=$1', [nextInstance]); } finally { await fencePool.end(); }
    const fenced = await http(app.url, '/v2/changes?since=0', { headers: { Authorization: `Bearer ${first.body.token}` } });
    assert.equal(fenced.response.status, 409);
    assert.equal(fenced.body.instanceId, nextInstance);
    const newLogin = await login('editor', 'editor-password-v2', randomUUID());
    assert.equal(newLogin.response.status, 200);
    assert.equal(newLogin.body.instanceId, nextInstance);
    const persisted = await http(app.url, `/v2/changes?since=${deleted.body.cursor}`, { headers: { Authorization: `Bearer ${newLogin.body.token}` } });
    assert.equal(persisted.response.status, 200);
    assert.equal(persisted.body.changes.length, 0);
  } finally {
    if (app) await stopHttp(app.server).catch(() => undefined);
    if (store) await store.close().catch(() => undefined);
    await docker(['rm', '--force', container.name]).catch(() => undefined);
  }
});
