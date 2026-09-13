import fs from 'fs';
import path from 'path';
import { getDataDir } from './appPaths';
import { writeAtomic } from './atomicFile';
import { parseRecoveryKey } from './crypto';
import { encodeBackup, decodeBackup } from './backupFormat';
import {
  activateRemoteDatabase, closeDb, flushDatabase, getDb, getEncryptionKey, isDbOpen,
  restoreMemorySnapshot, setEncryptionKey, setRemoteDatabase, validateDatabase,
} from './database/connection';
import { normalizeServerUrl, serverRequest, readBoundedResponse, MAX_SERVER_SNAPSHOT } from './serverTransport';
import type { ConnectServerInput, ServerConnection } from '../shared/serverConnection';

type Session = { token: string; revision: number; instanceId: string; role: 'reader' | 'editor'; url: string };
let session: Session | null = null;
let queue: Promise<unknown> = Promise.resolve();
let connectionEpoch = 0;
const configPath = () => path.join(getDataDir(), 'server.json');

/** Data requests, login, locking and switching all share this queue. */
export function withConnectionLock<T>(operation: () => T | Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch((): void => undefined);
  return result;
}

/** An operation submitted by the old screen must never target a newly selected database. */
export function withCurrentConnection<T>(operation: () => T | Promise<T>): Promise<T> {
  const expected = connectionEpoch;
  return withConnectionLock(() => {
    if (expected !== connectionEpoch) {
      throw new Error('Die Datenablage wurde gewechselt oder neu geladen. Bitte die Aktion im aktuellen Bestand erneut ausführen.');
    }
    return operation();
  });
}

export function getServerConnection(): ServerConnection {
  let stored: ServerConnection = { mode: 'local' };
  try {
    const input = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (!input || !['local', 'server'].includes(input.mode)) throw new Error('invalid');
    if (input.mode === 'server' && (typeof input.username !== 'string' || typeof input.instanceId !== 'string')) throw new Error('invalid');
    stored = {
      mode: input.mode,
      ...(input.url ? { url: normalizeServerUrl(input.url), username: input.username, instanceId: input.instanceId } : {}),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error('Die Serverkonfiguration ist beschädigt. Es wird nicht automatisch auf den lokalen Bestand gewechselt.');
    }
  }
  return { ...stored, connected: !!session, ...(session ? { role: session.role } : {}) };
}

export const isServerMode = (): boolean => getServerConnection().mode === 'server';
export const isServerConnected = (): boolean => !!session;

const saveConnection = (config: ServerConnection) => {
  fs.mkdirSync(getDataDir(), { recursive: true });
  writeAtomic(configPath(), Buffer.from(JSON.stringify(config)));
};

function revisionOf(response: Response): number {
  const match = /^"(\d{1,9})"$/.exec(response.headers.get('etag') ?? '');
  if (!match) throw new Error('Der Server liefert keine gültige Bestandsversion.');
  return Number(match[1]);
}

async function revoke(current: Session | null) {
  if (current) await serverRequest(current.url, '/v1/session', {
    method: 'DELETE', headers: { Authorization: `Bearer ${current.token}` },
  }).catch((): void => undefined);
}

