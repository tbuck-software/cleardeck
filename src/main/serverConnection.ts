import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDataDir } from './appPaths';
import { writeAtomic } from './atomicFile';
import {
  activateRemoteDatabase,
  closeDb,
  flushDatabase,
  getDb,
  isDbOpen,
  restoreMemorySnapshot,
  setEncryptionKey,
  setRemoteDatabase,
} from './database/connection';
import {
  normalizeServerUrl,
  serverRequest,
  readBoundedResponse,
  ServerRequestError,
} from './serverTransport';
import {
  captureRecords,
  captureLocalSettings,
  captureDeviceCounters,
  diffRecords,
  createSyncDatabase,
  allocateDeviceIds,
  type SyncRecord,
} from './syncRecords';
import {
  createWorkspaceCache,
  loadWorkspaceCache,
  saveWorkspaceCache,
  preserveWorkspaceRecovery,
  workspaceCachePath,
  passwordProof,
  verifyOfflinePassword,
  type WorkspaceCache,
  type CachedWorkspace,
} from './syncCache';
import type { ConnectServerInput, ServerConnection, ServerRole, SyncStatus } from '../shared/serverConnection';

type Session = {
  cache: WorkspaceCache;
  token: string | null;
  status: SyncStatus;
  error?: string;
};
type ServerRow = {
  table: string;
  key: string;
  row: SyncRecord['row'] | null;
  version: number;
};
let session: Session | null = null;
let queue: Promise<unknown> = Promise.resolve();
let connectionEpoch = 0;
let dataVersion = 0;
let editing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let syncing: { session: Session; promise: Promise<void> } | null = null;
const configPath = () => path.join(getDataDir(), 'server.json');
const identity = (row: { table: string; key: string }) => JSON.stringify([row.table, row.key]);
// Reader access is explicit. A new IPC action must be reviewed before readers may call it.
const readerActions = new Set([
  'data:list',
  'data:getPeriod',
  'data:listPeriods',
  'data:export',
  'db:export',
  'employment:integrityOverview',
  'employment:previewConsolidate',
  'employment:previewMerge',
  'employment:previewReconcile',
  'qualifications:list',
  'services:list',
  'competencies:listDefinitions',
  'competencies:listEmployee',
  'instructions:listDefinitions',
  'instructions:listEmployee',
  'instructions:employeesWithOpen',
  'events:list',
  'events:listRange',
  'events:listUpcoming',
  'settings:getBaseHours',
  'settings:getHiddenEventTypes',
  'settings:careSettings',
  'dashboard:actionNeeded',
  'dashboard:birthdaysAnniversaries',
  'dashboard:definitionUsage',
  'dashboard:employeeStats',
  'dashboard:expiringTrainings',
  'dashboard:openInstructions',
  'dashboard:patientStats',
  'patients:list',
  'patients:get',
  'patients:listBirthdays',
  'patients:listVisitsInRange',
  'visits:list',
  'visits:recent',
  'audits:sections',
  'audits:exportPersonList',
  'audits:list',
  'dev:tables',
]);

