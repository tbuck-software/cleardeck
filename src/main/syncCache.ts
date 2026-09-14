import { safeStorage } from 'electron';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { getDataDir } from './appPaths';
import { writeAtomic } from './atomicFile';
import { encryptBuffer, decryptBuffer } from './crypto';
import type { ServerRole, SyncStatus } from '../shared/serverConnection';
import syncSchema from '../shared/syncSchema.json';
import {
  applyChanges,
  captureRecords,
  createSyncDatabase,
  type SyncChange,
  type SyncRecord,
} from './syncRecords';

export type PendingTransaction = {
  id: string;
  instanceId: string;
  initialize: boolean;
  changes: SyncChange[];
};
export type CachedWorkspace = {
  format: 2;
  url: string;
  username: string;
  instanceId: string;
  deviceId: string;
  deviceSlot: number;
  role: ServerRole;
  cursor: number;
  initialized: boolean;
  database: string;
  base: SyncRecord[];
  pending: PendingTransaction[];
  passwordSalt: string;
  passwordVerifier: string;
  lastSyncedAt?: string;
  syncStatus: SyncStatus;
  syncError?: string;
};
export type WorkspaceCache = {
  state: CachedWorkspace;
  key: Buffer;
  wrappedKey: string;
};

const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const MAX_BASE_RECORDS = 1_000_000;
const MAX_PENDING_TRANSACTIONS = 100_000;
const MAX_PENDING_CHANGES = 1_000_000;
const MAX_CHANGES_PER_TRANSACTION = 10_000;
const MAX_SYNC_ERROR_LENGTH = 8_192;
const ALLOCATOR_TABLE = '__cleardeck_sync_id_allocations';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SYNC_STATUSES: readonly SyncStatus[] = [
  'synced',
  'pending',
  'offline',
  'syncing',
  'conflict',
  'auth-required',
  'error',
];
const SHARED_SETTING_KEYS = new Set(syncSchema.settings.sharedKeys);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value: unknown, expected: readonly string[]): value is Record<string, unknown> => {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value);
  const names = new Set(expected);
  return actual.length === expected.length && actual.every((key) => names.has(key));
};

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const decodeBase64 = (value: unknown, label: string, allowEmpty = false): Buffer => {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || !BASE64_PATTERN.test(value))
    throw new Error(`${label} ist kein gültiges Base64.`);
  const decoded = Buffer.from(value, 'base64');
  if (!allowEmpty && decoded.length === 0) throw new Error(`${label} ist leer.`);
  if (decoded.toString('base64') !== value) throw new Error(`${label} ist nicht kanonisches Base64.`);
  return decoded;
};

const sortedJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
  if (!isPlainObject(item)) return item;
  return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
});

const readBoundedFile = (target: string): Buffer => {
  const fd = fs.openSync(target, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (!Number.isSafeInteger(size) || size > MAX_CACHE_BYTES)
      throw new Error('Die lokale Serverkopie ist zu groß.');
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const count = fs.readSync(fd, bytes, offset, size - offset, null);
      if (count <= 0) throw new Error('Die lokale Serverkopie konnte nicht vollständig gelesen werden.');
      offset += count;
    }
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
};

const validateDatabaseSchema = (db: DatabaseType): void => {
  db.pragma('foreign_keys = ON');
  if (db.pragma('quick_check', { simple: true }) !== 'ok')
    throw new Error('Die lokale Serverkopie enthält eine beschädigte SQLite-Datenbank.');
  if ((db.pragma('foreign_key_check') as unknown[]).length)
    throw new Error('Die lokale Serverkopie enthält ungültige Datenverknüpfungen.');

  const expectedTables = new Set(syncSchema.tables.map((table) => table.name));
  const actualTables = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
  const allowedTables = new Set([...expectedTables, ALLOCATOR_TABLE]);
  if (actualTables.some((name) => !allowedTables.has(name)) ||
      [...expectedTables].some((name) => !actualTables.includes(name)))
    throw new Error('Das Schema der lokalen Serverkopie ist inkompatibel.');
  const version = db
    .prepare("SELECT value FROM settings WHERE key='schema_version'")
    .get() as { value?: unknown } | undefined;
  if (version?.value !== String(syncSchema.schemaVersion))
    throw new Error('Die lokale Serverkopie benötigt eine andere ClearDeck-Version.');
};

const validateSettingRow = (row: unknown, pathName: string): void => {
  if (!isPlainObject(row) || typeof row.key !== 'string' || !SHARED_SETTING_KEYS.has(row.key))
    throw new Error(`${pathName} enthält eine nicht synchronisierbare Einstellung.`);
};

const validateBaseRecordShape = (value: unknown, index: number): asserts value is SyncRecord => {
  if (!hasExactKeys(value, ['table', 'key', 'row']) || typeof value.table !== 'string' ||
      value.table.length > 128 || typeof value.key !== 'string' || value.key.length > 4096 ||
      !isPlainObject(value.row))
    throw new Error(`base[${index}] hat eine ungültige Form.`);
  if (value.table === 'settings') validateSettingRow(value.row, `base[${index}].row`);
};