async function putSnapshot(current: Session, bytes: Buffer, key: Buffer): Promise<number> {
  const payload = encodeBackup(bytes, key);
  if (payload.length > MAX_SERVER_SNAPSHOT) throw new Error('Der Datenbestand überschreitet 32 MiB.');
  const response = await serverRequest(current.url, '/v1/snapshot', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${current.token}`, 'Content-Type': 'application/octet-stream',
      'If-Match': `"${current.revision}"`, 'X-ClearDeck-Instance': current.instanceId,
    },
    body: new Uint8Array(payload),
  });
  const result = JSON.parse((await readBoundedResponse(response, 8192)).toString());
  if (result.revision !== current.revision + 1) throw new Error('Unklare Speicherbestätigung. Bitte den Serverbestand neu laden.');
  return result.revision;
}

export async function connectServer(input: ConnectServerInput, localUnlocked: boolean): Promise<ServerConnection> {
  const url = normalizeServerUrl(input.url);
  const key = parseRecoveryKey(input.dataKey);
  const existing = getServerConnection();
  if (input.initialize && (existing.mode !== 'local' || !localUnlocked || !isDbOpen())) {
    throw new Error('Zum Übertragen zuerst den lokalen Bestand öffnen.');
  }
  const login = await serverRequest(url, '/v1/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: input.username, password: input.password }),
  });
  const result = JSON.parse((await readBoundedResponse(login, 8192)).toString());
  if (result.protocol !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(result.token) ||
    typeof result.instanceId !== 'string' || !['reader', 'editor'].includes(result.role)) {
    throw new Error('Dieser Server unterstützt das ClearDeck-Protokoll nicht.');
  }
  const next: Session = { url, token: result.token, revision: 0, instanceId: result.instanceId, role: result.role };
  try {
    if (existing.mode === 'server' && existing.url === url && existing.instanceId !== next.instanceId) {
      throw new Error('Unter dieser Adresse antwortet eine andere Serverinstanz. Zuerst zum lokalen Betrieb wechseln und den neuen Server ausdrücklich verbinden.');
    }
    const response = await serverRequest(url, '/v1/snapshot', { headers: { Authorization: `Bearer ${next.token}` } });
    next.revision = revisionOf(response);
    if (response.headers.get('x-cleardeck-instance') !== next.instanceId) throw new Error('Die Serverinstanz hat sich geändert.');
    let bytes: Buffer;
    if (next.revision === 0) {
      await response.body?.cancel();
      if (!input.initialize) throw new Error('Der Server ist leer. Den lokalen Bestand ausdrücklich übertragen oder den Betreiber kontaktieren.');
      bytes = getDb().serialize();
      next.revision = await putSnapshot(next, bytes, key);
    } else {
      if (input.initialize) throw new Error('Der Server enthält bereits Daten. Der lokale Bestand wurde nicht übertragen.');
      const payload = await readBoundedResponse(response);
      if (!/^CLEARDECK-BACKUP-1:[a-f0-9]{64}\n/.test(payload.subarray(0, 84).toString())) throw new Error('Der Server liefert keinen verschlüsselten Bestand.');
      const original = decodeBackup(payload, key);
      bytes = validateDatabase(original);
      // Migrations are themselves conditional writes and may not happen for readers.
      if (!bytes.equals(original)) next.revision = await putSnapshot(next, bytes, key);
    }
    if (existing.mode === 'local') flushDatabase();
    const previous = session;
    activateRemoteDatabase(bytes, key, () => {
      saveConnection({ mode: 'server', url, username: input.username, instanceId: next.instanceId });
      session = next;
      connectionEpoch++;
    });
    void revoke(previous);
    return getServerConnection();
  } catch (error) { void revoke(next); throw error; }
}

export async function lockServer(): Promise<void> {
  const previous = session;
  session = null;
  connectionEpoch++;
  closeDb();
  setEncryptionKey(null);
  void revoke(previous);
}

export async function useLocalConnection(): Promise<void> {
  // Write the selection first. A filesystem error must not leave a half-switched session.
  const previous = getServerConnection();
  saveConnection({ mode: 'local', url: previous.url, username: previous.username, instanceId: previous.instanceId });
  await lockServer();
  setRemoteDatabase(false);
}

/** Freeze the loaded revision until explicit reload; never silently rebase an open edit form. */
export async function runServerOperation<T>(channel: string, operation: () => T | Promise<T>): Promise<T> {
  const current = session;
  if (!current) throw new Error('Bitte zuerst mit dem Server verbinden.');
  if (channel === 'backup:settings') return { folder: null, auto: 'off', keep: 10, lastBackupAt: null, backups: [] } as T;
  if (channel.startsWith('backup:') || ['db:import', 'db:delete', 'staff:prepareImport', 'staff:commitImport', 'data:openDocument'].includes(channel)) {
    throw new Error('Diese lokale Funktion ist im Serverbetrieb nicht verfügbar. Sicherungen können über den Datenexport heruntergeladen werden.');
  }
  const response = await serverRequest(current.url, '/v1/snapshot', {
    method: 'HEAD', headers: { Authorization: `Bearer ${current.token}` },
  });
  if (revisionOf(response) !== current.revision || response.headers.get('x-cleardeck-instance') !== current.instanceId) {
    throw new Error('Der Serverbestand wurde auf einem anderen Gerät geändert. Unter Einstellungen → Datenablage neu laden, bevor du weiterarbeitest.');
  }
  const before = getDb().serialize();
  try {
    const value = await operation();
    const after = getDb().serialize();
    if (!before.equals(after)) {
      if (current.role !== 'editor') throw new Error('Dieses Konto darf nur lesen.');
      current.revision = await putSnapshot(current, after, getEncryptionKey()!);
    }
    return value;
  } catch (error) { restoreMemorySnapshot(before); throw error; }
}

export async function refreshServer(): Promise<void> {
  if (!session) throw new Error('Bitte zuerst mit dem Server verbinden.');
  const response = await serverRequest(session.url, '/v1/snapshot', { headers: { Authorization: `Bearer ${session.token}` } });
  const revision = revisionOf(response);
  if (response.headers.get('x-cleardeck-instance') !== session.instanceId || revision === 0) throw new Error('Die Serverinstanz wurde geändert oder geleert. Bitte erneut verbinden.');
  const payload = await readBoundedResponse(response);
  if (!/^CLEARDECK-BACKUP-1:[a-f0-9]{64}\n/.test(payload.subarray(0, 84).toString())) throw new Error('Ungültiger verschlüsselter Datenbestand.');
  const original = decodeBackup(payload, getEncryptionKey());
  const bytes = validateDatabase(original);
  const next = { ...session, revision };
  if (!bytes.equals(original)) next.revision = await putSnapshot(next, bytes, getEncryptionKey()!);
  restoreMemorySnapshot(bytes);
  session = next;
  connectionEpoch++;
}
