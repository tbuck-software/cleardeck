/// <reference types="vitest/globals" />
// @vitest-environment node

import fs from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

import { randomBytes } from 'node:crypto';
import SqliteAdapter from './sqliteAdapter';

const runtime = vi.hoisted(() => ({ root: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => runtime.root },
}));
vi.mock('better-sqlite3', async () => ({ default: (await import('./sqliteAdapter')).default }));

import {
  closeDb,
  flushDatabase,
  getDb,
  getEncryptedDbPath,
  getWorkingDbPath,
  openDatabase,
  setEncryptionKey,
  setRemoteDatabase,
  setStorageMode,
} from '../database/connection';
import { decodeBackup, encodeBackup } from '../backupFormat';
import {
  connectServer,
  getServerConnection,
  lockServer,
  refreshServer,
  runServerOperation,
  withCurrentConnection,
  withConnectionLock,
  useLocalConnection,
} from '../serverConnection';
import {
  getBaseHours,
  getHiddenEventTypes,
  setBaseHours,
  setHiddenEventTypes,
} from '../repositories/settings';

type FakeStore = {
  username: string;
  password: string;
  role: 'reader' | 'editor';
  instanceId: string;
  revision: number;
  payload: Buffer | null;
  conflictOnPut: boolean;
  requests: { login: number; get: number; head: number; put: number; logout: number };
  lastIfMatch?: string;
};

type FakeServer = {
  store: FakeStore;
  url: string;
  close: () => Promise<void>;
};

const TOKEN = 'T'.repeat(43);
const LOCAL_PASSWORD = 'server-password';

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const sendJson = (response: ServerResponse, status: number, value: unknown): void => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};

