/// <reference types="vitest/globals" />
// @vitest-environment node

import fs from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

const runtime = vi.hoisted(() => {
  const wrapKey = Buffer.from('cleardeck-test-safe-storage-key-32');
  const xor = (input: Buffer, nonce: Buffer): Buffer =>
    Buffer.from(input.map((value, index) => value ^ wrapKey[index % wrapKey.length] ^ nonce[index % nonce.length]));

  return {
    root: '',
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((value: string) => {
        const nonce = Buffer.from('test-safe-storage');
        return Buffer.concat([nonce, xor(Buffer.from(value, 'utf8'), nonce)]);
      }),
      decryptString: vi.fn((encrypted: Buffer | string) => {
        const bytes = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
        const nonce = bytes.subarray(0, 17);
        return xor(bytes.subarray(17), nonce).toString('utf8');
      }),
    },
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => runtime.root },
  safeStorage: runtime.safeStorage,
}));

vi.mock('better-sqlite3', async () => ({ default: (await import('./sqliteAdapter')).default }));

import {
  closeDb,
  flushDatabase,
  getDb,
  openDatabase,
  setEncryptionKey,
  setRemoteDatabase,
  setStorageMode,
} from '../database/connection';
import {
  connectServer,
  getServerConnection,
  lockServer,
  refreshServer,
  resolveServerConflict,
  runServerOperation,
  setServerEditing,
  useLocalConnection,
  withConnectionLock,
  withCurrentConnection,
} from '../serverConnection';
import { getBaseHours, setBaseHours, setHiddenEventTypes } from '../repositories/settings';

type Row = Record<string, unknown>;
type StoredRecord = { table: string; key: string; row: Row | null; version: number };
type LoginRequest = { username?: string; password?: string; deviceId?: string };
type TransactionChange = {
  table: string;
  key: string;
  before: Row | null;
  after: Row | null;
};
type TransactionRequest = {
  id: string;
  instanceId: string;
  initialize: boolean;
  changes: TransactionChange[];
};
type ServerState = ReturnType<typeof getServerConnection> & {
  syncStatus: string;
  pendingChanges: number;
  lastSyncedAt: string | number | null;
  syncError: string | null;
  hasOfflineCopy: boolean;
};

type InitialRow = { table: string; key: readonly unknown[]; row: Row };

type FakeStore = {
  username: string;
  password: string;
  role: 'reader' | 'editor';
  instanceId: string;
  deviceSlot: number;
  cursor: number;
  initialized: boolean;
  online: boolean;
  rejectTransactionsStatus: 401 | 409 | null;
  dropNextTransactionResponse: boolean;
  requests: {
    login: number;
    changes: number;
    transactions: number;
    snapshots: number;
    logout: number;
  };
  routes: string[];
  loginBodies: LoginRequest[];
  changeQueries: number[];
  transactionBodies: TransactionRequest[];
  records: Map<string, StoredRecord>;
  history: StoredRecord[];
  processedTransactions: Map<string, number>;
  deviceSlots: Map<string, number>;
  tokens: Set<string>;
  revokedTokens: Set<string>;
  nextToken: number;
};

type FakeServer = {
  store: FakeStore;
  url: string;
  close: () => Promise<void>;
  pushRemote: (table: string, key: readonly unknown[], row: Row | null) => void;
};

const TOKEN_SUFFIX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOCAL_PASSWORD = 'server-password';
const BASE_HOURS_KEY = JSON.stringify(['baseHours']);
const INSTANCE_A = '11111111-1111-4111-8111-111111111111';
const INSTANCE_B = '22222222-2222-4222-8222-222222222222';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const sendJson = (response: ServerResponse, status: number, value: unknown): void => {
  if (response.destroyed) return;
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};

const recordId = (table: string, key: string): string => `${table}\u0000${key}`;