const validateChangeShape = (value: unknown, pathName: string): asserts value is SyncChange => {
  if (!hasExactKeys(value, ['table', 'key', 'before', 'after']) || typeof value.table !== 'string' ||
      value.table.length > 128 || typeof value.key !== 'string' || value.key.length > 4096 ||
      (value.before !== null && !isPlainObject(value.before)) ||
      (value.after !== null && !isPlainObject(value.after)))
    throw new Error(`${pathName} hat eine ungültige Form.`);
  if (value.table === 'settings') {
    if (value.before !== null) validateSettingRow(value.before, `${pathName}.before`);
    if (value.after !== null) validateSettingRow(value.after, `${pathName}.after`);
  }
};

function validateCachedState(state: unknown, databaseBytes: Buffer): asserts state is CachedWorkspace {
  const allowedKeys = [
    'format',
    'url',
    'username',
    'instanceId',
    'deviceId',
    'deviceSlot',
    'role',
    'cursor',
    'initialized',
    'database',
    'base',
    'pending',
    'passwordSalt',
    'passwordVerifier',
    'lastSyncedAt',
    'syncStatus',
    'syncError',
  ];
  if (!hasExactKeys(state, allowedKeys.filter((key) =>
    key !== 'lastSyncedAt' && key !== 'syncError' || Object.prototype.hasOwnProperty.call(state, key))))
    throw new Error('state hat eine ungültige Form.');
  const candidate = state as Record<string, unknown>;
  if (candidate.format !== 2 || typeof candidate.url !== 'string' || candidate.url.length === 0 ||
      candidate.url.length > 2048 ||
      typeof candidate.username !== 'string' || !/^[a-zA-Z0-9@._+-]{1,120}$/.test(candidate.username) ||
      !isUuid(candidate.instanceId) || !isUuid(candidate.deviceId) ||
      typeof candidate.deviceSlot !== 'number' || !Number.isSafeInteger(candidate.deviceSlot) ||
      candidate.deviceSlot < 1 || candidate.deviceSlot > 1_000_000 ||
      typeof candidate.cursor !== 'number' || !Number.isSafeInteger(candidate.cursor) || candidate.cursor < 0 ||
      typeof candidate.initialized !== 'boolean' ||
      (candidate.role !== 'reader' && candidate.role !== 'editor' && candidate.role !== 'admin') ||
      !SYNC_STATUSES.includes(candidate.syncStatus as SyncStatus) ||
      typeof candidate.passwordSalt !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.passwordSalt) ||
      typeof candidate.passwordVerifier !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.passwordVerifier) ||
      !Array.isArray(candidate.base) || candidate.base.length > MAX_BASE_RECORDS ||
      !Array.isArray(candidate.pending) || candidate.pending.length > MAX_PENDING_TRANSACTIONS ||
      typeof candidate.database !== 'string' || candidate.database.length === 0 ||
      candidate.database.length > MAX_CACHE_BYTES * 2)
    throw new Error('state enthält ungültige Metadaten.');
  if (candidate.lastSyncedAt !== undefined &&
      (typeof candidate.lastSyncedAt !== 'string' || candidate.lastSyncedAt.length > 64 ||
       Number.isNaN(Date.parse(candidate.lastSyncedAt)) ||
       new Date(candidate.lastSyncedAt).toISOString() !== candidate.lastSyncedAt))
    throw new Error('state.lastSyncedAt ist ungültig.');
  if (candidate.syncError !== undefined &&
      (typeof candidate.syncError !== 'string' || candidate.syncError.length > MAX_SYNC_ERROR_LENGTH))
    throw new Error('state.syncError ist ungültig.');

  const base = candidate.base as SyncRecord[];
  base.forEach(validateBaseRecordShape);
  const encodedDatabase = decodeBase64(candidate.database, 'database');
  if (encodedDatabase.length > MAX_CACHE_BYTES || !encodedDatabase.equals(databaseBytes))
    throw new Error('Die lokale Serverkopie enthält eine uneinheitliche Datenbank.');
  const pending = candidate.pending as unknown[];
  const transactionIds = new Set<string>();
  let pendingChanges = 0;
  pending.forEach((value, index) => {
    if (!hasExactKeys(value, ['id', 'instanceId', 'initialize', 'changes']) ||
        !isUuid(value.id) || transactionIds.has(value.id) || value.instanceId !== candidate.instanceId ||
        typeof value.initialize !== 'boolean' || !Array.isArray(value.changes) ||
        value.changes.length > MAX_CHANGES_PER_TRANSACTION ||
        (pendingChanges += value.changes.length) > MAX_PENDING_CHANGES)
      throw new Error(`pending[${index}] hat eine ungültige Form.`);
    transactionIds.add(value.id);
    (value.changes as unknown[]).forEach((change, changeIndex) =>
      validateChangeShape(change, `pending[${index}].changes[${changeIndex}]`));
  });

  const baseDatabase = createSyncDatabase(base);
  const expected = new Database(baseDatabase);
  try {
    for (const transaction of pending as PendingTransaction[])
      applyChanges(expected, transaction.changes);
    const actual = new Database(databaseBytes);
    try {
      validateDatabaseSchema(actual);
      if (sortedJson(captureRecords(actual)) !== sortedJson(captureRecords(expected)))
        throw new Error('Die lokale Serverkopie und ihre Warteschlange stimmen nicht überein.');
    } finally {
      actual.close();
    }
  } finally {
    expected.close();
  }
}