/** Only local mutations hold this lock. Network synchronization never blocks local reads/writes. */
export function withConnectionLock<T>(operation: () => T | Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch((): void => undefined);
  return result;
}
export function withCurrentConnection<T>(operation: () => T | Promise<T>): Promise<T> {
  const expected = connectionEpoch;
  return withConnectionLock(() => {
    if (expected !== connectionEpoch)
      throw new Error(
        'Die Datenablage wurde gewechselt. Bitte die Aktion im aktuellen Bestand erneut ausführen.',
      );
    return operation();
  });
}
function storedConnection(): ServerConnection {
  try {
    const input = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (
      !input ||
      !['local', 'server'].includes(input.mode) ||
      (input.mode === 'server' &&
        (typeof input.username !== 'string' || typeof input.instanceId !== 'string'))
    )
      throw new Error('invalid');
    return {
      mode: input.mode,
      ...(input.url
        ? {
            url: normalizeServerUrl(input.url),
            username: input.username,
            instanceId: input.instanceId,
          }
        : {}),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { mode: 'local' };
    throw new Error(
      'Die Serverkonfiguration ist beschädigt. Der bisherige Bestand bleibt erhalten.',
    );
  }
}
export function getServerConnection(): ServerConnection {
  const stored = storedConnection();
  const state = session?.cache.state;
  return {
    ...stored,
    connected: !!session,
    dataVersion,
    hasOfflineCopy: !!(
      stored.url &&
      stored.username &&
      fs.existsSync(workspaceCachePath(stored.url, stored.username))
    ),
    ...(state
      ? {
          role: state.role,
          syncStatus: session!.status,
          pendingChanges: state.pending.length,
          lastSyncedAt: state.lastSyncedAt,
          syncError: session!.error,
        }
      : {}),
  };
}
export const isServerMode = (): boolean => storedConnection().mode === 'server';
/** Kept as the auth gate: an explicitly unlocked offline workspace is usable. */
export const isServerConnected = (): boolean => !!session;
export const setServerEditing = (value: boolean): void => {
  editing = value;
  if (!value) scheduleSync(0);
};
const saveConnection = (config: ServerConnection) =>
  writeAtomic(configPath(), Buffer.from(JSON.stringify(config)));

function commit(current: Session, state: CachedWorkspace): void {
  const cache = { ...current.cache, state };
  saveWorkspaceCache(cache);
  current.cache = cache;
}
function mergeRecords(
  base: SyncRecord[],
  rows: { table: string; key: string; row: SyncRecord['row'] | null }[],
): SyncRecord[] {
  const records = new Map(base.map((row) => [identity(row), row]));
  for (const row of rows) {
    if (row.row === null) records.delete(identity(row));
    else
      records.set(identity(row), {
        table: row.table,
        key: row.key,
        row: row.row,
      });
  }
  return Array.from(records.values());
}
async function jsonRequest<T>(
  url: string,
  route: string,
  token: string | null,
  body?: unknown,
): Promise<T> {
  const response = await serverRequest(url, route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return JSON.parse((await readBoundedResponse(response)).toString());
}
async function pull(
  url: string,
  token: string,
  instanceId: string,
  cursor: number,
  base: SyncRecord[],
) {
  let records = base;
  let initialized = false;
  for (let page = 0; page < 10_000; page++) {
    const result = await jsonRequest<{
      instanceId: string;
      cursor: number;
      initialized: boolean;
      changes: ServerRow[];
      hasMore?: boolean;
    }>(url, `/v2/changes?since=${cursor}`, token);
    if (result.instanceId !== instanceId)
      throw new Error(
        'Die Serverinstanz wurde geändert. Die lokale Arbeitskopie bleibt erhalten; bitte den Betreiber kontaktieren.',
      );
    if (
      !Number.isSafeInteger(result.cursor) ||
      result.cursor < cursor ||
      !Array.isArray(result.changes) ||
      typeof result.initialized !== 'boolean'
    )
      throw new Error('Ungültige Synchronisierungsantwort.');
    if (result.hasMore && result.cursor === cursor)
      throw new Error('Die Synchronisierung kommt nicht voran.');
    records = mergeRecords(records, result.changes);
    cursor = result.cursor;
    initialized = result.initialized;
    if (!result.hasMore) return { records, cursor, initialized };
  }
  throw new Error('Zu viele Synchronisierungsseiten. Bitte erneut synchronisieren.');
}
function stopTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
function scheduleSync(delay = 250): void {
  if (!session) return;
  stopTimer();
  timer = setTimeout(() => {
    timer = null;
    void refreshServer();
  }, delay);
  timer.unref?.();
}
function setFailure(current: Session, failure: unknown): void {
  const status = failure instanceof ServerRequestError ? failure.status : -1;
  current.status =
    status === 0
      ? 'offline'
      : [401, 403].includes(status)
        ? 'auth-required'
        : [409, 422].includes(status)
          ? 'conflict'
          : 'error';
  current.error = failure instanceof Error ? failure.message : 'Synchronisierung fehlgeschlagen.';
  // This state must survive a restart, especially an unresolved rejected transaction.
  commit(current, {
    ...current.cache.state,
    syncStatus: current.status,
    syncError: current.error,
  });
}

export async function connectServer(
  input: ConnectServerInput,
  localUnlocked: boolean,
): Promise<ServerConnection> {
  const url = normalizeServerUrl(input.url);
  const username = input.username.trim();
  if (input.initialize && (isServerMode() || !localUnlocked || !isDbOpen()))
    throw new Error('Zum Übertragen zuerst den lokalen Bestand öffnen.');
  let cache = loadWorkspaceCache(url, username);
  let token: string | null = null;
  try {
    if (input.offline) {
      if (input.initialize || !cache)
        throw new Error(
          'Für dieses Konto ist keine lokale Serverkopie vorhanden. Bitte einmal online anmelden.',
        );
      if (!verifyOfflinePassword(cache, input.password))
        throw new Error('Das Passwort der letzten erfolgreichen Anmeldung stimmt nicht.');
    } else {
      const deviceId = cache?.state.deviceId ?? randomUUID();
      const login = await jsonRequest<{
        protocol: number;
        token: string;
        role: ServerRole;
        instanceId: string;
        deviceSlot: number;
      }>(url, '/v2/login', null, {
        username,
        password: input.password,
        deviceId,
      });
      if (
        login.protocol !== 2 ||
        !/^[A-Za-z0-9_-]{43}$/.test(login.token) ||
        !['reader', 'editor', 'admin'].includes(login.role) ||
        typeof login.instanceId !== 'string' ||
        !Number.isSafeInteger(login.deviceSlot) ||
        login.deviceSlot < 1 ||
        login.deviceSlot > 1_000_000
      )
        throw new Error(
          'Dieser Server unterstützt die Änderungssynchronisierung nicht. Bitte zuerst den Server aktualisieren.',
        );
      token = login.token;
      if (input.initialize && login.role !== 'admin')
        throw new Error('Nur ein Administratorkonto darf den lokalen Bestand auf einen leeren Server übertragen.');
      if (cache) {
        if (
          cache.state.instanceId !== login.instanceId ||
          cache.state.deviceSlot !== login.deviceSlot
        )
          throw new Error(
            'Die Serverinstanz oder Gerätezuordnung wurde geändert. Die lokale Arbeitskopie bleibt erhalten.',
          );
        if (input.initialize)
          throw new Error(
            'Für dieses Konto gibt es bereits eine Arbeitskopie. Bitte den Serverbestand öffnen.',
          );
        cache = {
          ...cache,
          state: {
            ...cache.state,
            role: login.role,
            ...passwordProof(input.password),
          },
        };
      } else {
        const loaded = await pull(url, token, login.instanceId, 0, []);
        if (input.initialize && loaded.initialized)
          throw new Error(
            'Der Server enthält bereits Daten. Der lokale Bestand wurde nicht übertragen.',
          );
        if (!input.initialize && !loaded.initialized)
          throw new Error('Der Server ist leer. Bitte zuerst den lokalen Bestand übertragen.');
        const localRecords = input.initialize ? captureRecords(getDb()) : loaded.records;
        const bytes = createSyncDatabase(
          localRecords,
        !isServerMode() && isDbOpen() ? captureLocalSettings(getDb()) : undefined,
        );
        cache = createWorkspaceCache({
          format: 2,
          url,
          username,
          instanceId: login.instanceId,
          deviceId,
          deviceSlot: login.deviceSlot,
          role: login.role,
          cursor: loaded.cursor,
          initialized: loaded.initialized,
          database: bytes.toString('base64'),
          base: loaded.records,
          pending: input.initialize
            ? [
                {
                  id: randomUUID(),
                  instanceId: login.instanceId,
                  initialize: true,
                  changes: diffRecords([], localRecords),
                },
              ]
            : [],
          ...passwordProof(input.password),
          syncStatus: input.initialize ? 'pending' : 'synced',
        });
      }
    }
    const next: Session = {
      cache: cache!,
      token,
      status: input.offline
        ? 'offline'
        : cache!.state.syncStatus === 'conflict'
          ? 'conflict'
          : cache!.state.pending.length
            ? 'pending'
            : 'synced',
      error: cache!.state.syncError,
    };
    const previous = session;
    if (!isServerMode()) flushDatabase();
    saveWorkspaceCache(next.cache);
    activateRemoteDatabase(Buffer.from(next.cache.state.database, 'base64'), next.cache.key, () => {
      allocateDeviceIds(getDb(), next.cache.state.deviceSlot);
      saveConnection({
        mode: 'server',
        url,
        username,
        instanceId: next.cache.state.instanceId,
      });
      session = next;
      connectionEpoch++;
      dataVersion++;
      editing = false;
    });
    if (previous?.token)
      void serverRequest(previous.cache.state.url, '/v2/session', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${previous.token}` },
      }).catch((): void => undefined);
    scheduleSync(0);
    return getServerConnection();
  } catch (error) {
    if (token)
      void serverRequest(url, '/v2/session', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((): void => undefined);
    throw error;
  }
}

export async function lockServer(): Promise<void> {
  stopTimer();
  const previous = session;
  session = null;
  connectionEpoch++;
  editing = false;
  closeDb();
  setEncryptionKey(null);
  if (previous?.token)
    void serverRequest(previous.cache.state.url, '/v2/session', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${previous.token}` },
    }).catch((): void => undefined);
}
export async function useLocalConnection(): Promise<void> {
  const previous = storedConnection();
  saveConnection({
    mode: 'local',
    url: previous.url,
    username: previous.username,
    instanceId: previous.instanceId,
  });
  await lockServer();
  setRemoteDatabase(false);
}

export async function runServerOperation<T>(
  channel: string,
  operation: () => T | Promise<T>,
): Promise<T> {
  const current = session;
  if (!current) throw new Error('Bitte die lokale Serverkopie zuerst öffnen.');
  if (channel === 'backup:settings')
    return {
      folder: null,
      auto: 'off',
      keep: 10,
      lastBackupAt: null,
      backups: [],
    } as T;
  if (
    channel.startsWith('backup:') ||
    [
      'db:import',
      'db:delete',
      'staff:prepareImport',
      'staff:commitImport',
      'data:openDocument',
    ].includes(channel)
  )
    throw new Error('Diese lokale Funktion ist für den gemeinsamen Bestand nicht verfügbar.');
  if (current.cache.state.role === 'reader' && !readerActions.has(channel))
    throw new Error('Dieses Konto darf nur lesen.');
  const before = getDb().serialize();
  const records = captureRecords(getDb());
  try {
    const value = await operation();
    const after = getDb().serialize();
    if (!before.equals(after)) {
      const changes = diffRecords(records, captureRecords(getDb()));
      if (changes.length && current.cache.state.role === 'reader')
        throw new Error('Dieses Konto darf nur lesen.');
      const pending = changes.length
        ? [
            ...current.cache.state.pending,
            {
              id: randomUUID(),
              instanceId: current.cache.state.instanceId,
              initialize: false,
              changes,
            },
          ]
        : current.cache.state.pending;
      commit(current, {
        ...current.cache.state,
        database: after.toString('base64'),
        pending,
      });
      if (!['conflict', 'auth-required'].includes(current.status))
        current.status = pending.length ? 'pending' : current.status;
      scheduleSync();
    }
    return value;
  } catch (error) {
    restoreMemorySnapshot(before);
    allocateDeviceIds(getDb(), current.cache.state.deviceSlot);
    throw error;
  }
}

async function synchronize(current: Session): Promise<void> {
  if (!current.token) {
    current.status = 'offline';
    return;
  }
  if (current.status === 'conflict' || current.status === 'auth-required') return;
  current.status = 'syncing';
  current.error = undefined;
  try {
    // New edits may arrive during any network await. Always acknowledge only the sent UUID.
    for (let sent = 0; sent < 100; sent++) {
      const state = await withConnectionLock(() =>
        session === current ? current.cache.state : null,
      );
      if (!state) return;
      const transaction = state.pending[0];
      if (!transaction) break;
      await jsonRequest(state.url, '/v2/transactions', current.token, transaction);
      await withConnectionLock(() => {
        if (session !== current) return;
        const latest = current.cache.state;
        commit(current, {
          ...latest,
          initialized: true,
          base: mergeRecords(
            latest.base,
            transaction.changes.map((change) => ({
              ...change,
              row: change.after,
            })),
          ),
          pending: latest.pending.filter((item) => item.id !== transaction.id),
        });
      });
    }
    const state = await withConnectionLock(() =>
      session === current ? current.cache.state : null,
    );
    if (!state) return;
    const loaded = await pull(state.url, current.token, state.instanceId, state.cursor, state.base);
    await withConnectionLock(() => {
      if (session !== current) return;
      const latest = current.cache.state;
      // Keep the edit's original comparison state until it is saved/cancelled.
      if (latest.pending.length || editing) {
        current.status = latest.pending.length ? 'pending' : 'synced';
        return;
      }
      const changed = diffRecords(latest.base, loaded.records).length > 0;
      let bytes = getDb().serialize();
      if (changed)
        bytes = createSyncDatabase(
          loaded.records,
          captureLocalSettings(getDb()),
          captureDeviceCounters(getDb()) ?? undefined,
        );
      commit(current, {
        ...latest,
        base: loaded.records,
        cursor: loaded.cursor,
        initialized: loaded.initialized,
        database: bytes.toString('base64'),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'synced',
        syncError: undefined,
      });
      if (changed) {
        restoreMemorySnapshot(bytes);
        allocateDeviceIds(getDb(), latest.deviceSlot);
        dataVersion++;
      }
      current.status = 'synced';
    });
  } catch (error) {
    await withConnectionLock(() => {
      if (session === current) {
        try {
          setFailure(current, error);
        } catch {
          current.status = 'error';
          current.error =
            'Der lokale Synchronisierungszustand konnte nicht gespeichert werden. Die vorgemerkten Änderungen bleiben erhalten.';
        }
      }
    });
  }
}
export async function refreshServer(): Promise<void> {
  const current = session;
  if (!current) return;
  if (syncing?.session === current) return syncing.promise;
  stopTimer();
  const promise = synchronize(current).finally(() => {
    if (syncing?.session !== current) return;
    syncing = null;
    if (session === current) scheduleSync(current.status === 'offline' ? 10_000 : 3_000);
  });
  syncing = { session: current, promise };
  return promise;
}

export async function resolveServerConflict(choice: 'server' | 'local'): Promise<void> {
  if (!['server', 'local'].includes(choice)) throw new Error('Ungültige Konfliktentscheidung.');
  const current = session;
  if (!current?.token || !['conflict', 'auth-required'].includes(current.status))
    throw new Error('Bitte zuerst online anmelden und den Konflikt prüfen.');
  if (choice === 'local' && current.cache.state.role === 'reader')
    throw new Error('Dieses Konto darf lokale Änderungen nicht auf dem Server speichern.');
  const snapshot = current.cache.state;
  const loaded = await pull(snapshot.url, current.token, snapshot.instanceId, 0, []);
  await withConnectionLock(() => {
    if (session !== current || current.cache.state !== snapshot)
      throw new Error(
        'Der lokale Bestand wurde inzwischen geändert. Bitte die Entscheidung erneut prüfen.',
      );
    preserveWorkspaceRecovery(current.cache);
    const records =
      choice === 'server'
        ? loaded.records
        : mergeRecords(
            loaded.records,
            snapshot.pending.flatMap((transaction) =>
              transaction.changes.map((change) => ({
                ...change,
                row: change.after,
              })),
            ),
          );
    const changes = diffRecords(loaded.records, records);
    const bytes = createSyncDatabase(
      records,
      captureLocalSettings(getDb()),
      captureDeviceCounters(getDb()) ?? undefined,
    );
    const pending = changes.length
      ? [
          {
            id: randomUUID(),
            instanceId: snapshot.instanceId,
            initialize: false,
            changes,
          },
        ]
      : [];
    commit(current, {
      ...snapshot,
      base: loaded.records,
      cursor: loaded.cursor,
      database: bytes.toString('base64'),
      pending,
      syncStatus: pending.length ? 'pending' : 'synced',
      syncError: undefined,
    });
    restoreMemorySnapshot(bytes);
    allocateDeviceIds(getDb(), snapshot.deviceSlot);
    current.status = pending.length ? 'pending' : 'synced';
    current.error = undefined;
    dataVersion++;
  });
  await refreshServer();
}