const parseKey = (key: string): readonly unknown[] | null => {
  try {
    const value: unknown = JSON.parse(key);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

const tokenFor = (sequence: number): string =>
  `T${String(sequence).padStart(4, '0')}${TOKEN_SUFFIX[sequence % TOKEN_SUFFIX.length]}`.padEnd(43, 't');

const rowForSetting = (key: string, value: string | number): Row => ({ key, value: String(value) });

const startFakeServer = async (
  overrides: Partial<Pick<FakeStore, 'username' | 'password' | 'role' | 'instanceId' | 'deviceSlot' | 'initialized'>> & {
    initialRows?: InitialRow[];
  } = {},
): Promise<FakeServer> => {
  const store: FakeStore = {
    username: 'alice',
    password: LOCAL_PASSWORD,
    role: 'editor',
    instanceId: INSTANCE_A,
    deviceSlot: 7,
    cursor: 0,
    initialized: false,
    online: true,
    rejectTransactionsStatus: null,
    dropNextTransactionResponse: false,
    requests: { login: 0, changes: 0, transactions: 0, snapshots: 0, logout: 0 },
    routes: [],
    loginBodies: [],
    changeQueries: [],
    transactionBodies: [],
    records: new Map(),
    history: [],
    processedTransactions: new Map(),
    deviceSlots: new Map(),
    tokens: new Set(),
    revokedTokens: new Set(),
    nextToken: 0,
    ...overrides,
  };

  const appendChange = (table: string, key: string, row: Row | null): void => {
    store.cursor++;
    const next = { table, key, row: row ? clone(row) : null, version: store.cursor };
    store.records.set(recordId(table, key), next);
    store.history.push(clone(next));
  };

  for (const initial of overrides.initialRows ?? []) {
    appendChange(initial.table, JSON.stringify(initial.key), initial.row);
  }

  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Connection', 'close');

    try {
      const address = `http://${request.headers.host ?? '127.0.0.1'}`;
      const parsedUrl = new URL(request.url ?? '/', address);
      const route = `${request.method ?? 'GET'} ${parsedUrl.pathname}`;
      store.routes.push(route);

      if (parsedUrl.pathname === '/v2/login' && request.method === 'POST') {
        store.requests.login++;
        if (!store.online) {
          response.destroy();
          return;
        }
        const input = JSON.parse((await readRequestBody(request)).toString()) as LoginRequest;
        store.loginBodies.push(clone(input));
        if (
          input.username !== store.username ||
          input.password !== store.password ||
          typeof input.deviceId !== 'string' ||
          !input.deviceId
        ) {
          sendJson(response, 401, { error: 'Anmeldung fehlgeschlagen.' });
          return;
        }
        let deviceSlot = store.deviceSlots.get(input.deviceId);
        if (!deviceSlot) {
          deviceSlot = store.deviceSlots.size + store.deviceSlot;
          store.deviceSlots.set(input.deviceId, deviceSlot);
        }
        if (deviceSlot < 1 || deviceSlot > 1_000_000) {
          sendJson(response, 500, { error: 'Ungültiger Geräteslot.' });
          return;
        }
        const token = tokenFor(++store.nextToken);
        store.tokens.add(token);
        sendJson(response, 200, {
          protocol: 2,
          token,
          role: store.role,
          instanceId: store.instanceId,
          deviceSlot,
          revision: store.cursor,
        });
        return;
      }

      if (parsedUrl.pathname === '/v2/session' && request.method === 'DELETE') {
        store.requests.logout++;
        sendJson(response, 200, { ok: true });
        return;
      }

      if (parsedUrl.pathname === '/v1/snapshot') {
        store.requests.snapshots++;
        sendJson(response, 404, { error: 'v1 snapshots are not supported by this fixture.' });
        return;
      }

      const authorization = request.headers.authorization;
      const token = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/, '') : '';
      if (!store.online) {
        response.destroy();
        return;
      }
      if (!token || !store.tokens.has(token) || store.revokedTokens.has(token)) {
        sendJson(response, 401, { error: 'Sitzung abgelaufen.' });
        return;
      }

      if (parsedUrl.pathname === '/v2/changes' && request.method === 'GET') {
        store.requests.changes++;
        const since = Number(parsedUrl.searchParams.get('since'));
        if (!Number.isSafeInteger(since) || since < 0) {
          sendJson(response, 422, { error: 'Ungültiger Cursor.' });
          return;
        }
        store.changeQueries.push(since);
        sendJson(response, 200, {
          instanceId: store.instanceId,
          cursor: store.cursor,
          initialized: store.initialized,
          changes: store.history
            .filter((change) => change.version > since)
            .map((change) => ({
              table: change.table,
              key: change.key,
              row: change.row ? clone(change.row) : null,
              version: change.version,
            })),
        });
        return;
      }

      if (parsedUrl.pathname === '/v2/transactions' && request.method === 'POST') {
        store.requests.transactions++;
        const input = JSON.parse((await readRequestBody(request)).toString()) as TransactionRequest;
        store.transactionBodies.push(clone(input));
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) ||
          input.instanceId !== store.instanceId ||
          !Array.isArray(input.changes)
        ) {
          sendJson(response, 422, { error: 'Ungültige Transaktion.' });
          return;
        }
        if (store.rejectTransactionsStatus) {
          const status = store.rejectTransactionsStatus;
          if (status === 401) {
            for (const activeToken of store.tokens) store.revokedTokens.add(activeToken);
          }
          sendJson(response, status, { error: status === 401 ? 'Sitzung abgelaufen.' : 'CAS-Konflikt.' });
          return;
        }
        const previousCursor = store.processedTransactions.get(input.id);
        if (previousCursor !== undefined) {
          sendJson(response, 200, { cursor: previousCursor });
          return;
        }
        if (input.initialize && store.initialized) {
          sendJson(response, 409, { error: 'Bestand ist bereits initialisiert.' });
          return;
        }
        if (!input.initialize && !store.initialized) {
          sendJson(response, 409, { error: 'Bestand ist noch nicht initialisiert.' });
          return;
        }

        for (const change of input.changes) {
          const key = parseKey(change.key);
          if (
            !key ||
            typeof change.table !== 'string' ||
            !Object.prototype.hasOwnProperty.call(change, 'before') ||
            !Object.prototype.hasOwnProperty.call(change, 'after')
          ) {
            sendJson(response, 422, { error: 'Ungültiger Datensatz.' });
            return;
          }
          const current = store.records.get(recordId(change.table, change.key));
          const currentRow = current?.row ?? null;
          if (!sameValue(currentRow, change.before)) {
            sendJson(response, 409, {
              error: 'CAS-Konflikt.',
              table: change.table,
              key: change.key,
            });
            return;
          }
        }

        for (const change of input.changes) {
          appendChange(change.table, change.key, change.after ? clone(change.after) : null);
        }
        store.initialized = true;
        store.processedTransactions.set(input.id, store.cursor);
        if (store.dropNextTransactionResponse) {
          store.dropNextTransactionResponse = false;
          response.destroy();
          return;
        }
        sendJson(response, 200, { cursor: store.cursor });
        return;
      }

      sendJson(response, 404, { error: 'Nicht gefunden.' });
    } catch {
      if (!response.headersSent && !response.destroyed) sendJson(response, 500, { error: 'Fehler.' });
    }
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fake server did not bind a port.');

  return {
    store,
    url: `http://127.0.0.1:${address.port}`,
    pushRemote: (table, key, row) => {
      appendChange(table, JSON.stringify(key), row);
      store.initialized = true;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

const connectInput = (url: string, initialize = false, offline = false) => ({
  url,
  username: 'alice',
  password: LOCAL_PASSWORD,
  initialize,
  ...(offline ? { offline: true } : {}),
});

const state = (): ServerState => getServerConnection() as ServerState;

const openLocal = (baseHours = 36, hiddenEventTypes = ['local-secret']): void => {
  openDatabase({ create: true });
  setBaseHours(baseHours);
  setHiddenEventTypes(hiddenEventTypes);
  flushDatabase();
};

const waitFor = async (
  predicate: () => boolean,
  message: string,
  timeout = 3_000,
): Promise<void> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${message}.`);
};

const initializeConnection = async (server: FakeServer): Promise<void> => {
  await connectServer(connectInput(server.url, true), true);
  await waitFor(
    () => server.store.requests.transactions >= 1 && state().pendingChanges === 0 && state().syncStatus === 'synced',
    'the initial workspace transaction',
  );
};

const allFiles = (root: string): Record<string, string> => {
  const files: Record<string, string> = {};
  const visit = (directory: string): void => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else files[path.relative(root, absolute)] = fs.readFileSync(absolute).toString('base64');
    }
  };
  visit(root);
  return files;
};

const backupFiles = (root: string): string[] =>
  Object.keys(allFiles(root)).filter((file) =>
    file.split(path.sep).includes('backups') || file.split(path.sep).some((part) => part.startsWith('recovery-')),
  );

const lastTransaction = (server: FakeServer): TransactionRequest => {
  const transaction = server.store.transactionBodies[server.store.transactionBodies.length - 1];
  if (!transaction) throw new Error('Expected a transaction request.');
  return transaction;
};

const storedSetting = (server: FakeServer, key: string): Row | null =>
  server.store.records.get(recordId('settings', JSON.stringify([key])))?.row ?? null;

describe('v2 server connection with an encrypted offline delta cache', () => {
  let dataRoot: string;
  let localKey: Buffer;
  const servers: FakeServer[] = [];

  beforeEach(() => {
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-v2-server-connection-'));
    runtime.root = dataRoot;
    localKey = randomBytes(32);
    setRemoteDatabase(false);
    setStorageMode('encrypted');
    setEncryptionKey(localKey);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    setServerEditing(false);
    await lockServer().catch((): void => undefined);
    closeDb();
    setRemoteDatabase(false);
    setEncryptionKey(null);
    for (const server of servers.splice(0)) await server.close().catch((): void => undefined);
    fs.rmSync(dataRoot, { recursive: true, force: true });
  });

  it('exposes the local state shape before any server workspace exists', () => {
    expect(state()).toMatchObject({
      mode: 'local',
      connected: false,
      hasOfflineCopy: false,
    });
  });

  it('initializes the server with v2 rows and caches the workspace key through safeStorage', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);

    const connectedPromise = connectServer(connectInput(server.url, true), true);
    const connected = await connectedPromise;
    await waitFor(
      () => server.store.requests.transactions >= 1 && state().pendingChanges === 0 && state().syncStatus === 'synced',
      'the initial workspace transaction',
    );
    expect(connected).toMatchObject({ mode: 'server', connected: true, role: 'editor' });
    expect(state()).toMatchObject({
      mode: 'server',
      connected: true,
      pendingChanges: 0,
      hasOfflineCopy: true,
    });
    expect(state().lastSyncedAt).not.toBeNull();
    expect(runtime.safeStorage.encryptString).toHaveBeenCalled();

    expect(server.store.requests.login).toBe(1);
    expect(server.store.loginBodies[0]).toMatchObject({ username: 'alice', password: LOCAL_PASSWORD });
    expect(server.store.loginBodies[0]?.deviceId).toEqual(expect.any(String));
    expect(server.store.deviceSlots.get(server.store.loginBodies[0]!.deviceId!)).toBeGreaterThanOrEqual(1);
    expect(server.store.deviceSlots.get(server.store.loginBodies[0]!.deviceId!)).toBeLessThanOrEqual(1_000_000);

    const transaction = lastTransaction(server);
    expect(transaction.initialize).toBe(true);
    expect(transaction.instanceId).toBe(server.store.instanceId);
    expect(transaction.changes.length).toBeGreaterThan(0);
    expect(transaction.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(transaction.changes.every((change) => Array.isArray(parseKey(change.key)))).toBe(true);
    expect(server.store.initialized).toBe(true);
    expect(server.store.requests.snapshots).toBe(0);
    expect(server.store.routes.some((route) => route.includes('/v1/'))).toBe(false);
  });

  it('writes offline changes durably, keeps them queued, and unlocks the same copy after a restart', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    const loginCount = server.store.requests.login;

    server.store.online = false;
    await runServerOperation('settings:setBaseHours', () => setBaseHours(44));
    await waitFor(
      () => state().pendingChanges > 0 && state().syncStatus === 'offline',
      'the offline transaction to remain pending',
    );
    expect(getBaseHours()).toBe(44);
    expect(state()).toMatchObject({ connected: true, hasOfflineCopy: true });
    expect(state().syncError).toEqual(expect.any(String));

    await lockServer();
    await connectServer(connectInput(server.url, false, true), true);
    expect(server.store.requests.login).toBe(loginCount);
    expect(runtime.safeStorage.decryptString).toHaveBeenCalled();
    expect(getBaseHours()).toBe(44);
    expect(state()).toMatchObject({ connected: true, pendingChanges: 1, hasOfflineCopy: true });
  });

  it('rejects a wrong offline password before touching the old encrypted cache', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    await lockServer();
    const before = allFiles(dataRoot);
    const loginCount = server.store.requests.login;

    await expect(
      connectServer({ ...connectInput(server.url, false, true), password: 'wrong-password' }, true),
    ).rejects.toThrow();
    expect(server.store.requests.login).toBe(loginCount);
    expect(allFiles(dataRoot)).toEqual(before);
    expect(state()).toMatchObject({ mode: 'server', connected: false });
  });

  it('uploads only changed rows through transactions and never sends a full snapshot', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    server.store.transactionBodies.length = 0;
    server.store.routes.length = 0;

    await runServerOperation('settings:setBaseHours', () => setBaseHours(42));
    await waitFor(() => state().pendingChanges === 0 && server.store.transactionBodies.length >= 1, 'changed row upload');

    const transaction = lastTransaction(server);
    expect(transaction.initialize).toBe(false);
    expect(transaction.changes).toHaveLength(1);
    expect(transaction.changes[0]).toEqual({
      table: 'settings',
      key: BASE_HOURS_KEY,
      before: rowForSetting('baseHours', 36),
      after: rowForSetting('baseHours', 42),
    });
    expect(storedSetting(server, 'baseHours')).toEqual(rowForSetting('baseHours', 42));
    expect(server.store.requests.snapshots).toBe(0);
    expect(server.store.routes.some((route) => route.includes('/v1/'))).toBe(false);
  });

  it('keeps a local edit and its queue after an independent server CAS conflict', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    server.store.rejectTransactionsStatus = 409;

    await runServerOperation('settings:setBaseHours', () => setBaseHours(48));
    await waitFor(() => state().pendingChanges > 0 && state().syncStatus === 'conflict', 'the CAS-conflicted change to remain queued');
    expect(getBaseHours()).toBe(48);
    expect(storedSetting(server, 'baseHours')).toEqual(rowForSetting('baseHours', 36));
    expect(state().syncError).toEqual(expect.any(String));
  });

  it('keeps a revoked-session edit queued and flushes it after same-account login', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    server.store.rejectTransactionsStatus = 401;

    await runServerOperation('settings:setBaseHours', () => setBaseHours(49));
    await waitFor(() => state().pendingChanges > 0, 'the revoked-session change to remain queued');
    expect(getBaseHours()).toBe(49);

    server.store.rejectTransactionsStatus = null;
    await lockServer();
    await connectServer(connectInput(server.url), true);
    await waitFor(() => state().pendingChanges === 0, 'the preserved queue to flush after re-login');
    expect(server.store.requests.login).toBe(2);
    expect(getBaseHours()).toBe(49);
    expect(storedSetting(server, 'baseHours')).toEqual(rowForSetting('baseHours', 49));
  });

  it('retries an applied transaction with the same UUID after the response is lost', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    server.store.transactionBodies.length = 0;
    server.store.dropNextTransactionResponse = true;

    await runServerOperation('settings:setBaseHours', () => setBaseHours(41));
    await waitFor(() => server.store.transactionBodies.length >= 1, 'the dropped transaction request');
    await waitFor(() => state().syncStatus === 'offline', 'the failed transaction state');
    await refreshServer();
    await waitFor(() => state().pendingChanges === 0, 'the idempotent retry to finish');

    const ids = server.store.transactionBodies.map((transaction) => transaction.id);
    expect(new Set(ids).size).toBe(1);
    expect(server.store.processedTransactions.size).toBe(2);
    expect(server.store.history.filter((change) => change.table === 'settings' && change.key === BASE_HOURS_KEY)).toHaveLength(2);
    expect(storedSetting(server, 'baseHours')).toEqual(rowForSetting('baseHours', 41));
  });

  it('pulls an independent remote edit with a cursor and preserves local state when nothing is pending', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    const cursorBeforeRemoteEdit = server.store.cursor;
    const transactionsBeforeRefresh = server.store.requests.transactions;
    server.pushRemote('settings', ['baseHours'], rowForSetting('baseHours', 55));

    await refreshServer();
    expect(getBaseHours()).toBe(55);
    expect(state()).toMatchObject({ pendingChanges: 0 });
    expect(state().syncError).toBeUndefined();
    expect(server.store.changeQueries).toContain(cursorBeforeRemoteEdit);
    expect(server.store.requests.transactions).toBe(transactionsBeforeRefresh);
    expect(server.store.requests.snapshots).toBe(0);
  });

  it('lets the user keep the local side of a conflict and retains a conflict backup', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    server.store.online = false;
    await runServerOperation('settings:setBaseHours', () => setBaseHours(45));
    await waitFor(() => state().pendingChanges > 0, 'the local conflict edit');
    server.store.online = true;
    server.pushRemote('settings', ['baseHours'], rowForSetting('baseHours', 50));
    server.pushRemote('settings', ['visitIntervalDays'], rowForSetting('visitIntervalDays', 120));
    setServerEditing(true);
    await refreshServer();
    expect(getBaseHours()).toBe(45);
    await waitFor(() => state().syncStatus === 'conflict', 'the local/server conflict state');
    expect(state().pendingChanges).toBeGreaterThan(0);

    const beforeBackups = backupFiles(dataRoot);
    setServerEditing(false);
    await resolveServerConflict('local');
    await waitFor(() => state().pendingChanges === 0, 'the local conflict decision to upload');
    expect(getBaseHours()).toBe(45);
    expect(storedSetting(server, 'baseHours')).toEqual(rowForSetting('baseHours', 45));
    expect(storedSetting(server, 'visitIntervalDays')).toEqual(rowForSetting('visitIntervalDays', 120));
    expect(getDb().prepare("SELECT value FROM settings WHERE key='visitIntervalDays'").get()).toEqual({ value: '120' });
    expect(backupFiles(dataRoot).length).toBeGreaterThan(beforeBackups.length);
  });

  it('lets the user choose the server side of a conflict and drops only the local loser', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    server.store.online = false;
    await runServerOperation('settings:setBaseHours', () => setBaseHours(46));
    await waitFor(() => state().pendingChanges > 0, 'the queued local conflict edit');
    server.store.online = true;
    server.pushRemote('settings', ['baseHours'], rowForSetting('baseHours', 51));
    await refreshServer();
    expect(getBaseHours()).toBe(46);
    await waitFor(() => state().syncStatus === 'conflict', 'the local/server conflict state');

    const beforeBackups = backupFiles(dataRoot);
    await resolveServerConflict('server');
    await waitFor(() => state().pendingChanges === 0, 'the server conflict decision');
    expect(getBaseHours()).toBe(51);
    expect(storedSetting(server, 'baseHours')).toEqual(rowForSetting('baseHours', 51));
    expect(backupFiles(dataRoot).length).toBeGreaterThan(beforeBackups.length);
  });

  it('uses the server-authoritative reader role and never queues a write', async () => {
    openLocal();
    const server = await startFakeServer({
      initialized: true,
      role: 'reader',
      initialRows: [
        { table: 'settings', key: ['baseHours'], row: rowForSetting('baseHours', 36) },
        { table: 'settings', key: ['hiddenEventTypes'], row: rowForSetting('hiddenEventTypes', '[]') },
      ],
    });
    servers.push(server);
    await connectServer(connectInput(server.url), true);
    expect(state().role).toBe('reader');
    let called = false;

    await expect(
      runServerOperation('settings:setBaseHours', () => {
        called = true;
        setBaseHours(49);
      }),
    ).rejects.toThrow(/nur lesen|read/i);
    expect(called).toBe(false);
    expect(getBaseHours()).toBe(36);
    expect(state().pendingChanges).toBe(0);
    expect(server.store.requests.transactions).toBe(0);
  });

  it('keeps queued changes attached to their workspace while switching servers', async () => {
    openLocal();
    const first = await startFakeServer({ instanceId: INSTANCE_A });
    const second = await startFakeServer({
      instanceId: INSTANCE_B,
      initialized: true,
      initialRows: [{ table: 'settings', key: ['baseHours'], row: rowForSetting('baseHours', 36) }],
    });
    servers.push(first, second);
    await initializeConnection(first);

    first.store.online = false;
    await runServerOperation('settings:setBaseHours', () => setBaseHours(47));
    await waitFor(() => state().pendingChanges > 0, 'the first workspace queue');
    await useLocalConnection();

    await connectServer(connectInput(second.url), true);
    await waitFor(() => state().connected === true, 'the second workspace connection');
    expect(second.store.requests.transactions).toBe(0);
    expect(storedSetting(second, 'baseHours')).toEqual(rowForSetting('baseHours', 36));

    await useLocalConnection();
    await connectServer(connectInput(first.url, false, true), true);
    expect(state()).toMatchObject({ connected: true, pendingChanges: 1 });
    expect(getBaseHours()).toBe(47);
  });

  it('keeps a stable device id and valid primary-key JSON across reconnects', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);
    const firstDeviceId = server.store.loginBodies[0]?.deviceId;
    expect(firstDeviceId).toEqual(expect.any(String));
    await lockServer();
    await connectServer(connectInput(server.url), true);

    expect(server.store.loginBodies[1]?.deviceId).toBe(firstDeviceId);
    expect(server.store.deviceSlots.get(firstDeviceId!)).toBeGreaterThanOrEqual(1);
    expect(server.store.deviceSlots.get(firstDeviceId!)).toBeLessThanOrEqual(1_000_000);

    await runServerOperation('settings:setBaseHours', () => setBaseHours(43));
    await waitFor(() => state().pendingChanges === 0, 'the reconnect write');
    const transaction = lastTransaction(server);
    expect(transaction.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(transaction.changes[0]?.key).toBe(BASE_HOURS_KEY);
    expect(transaction.changes[0]?.key).not.toBe('baseHours');
  });

  it('keeps connection work serialized and rejects callbacks captured before a workspace switch', async () => {
    openLocal();
    const server = await startFakeServer();
    servers.push(server);
    await initializeConnection(server);

    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
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
  });
});
