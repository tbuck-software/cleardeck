import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { createApp } from '../src/http.mjs';

const SNAPSHOT_LIMIT = 32 * 1024 * 1024;
const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const encryptedPayload = (size = 128) => {
  const header = Buffer.from(`CLEARDECK-BACKUP-1:${'a'.repeat(64)}\n`);
  return Buffer.concat([header, randomBytes(Math.max(0, size - header.length))]);
};

function fakeStore() {
  const accounts = new Map([
    ['editor', { password: 'editor-password', role: 'editor', enabled: true }],
    ['reader', { password: 'reader-password', role: 'reader', enabled: true }],
  ]);
  const sessions = new Map();
  let nextToken = 0;
  let revision = 0;
  let payload = null;

  const metadata = () => ({ instanceId: INSTANCE_ID, revision });
  return {
    async login(username, password) {
      const account = accounts.get(username);
      if (!account?.enabled || account.password !== password) return null;
      const token = `${Buffer.from(`token-${++nextToken}`).toString('base64url')}AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
      const exactToken = token.slice(0, 43);
      sessions.set(exactToken, username);
      return { token: exactToken, role: account.role, ...metadata() };
    },
    async authenticate(token) {
      const username = sessions.get(token);
      const account = username && accounts.get(username);
      return account?.enabled ? { username, role: account.role } : null;
    },
    async logout(token) { sessions.delete(token); },
    metadata,
    async read() { return { ...metadata(), payload }; },
    async write(expectedRevision, nextPayload, username) {
      const account = accounts.get(username);
      if (!account?.enabled || account.role !== 'editor') return { forbidden: true };
      if (expectedRevision !== revision) return null;
      payload = Buffer.from(nextPayload);
      revision += 1;
      return { revision };
    },
    async disable(username) {
      const account = accounts.get(username);
      if (account) account.enabled = false;
    },
  };
}

async function start(store = fakeStore()) {
  const server = createApp(store);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    server,
    store,
    url: `http://127.0.0.1:${port}`,
  };
}

async function stop(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function request(url, route, options = {}) {
  const response = await fetch(`${url}${route}`, options);
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type') ?? '';
  let body = bytes;
  if (type.includes('application/json') && bytes.length) body = JSON.parse(bytes.toString());
  return { response, bytes, body };
}

async function login(url, username = 'editor', password = `${username}-password`) {
  const result = await request(url, '/v1/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(result.response.status, 200);
  return result.body;
}

test('health is public and browser requests are refused', async () => {
  const app = await start();
  try {
    const health = await request(app.url, '/health');
    assert.equal(health.response.status, 200);
    assert.deepEqual(health.body, { ok: true });

    const browser = await request(app.url, '/health', { headers: { Origin: 'https://example.test' } });
    assert.equal(browser.response.status, 403);
  } finally {
    await stop(app.server);
  }
});

test('malformed and oversized login bodies return bounded errors', async () => {
  const app = await start();
  try {
    const malformed = await request(app.url, '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.response.status, 400);

    const oversized = await request(app.url, '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.alloc(8193, 0x20),
    });
    assert.equal(oversized.response.status, 413);
  } finally {
    await stop(app.server);
  }
});

test('repeated failed logins are rate limited per client address', async () => {
  const app = await start();
  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const failed = await request(app.url, '/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'editor', password: 'wrong-password' }),
      });
      assert.equal(failed.response.status, 401);
    }
    const limited = await request(app.url, '/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'editor', password: 'wrong-password' }),
    });
    assert.equal(limited.response.status, 429);
    assert.equal(limited.response.headers.get('retry-after'), '60');
  } finally {
    await stop(app.server);
  }
});

test('login returns protocol metadata and logout revokes the session', async () => {
  const app = await start();
  try {
    const session = await login(app.url);
    assert.equal(session.protocol, 1);
    assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(session.instanceId, INSTANCE_ID);
    assert.equal(session.revision, 0);

    const before = await request(app.url, '/v1/snapshot', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(before.response.status, 204);
    assert.equal(before.response.headers.get('etag'), '"0"');
    assert.equal(before.response.headers.get('x-cleardeck-instance'), INSTANCE_ID);

    const head = await request(app.url, '/v1/snapshot', {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(head.response.status, 204);
    assert.equal(head.bytes.length, 0);

    const loggedOut = await request(app.url, '/v1/session', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(loggedOut.response.status, 200);
    const after = await request(app.url, '/v1/snapshot', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(after.response.status, 401);
  } finally {
    await stop(app.server);
  }
});

test('reader sessions cannot write and editor writes use encrypted protocol headers', async () => {
  const app = await start();
  try {
    const reader = await login(app.url, 'reader');
    const payload = encryptedPayload();
    const readerWrite = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${reader.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: payload,
    });
    assert.equal(readerWrite.response.status, 403);

    const editor = await login(app.url);
    const missingVersion = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${editor.token}`,
        'Content-Type': 'application/octet-stream',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: payload,
    });
    assert.equal(missingVersion.response.status, 428);

    const wrongType = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${editor.token}`,
        'Content-Type': 'application/json',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: payload,
    });
    assert.equal(wrongType.response.status, 415);

    const invalidHeader = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${editor.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: Buffer.alloc(128, 0x42),
    });
    assert.equal(invalidHeader.response.status, 400);

    const wrongInstance = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${editor.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': '22222222-2222-4222-8222-222222222222',
      },
      body: payload,
    });
    assert.equal(wrongInstance.response.status, 409);

    const written = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${editor.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: payload,
    });
    assert.equal(written.response.status, 200);
    assert.deepEqual(written.body, { revision: 1 });

    const read = await request(app.url, '/v1/snapshot', {
      headers: { Authorization: `Bearer ${editor.token}` },
    });
    assert.equal(read.response.status, 200);
    assert.deepEqual(read.bytes, payload);

    const stale = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${editor.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: encryptedPayload(),
    });
    assert.equal(stale.response.status, 409);
  } finally {
    await stop(app.server);
  }
});

test('snapshot bodies above 32 MiB are rejected before storage', async () => {
  const app = await start();
  try {
    const session = await login(app.url);
    const oversized = await request(app.url, '/v1/snapshot', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/octet-stream',
        'If-Match': '"0"',
        'X-ClearDeck-Instance': INSTANCE_ID,
      },
      body: Buffer.alloc(SNAPSHOT_LIMIT + 1, 0x41),
    });
    assert.equal(oversized.response.status, 413);

    const stillEmpty = await request(app.url, '/v1/snapshot', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(stillEmpty.response.status, 204);
  } finally {
    await stop(app.server);
  }
});