export const workspaceCachePath = (url: string, username: string): string =>
  path.join(
    getDataDir(),
    'server-workspaces',
    createHash('sha256')
      .update(JSON.stringify([url, username]))
      .digest('hex'),
    'workspace.json',
  );

function requireSecureStorage(): void {
  if (
    !safeStorage.isEncryptionAvailable() ||
    safeStorage.getSelectedStorageBackend?.() === 'basic_text'
  ) {
    throw new Error(
      'Der geschützte Gerätespeicher ist nicht verfügbar. Die lokale Serverkopie kann nicht sicher geöffnet werden.',
    );
  }
}
export function createWorkspaceCache(state: CachedWorkspace): WorkspaceCache {
  requireSecureStorage();
  const key = randomBytes(32);
  return {
    state,
    key,
    wrappedKey: safeStorage.encryptString(key.toString('base64')).toString('base64'),
  };
}

function envelope(cache: WorkspaceCache): Buffer {
  const { iv, tag, content } = encryptBuffer(Buffer.from(JSON.stringify(cache.state)), cache.key);
  const bytes = Buffer.from(
    JSON.stringify({
      format: 2,
      wrappedKey: cache.wrappedKey,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      content: content.toString('base64'),
    }),
  );
  if (bytes.length > MAX_CACHE_BYTES)
    throw new Error('Die lokale Serverkopie ist zu groß und wurde nicht überschrieben.');
  return bytes;
}
/** SQLite, confirmed state and outbox share one atomic, authenticated write. */
export function saveWorkspaceCache(cache: WorkspaceCache): void {
  writeAtomic(workspaceCachePath(cache.state.url, cache.state.username), envelope(cache));
}
export function preserveWorkspaceRecovery(cache: WorkspaceCache): void {
  const target = path.join(
    path.dirname(workspaceCachePath(cache.state.url, cache.state.username)),
    `recovery-${Date.now()}-${randomUUID()}.json`,
  );
  writeAtomic(target, envelope(cache));
}
export function loadWorkspaceCache(url: string, username: string): WorkspaceCache | null {
  const target = workspaceCachePath(url, username);
  if (!fs.existsSync(target)) return null;
  requireSecureStorage();
  try {
    const input: unknown = JSON.parse(readBoundedFile(target).toString('utf8'));
    if (!hasExactKeys(input, ['format', 'wrappedKey', 'iv', 'tag', 'content']) || input.format !== 2)
      throw new Error('envelope');
    const wrappedKey = decodeBase64(input.wrappedKey, 'wrappedKey');
    if (wrappedKey.length > 16 * 1024) throw new Error('wrappedKey');
    const keyText = safeStorage.decryptString(wrappedKey);
    const key = decodeBase64(keyText, 'cache key');
    if (key.length !== 32) throw new Error('key');
    const iv = decodeBase64(input.iv, 'iv');
    const tag = decodeBase64(input.tag, 'tag');
    const content = decodeBase64(input.content, 'content');
    if (iv.length !== 12 || tag.length !== 16 || content.length > MAX_CACHE_BYTES)
      throw new Error('ciphertext');
    const state: unknown = JSON.parse(
      decryptBuffer({ iv, tag, content }, key).toString('utf8'),
    );
    if (!isPlainObject(state) || state.url !== url || state.username !== username)
      throw new Error('state ownership');
    const databaseBytes = decodeBase64(state.database, 'database');
    if (databaseBytes.length > MAX_CACHE_BYTES) throw new Error('database');
    validateCachedState(state, databaseBytes);
    return { state, key, wrappedKey: input.wrappedKey as string };
  } catch {
    throw new Error(
      'Die lokale Serverkopie ist beschädigt oder auf diesem Gerät nicht entschlüsselbar. Sie wurde nicht überschrieben.',
    );
  }
}
export function passwordProof(password: string): {
  passwordSalt: string;
  passwordVerifier: string;
} {
  const passwordSalt = randomBytes(32).toString('hex');
  return {
    passwordSalt,
    passwordVerifier: scryptSync(password, passwordSalt, 32).toString('hex'),
  };
}
export function verifyOfflinePassword(cache: WorkspaceCache, password: string): boolean {
  const expected = Buffer.from(cache.state.passwordVerifier, 'hex');
  const actual = scryptSync(password, cache.state.passwordSalt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