const startFakeServer = async (overrides: Partial<FakeStore> = {}): Promise<FakeServer> => {
  const store: FakeStore = {
    username: 'alice',
    password: LOCAL_PASSWORD,
    role: 'editor',
    instanceId: '11111111-1111-4111-8111-111111111111',
    revision: 0,
    payload: null,
    conflictOnPut: false,
    requests: { login: 0, get: 0, head: 0, put: 0, logout: 0 },
    ...overrides,
  };

  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Connection', 'close');
    try {
      if (request.url === '/v1/login' && request.method === 'POST') {
        store.requests.login++;
        const input = JSON.parse((await readRequestBody(request)).toString()) as {
          username?: string;
          password?: string;
        };
        if (input.username !== store.username || input.password !== store.password) {
          sendJson(response, 401, { error: 'Anmeldung fehlgeschlagen.' });
          return;
        }
        sendJson(response, 200, {
          protocol: 1,
          token: TOKEN,
          role: store.role,
          instanceId: store.instanceId,
          revision: store.revision,
        });
        return;
      }

      const authorized = request.headers.authorization === `Bearer ${TOKEN}`;
      if (!authorized) {
        sendJson(response, 401, { error: 'Sitzung abgelaufen.' });
        return;
      }
      if (request.url === '/v1/session' && request.method === 'DELETE') {
        store.requests.logout++;
        sendJson(response, 200, { ok: true });
        return;
      }
      if (request.url !== '/v1/snapshot') {
        sendJson(response, 404, { error: 'Nicht gefunden.' });
        return;
      }

      const snapshotHeaders = {
        ETag: `"${store.revision}"`,
        'X-ClearDeck-Instance': store.instanceId,
      };
      if (request.method === 'HEAD') {
        store.requests.head++;
        response.writeHead(store.revision === 0 ? 204 : 200, snapshotHeaders);
        response.end();
        return;
      }
      if (request.method === 'GET') {
        store.requests.get++;
        if (store.revision === 0 || !store.payload) {
          response.writeHead(204, snapshotHeaders);
          response.end();
        } else {
          response.writeHead(200, {
            ...snapshotHeaders,
            'Content-Type': 'application/octet-stream',
          });
          response.end(store.payload);
        }
        return;
      }
      if (request.method === 'PUT') {
        store.requests.put++;
        store.lastIfMatch = request.headers['if-match'];
        const payload = await readRequestBody(request);
        if (store.conflictOnPut || request.headers['if-match'] !== `"${store.revision}"`) {
          sendJson(response, 409, { error: 'Der Bestand wurde geändert.' });
          return;
        }
        if (request.headers['x-cleardeck-instance'] !== store.instanceId) {
          sendJson(response, 409, { error: 'Die Serverinstanz hat sich geändert.' });
          return;
        }
        store.payload = payload;
        store.revision++;
        sendJson(response, 200, { revision: store.revision });
        return;
      }
      sendJson(response, 405, { error: 'Methode nicht erlaubt.' });
    } catch {
      if (!response.headersSent) sendJson(response, 500, { error: 'Fehler.' });
    }
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fake server did not bind a port.');
  return {
    store,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

const connectInput = (url: string, key: Buffer, initialize = false) => ({
  url,
  username: 'alice',
  password: LOCAL_PASSWORD,
  dataKey: key.toString('base64'),
  initialize,
});

const setLocalBaseHours = (hours: number): void => {
  openDatabase({ create: true });
  setBaseHours(hours);
  setHiddenEventTypes(['local-secret']);
  flushDatabase();
};

const snapshotAtBaseHours = (hours: number, hiddenEventTypes = ['remote-secret']): Buffer => {
  const copy = new SqliteAdapter(getDb().serialize());
  copy.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('baseHours', ?)").run(String(hours));
  copy
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('hiddenEventTypes', ?)")
    .run(JSON.stringify(hiddenEventTypes));
  const bytes = copy.serialize();
  copy.close();
  return bytes;
};

const storeSnapshot = (store: FakeStore, bytes: Buffer, key: Buffer, revision = 1): void => {
  store.payload = encodeBackup(bytes, key);
  store.revision = revision;
};

const readStoredBaseHours = (store: FakeStore, key: Buffer): number => {
  const bytes = decodeBackup(store.payload!, key);
  const copy = new SqliteAdapter(bytes);
  try {
    return Number((copy.prepare("SELECT value FROM settings WHERE key='baseHours'").get() as { value: string }).value);
  } finally {
    copy.close();
  }
};

const readStoredHiddenEventTypes = (store: FakeStore, key: Buffer): string[] => {
  const bytes = decodeBackup(store.payload!, key);
  const copy = new SqliteAdapter(bytes);
  try {
    const value = (copy.prepare("SELECT value FROM settings WHERE key='hiddenEventTypes'").get() as { value?: string } | undefined)?.value;
    return value ? JSON.parse(value) : [];
  } finally {
    copy.close();
  }
};

const readLocalBaseHours = (key: Buffer): number => {
  const bytes = decodeBackup(fs.readFileSync(getEncryptedDbPath()), key);
  const copy = new SqliteAdapter(bytes);
  try {
    return Number((copy.prepare("SELECT value FROM settings WHERE key='baseHours'").get() as { value: string }).value);
  } finally {
    copy.close();
  }
};

describe('server connection with encrypted SQLite snapshots', () => {
  let dataRoot: string;
  let localKey: Buffer;
  const servers: FakeServer[] = [];

  beforeEach(() => {
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-server-connection-'));
    runtime.root = dataRoot;
    localKey = randomBytes(32);
    setRemoteDatabase(false);
    setStorageMode('encrypted');
    setEncryptionKey(localKey);
  });

  afterEach(async () => {
    await lockServer().catch((): void => undefined);
    closeDb();
    setRemoteDatabase(false);
    setEncryptionKey(null);
    for (const server of servers.splice(0)) {
      await server.close().catch((): void => undefined);
    }
    fs.rmSync(dataRoot, { recursive: true, force: true });
  });

  it('uses local mode when no server configuration exists', () => {
    expect(getServerConnection()).toEqual({ mode: 'local', connected: false });
  });

  it('initializes an empty server only by explicit request and keeps local encrypted files local', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer();
    servers.push(server);

    expect(await connectServer(connectInput(server.url, localKey, true), true)).toMatchObject({
      mode: 'server',
      connected: true,
      role: 'editor',
    });
    expect(server.store.revision).toBe(1);
    expect(readStoredBaseHours(server.store, localKey)).toBe(36);
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);

    const localFileAfterConnect = fs.readFileSync(getEncryptedDbPath());
    await runServerOperation('settings:setBaseHours', () => {
      setBaseHours(42);
      setHiddenEventTypes(['remote-secret']);
    });
    expect(getBaseHours()).toBe(42);
    expect(getHiddenEventTypes()).toEqual(['remote-secret']);
    expect(readStoredBaseHours(server.store, localKey)).toBe(42);
    expect(readStoredHiddenEventTypes(server.store, localKey)).toEqual(['remote-secret']);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFileAfterConnect);
    expect(fs.readFileSync(getEncryptedDbPath()).includes(Buffer.from('remote-secret'))).toBe(false);
    expect(readLocalBaseHours(localKey)).toBe(36);

    await lockServer();
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFileAfterConnect);
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);

    await useLocalConnection();
    setEncryptionKey(localKey);
    openDatabase();
    expect(getBaseHours()).toBe(36);
    expect(getHiddenEventTypes()).toEqual(['local-secret']);
    expect(getServerConnection()).toMatchObject({ mode: 'local', connected: false });
  });

  it('refuses an empty server without initialize and preserves the open local database', async () => {
    setLocalBaseHours(39);
    const localFile = fs.readFileSync(getEncryptedDbPath());
    const server = await startFakeServer();
    servers.push(server);

    await expect(connectServer(connectInput(server.url, localKey), true)).rejects.toThrow(/Server ist leer/);
    expect(server.store.revision).toBe(0);
    expect(getServerConnection()).toEqual({ mode: 'local', connected: false });
    expect(getBaseHours()).toBe(39);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);
  });

  it('does not initialize an empty server while the local database is locked or closed', async () => {
    const server = await startFakeServer();
    servers.push(server);

    await expect(connectServer(connectInput(server.url, localKey, true), false)).rejects.toThrow(
      /lokalen Bestand öffnen/,
    );
    expect(server.store.requests.login).toBe(0);
    expect(server.store.revision).toBe(0);
  });

  it('rejects an explicit initialization when the server already has a snapshot', async () => {
    setLocalBaseHours(36);
    const localFile = fs.readFileSync(getEncryptedDbPath());
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(44), localKey);
    const remoteFile = server.store.payload;

    await expect(connectServer(connectInput(server.url, localKey, true), true)).rejects.toThrow(
      /Server enthält bereits Daten/,
    );
    expect(server.store.requests.put).toBe(0);
    expect(server.store.payload).toEqual(remoteFile);
    expect(getServerConnection()).toEqual({ mode: 'local', connected: false });
    expect(getBaseHours()).toBe(36);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
  });

  it('serializes queued work before switching back to the local connection', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    await connectServer(connectInput(server.url, localKey), true);

    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const operation = withConnectionLock(async () => {
      events.push('operation:start');
      await gate;
      events.push('operation:end');
    });
    const switchToLocal = withConnectionLock(async () => {
      events.push('switch:start');
      await useLocalConnection();
      events.push('switch:end');
    });
    let staleOperationCalled = false;
    const staleOperation = withCurrentConnection(() => {
      staleOperationCalled = true;
    });

    await Promise.resolve();
    expect(events).toEqual(['operation:start']);
    release();
    await operation;
    await switchToLocal;
    await expect(staleOperation).rejects.toThrow(/Datenablage wurde gewechselt/);
    expect(staleOperationCalled).toBe(false);
    expect(events).toEqual(['operation:start', 'operation:end', 'switch:start', 'switch:end']);
    expect(getServerConnection()).toMatchObject({ mode: 'local', connected: false });
  });

  it('keeps local state after a failed login', async () => {
    setLocalBaseHours(40);
    const localFile = fs.readFileSync(getEncryptedDbPath());
    const server = await startFakeServer();
    servers.push(server);

    await expect(
      connectServer({ ...connectInput(server.url, localKey), password: 'wrong-password' }, true),
    ).rejects.toThrow(/Anmeldung fehlgeschlagen/);
    expect(server.store.requests.login).toBe(1);
    expect(getServerConnection()).toEqual({ mode: 'local', connected: false });
    expect(getBaseHours()).toBe(40);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
  });

  it('keeps local state after a wrong recovery key', async () => {
    setLocalBaseHours(40);
    const localFile = fs.readFileSync(getEncryptedDbPath());
    const serverKey = randomBytes(32);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(44), serverKey);

    await expect(connectServer(connectInput(server.url, localKey), true)).rejects.toThrow(
      /Recovery-Key|Sicherung beschädigt/,
    );
    expect(getServerConnection()).toEqual({ mode: 'local', connected: false });
    expect(getBaseHours()).toBe(40);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);
  });

  it('rolls back a real repository edit when the remote compare-and-swap write conflicts', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    await connectServer(connectInput(server.url, localKey), true);
    const localFile = fs.readFileSync(getEncryptedDbPath());
    server.store.conflictOnPut = true;

    await expect(
      runServerOperation('settings:setBaseHours', () => setBaseHours(48)),
    ).rejects.toThrow(/Serverbestand wurde geändert/);
    expect(getBaseHours()).toBe(36);
    expect(server.store.revision).toBe(1);
    expect(readStoredBaseHours(server.store, localKey)).toBe(36);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
  });

  it('blocks a stale edit until the changed server revision is explicitly refreshed', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    await connectServer(connectInput(server.url, localKey), true);
    const localFile = fs.readFileSync(getEncryptedDbPath());
    let called = false;

    storeSnapshot(server.store, snapshotAtBaseHours(50), localKey, 2);
    await expect(
      runServerOperation('settings:setBaseHours', () => {
        called = true;
        setBaseHours(49);
      }),
    ).rejects.toThrow(/anderen Gerät geändert/);
    expect(called).toBe(false);
    expect(getBaseHours()).toBe(36);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);

    await refreshServer();
    expect(getBaseHours()).toBe(50);
    await runServerOperation('settings:setBaseHours', () => setBaseHours(51));
    expect(getBaseHours()).toBe(51);
    expect(server.store.lastIfMatch).toBe('"2"');
  });

  it('rejects work queued before a refresh completes so it cannot use the reloaded database', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    await connectServer(connectInput(server.url, localKey), true);

    const refresh = withConnectionLock(() => refreshServer());
    let staleOperationCalled = false;
    const staleOperation = withCurrentConnection(() => {
      staleOperationCalled = true;
    });

    await refresh;
    await expect(staleOperation).rejects.toThrow(/Datenablage wurde gewechselt/);
    expect(staleOperationCalled).toBe(false);
    expect(getBaseHours()).toBe(36);
  });

  it('rejects reader writes and restores the memory snapshot without issuing a PUT', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer({ role: 'reader' });
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    await connectServer(connectInput(server.url, localKey), true);
    const localFile = fs.readFileSync(getEncryptedDbPath());

    await expect(
      runServerOperation('settings:setBaseHours', () => setBaseHours(49)),
    ).rejects.toThrow(/nur lesen/);
    expect(getBaseHours()).toBe(36);
    expect(server.store.requests.put).toBe(0);
    expect(server.store.revision).toBe(1);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
  });

  it('refreshes revisions and reconnects to the same server instance without touching local files', async () => {
    setLocalBaseHours(36);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    await connectServer(connectInput(server.url, localKey), true);
    const localFile = fs.readFileSync(getEncryptedDbPath());

    storeSnapshot(server.store, snapshotAtBaseHours(50), localKey, 2);
    await refreshServer();
    expect(getBaseHours()).toBe(50);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);

    await runServerOperation('settings:setBaseHours', () => setBaseHours(51));
    expect(server.store.lastIfMatch).toBe('"2"');
    expect(server.store.revision).toBe(3);

    storeSnapshot(server.store, snapshotAtBaseHours(60), localKey, 4);
    await connectServer(connectInput(server.url, localKey), true);
    expect(getBaseHours()).toBe(60);
    expect(server.store.requests.login).toBe(2);
    expect(fs.readFileSync(getEncryptedDbPath())).toEqual(localFile);
  });

  it('keeps the previous local mode when server.json cannot be persisted', async () => {
    setLocalBaseHours(36);
    const configPath = path.join(dataRoot, 'data', 'server.json');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'local' }));
    const previousConfig = fs.readFileSync(configPath);
    const server = await startFakeServer();
    servers.push(server);
    storeSnapshot(server.store, snapshotAtBaseHours(36), localKey);
    const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (to === configPath) throw new Error('server.json disk unavailable');
      return rename(from, to);
    });

    await expect(connectServer(connectInput(server.url, localKey), true)).rejects.toThrow(
      'server.json disk unavailable',
    );
    expect(fs.readFileSync(configPath)).toEqual(previousConfig);
    expect(getServerConnection()).toEqual({ mode: 'local', connected: false });
    expect(getBaseHours()).toBe(36);
    expect(fs.readFileSync(getEncryptedDbPath())).not.toEqual(Buffer.alloc(0));
    expect(readLocalBaseHours(localKey)).toBe(36);
    expect(fs.existsSync(getWorkingDbPath())).toBe(false);
  });
});
