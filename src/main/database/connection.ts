/**
 * Database connection management
 *
 * Handles SQLite database lifecycle: open, close, encrypt/decrypt
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { StorageMode } from '../../shared/types';
import { getConfigPath, getDataDir, getEncryptedDbPath, getWorkingDbPath } from '../appPaths';

import { runMigrations, CURRENT_SCHEMA_VERSION } from './migrations';
import { randomUUID } from 'crypto';
import { writeAtomic } from '../atomicFile';
import { decodeBackup, encodeBackup } from '../backupFormat';
import { encryptBuffer } from '../crypto';

// Database state
let db: DatabaseType | null = null;
let encryptionKey: Buffer | null = null;
let storageMode: StorageMode = 'encrypted';
let remoteDatabase = false;

/** Remote snapshots live only in memory; local persistence must never receive them. */
export const setRemoteDatabase = (value: boolean): void => { remoteDatabase = value; };
export const isRemoteDatabase = (): boolean => remoteDatabase;

/**
 * Get the current database instance
 * @throws Error if database is not open
 */
export const getDb = (): DatabaseType => {
  if (!db) {
    throw new Error('Datenbank ist nicht geöffnet.');
  }
  return db;
};

/**
 * Check if database is currently open
 */
export const isDbOpen = (): boolean => db !== null;

/**
 * Set the encryption key for database operations
 */
export const setEncryptionKey = (key: Buffer | null): void => {
  encryptionKey = key;
};

/**
 * Get the current encryption key
 */
export const getEncryptionKey = (): Buffer | null => encryptionKey;

/**
 * Set current storage mode
 */
export const setStorageMode = (mode: StorageMode): void => {
  storageMode = mode;
};

/**
 * Get current storage mode
 */
export const getStorageMode = (): StorageMode => storageMode;

/**
 * Remove only the encrypted database snapshot
 */
export const deleteEncryptedSnapshot = (): void => {
  const encryptedDbPath = getEncryptedDbPath();
  if (fs.existsSync(encryptedDbPath)) {
    fs.rmSync(encryptedDbPath, { force: true });
  }
};

/**
 * Ensure the data directory exists
 */
export const ensureDataDir = (): void => {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

/**
 * Encode a snapshot in the legacy-compatible encrypted database format.
 */
const encryptSnapshot = (bytes: Buffer): Buffer => {
  if (!encryptionKey) throw new Error('Datenbank ist gesperrt.');
  const { iv, tag, content } = encryptBuffer(bytes, encryptionKey);
  return Buffer.concat([iv, tag, content]);
};

/** Persist without closing: every successful data IPC writes an encrypted snapshot. */
export const flushDatabase = (): void => {
  if (remoteDatabase) return;
  if (!db || storageMode !== 'encrypted') return;
  writeAtomic(getEncryptedDbPath(), encryptSnapshot(db.serialize()));
};

export const restoreMemorySnapshot = (bytes: Buffer): void => {
  if (storageMode !== 'encrypted') return;
  const candidate = new Database(bytes);
  candidate.pragma('foreign_keys = ON');
  closeDb();
  db = candidate;
};

/** Prepare SQLite before committing the selection, and roll back memory if that commit fails. */
export const activateRemoteDatabase = (bytes: Buffer, key: Buffer, saveSelection: () => void): void => {
  const candidate = new Database(bytes);
  try { candidate.pragma('foreign_keys = ON'); }
  catch (error) { candidate.close(); throw error; }
  const previous = { db, encryptionKey, storageMode, remoteDatabase };
  db = candidate;
  encryptionKey = key;
  storageMode = 'encrypted';
  remoteDatabase = true;
  try {
    saveSelection();
  } catch (error) {
    db = previous.db;
    encryptionKey = previous.encryptionKey;
    storageMode = previous.storageMode;
    remoteDatabase = previous.remoteDatabase;
    candidate.close();
    throw error;
  }
  previous.db?.close();
};

export const openDatabase = (options: { create?: boolean } = {}): void => {
  if (db) return;
  if (remoteDatabase) throw new Error('Bitte zuerst mit dem Server verbinden.');
  ensureDataDir();
  const working = getWorkingDbPath();
  const encrypted = getEncryptedDbPath();
  if (storageMode === 'encrypted' && !encryptionKey) throw new Error('Datenbank ist gesperrt.');
  if (storageMode === 'plain' && !fs.existsSync(working) && fs.existsSync(encrypted)) {
    throw new Error(
      'Nur eine verschlüsselte Datenbank vorhanden. Bitte mit dem ursprünglichen Schlüssel öffnen.',
    );
  }
  let bytes: Buffer | undefined;
  if (fs.existsSync(working)) {
    const source = new Database(working, { readonly: true, fileMustExist: true });
    try {
      bytes = source.serialize();
    } finally {
      source.close();
    }
  } else if (fs.existsSync(encrypted))
    bytes = decodeBackup(fs.readFileSync(encrypted), encryptionKey);
  if (!bytes && fs.existsSync(getConfigPath()) && !options.create) {
    throw new Error(
      'Die vorhandene Konfiguration hat keine lesbare Datenbank. Es wurde kein neuer Bestand angelegt.',
    );
  }
  const candidate = new Database(bytes?.length ? bytes : ':memory:');
  try {
    const hasSettings = candidate
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
      .get();
    const version = hasSettings
      ? Number(
          (
            candidate.prepare("SELECT value FROM settings WHERE key='schema_version'").get() as
              | { value?: string }
              | undefined
          )?.value ?? 0,
        )
      : 0;
    if (version > CURRENT_SCHEMA_VERSION)
      throw new Error('Diese Datenbank benötigt eine neuere App-Version.');
    if (bytes?.length) {
      if (candidate.pragma('quick_check', { simple: true }) !== 'ok')
        throw new Error('Die vorhandene Datenbank ist beschädigt.');
      if (
        !hasSettings ||
        !candidate
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'")
          .get()
      )
        throw new Error('Die vorhandene Datei ist keine ClearDeck-Datenbank.');
      if (version < CURRENT_SCHEMA_VERSION) {
        writeAtomic(
          path.join(getDataDir(), 'backups', `before-migration-${randomUUID()}.cdb`),
          encodeBackup(bytes, encryptionKey),
        );
      }
    }
    // Both storage modes migrate a separate in-memory candidate. A failed
    // migration cannot leave the user's original database half converted.
    runMigrations(candidate);
    if ((candidate.pragma('foreign_key_check') as unknown[]).length)
      throw new Error('Die Datenbank enthält ungültige Verknüpfungen.');
    const migrated = candidate.serialize();
    if (storageMode === 'encrypted') {
      writeAtomic(encrypted, encryptSnapshot(migrated));
      db = candidate;
      for (const suffix of ['', '-wal', '-shm', '-journal'])
        fs.rmSync(`${working}${suffix}`, { force: true });
    } else {
      // A legacy WAL can contain newer data than its main file. Materialize
      // that unchanged state before replacing the file, never delete the WAL.
      if (fs.existsSync(`${working}-wal`)) {
        const source = new Database(working);
        try {
          source.pragma('wal_checkpoint(TRUNCATE)');
        } finally {
          source.close();
        }
      }
      writeAtomic(working, migrated);
      db = new Database(working);
      db.pragma('foreign_keys = ON');
      candidate.close();
    }
  } catch (error) {
    if (candidate.open) candidate.close();
    db = null;
    const detail = error instanceof Error ? error.message : 'Unbekannter Fehler';
    throw new Error(`Datenbank konnte nicht geöffnet oder aktualisiert werden. ${detail}`);
  }
};

/** Validate a complete import in isolation. Never changes the live connection. */
export const validateDatabase = (bytes: Buffer): Buffer => {
  const candidate = new Database(bytes);
  try {
    if (candidate.pragma('quick_check', { simple: true }) !== 'ok')
      throw new Error('SQLite-Integritätsprüfung fehlgeschlagen.');
    for (const table of ['employees', 'employment_periods', 'settings']) {
      if (
        !candidate
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .get(table)
      ) {
        throw new Error('Die Datei ist keine ClearDeck-Datenbank.');
      }
    }
    const version = candidate
      .prepare("SELECT value FROM settings WHERE key='schema_version'")
      .get() as { value?: string } | undefined;
    if (Number(version?.value ?? 0) > CURRENT_SCHEMA_VERSION)
      throw new Error('Diese Sicherung benötigt eine neuere App-Version.');
    runMigrations(candidate);
    if ((candidate.pragma('foreign_key_check') as unknown[]).length)
      throw new Error('Die Sicherung enthält ungültige Datenverknüpfungen.');
    return candidate.serialize();
  } finally {
    candidate.close();
  }
};

/** Input has already been validated; preserve the live state if installation fails. */
export const replaceDatabase = (bytes: Buffer): void => {
  if (remoteDatabase) throw new Error('Lokaler Import ist im Serverbetrieb nicht verfügbar.');
  const previous = getDb().serialize();
  const candidate = new Database(bytes);
  candidate.pragma('foreign_keys = ON');
  if (storageMode === 'encrypted') {
    try {
      writeAtomic(getEncryptedDbPath(), encryptSnapshot(bytes));
    } catch (error) {
      candidate.close();
      throw error;
    }
    closeDb();
    db = candidate;
    fs.rmSync(getWorkingDbPath(), { force: true });
    return;
  }
  candidate.close();
  closeDb();
  let installed = false;
  try {
    writeAtomic(getWorkingDbPath(), bytes);
    installed = true;
    db = new Database(getWorkingDbPath());
    db.pragma('foreign_keys = ON');
  } catch (error) {
    if (installed) writeAtomic(getWorkingDbPath(), previous);
    db = new Database(getWorkingDbPath());
    db.pragma('foreign_keys = ON');
    throw error;
  }
};

export const persistEncryptedDb = (): void => {
  flushDatabase();
  closeDb();
};

/**
 * Ensure database is ready for operations
 * @throws Error if not unlocked
 */
export const ensureDbReady = (unlocked: boolean): void => {
  if (!unlocked) {
    throw new Error('Bitte zuerst anmelden.');
  }
  if (storageMode === 'encrypted' && !encryptionKey) {
    throw new Error('Bitte zuerst anmelden.');
  }
  if (!db) {
    openDatabase();
  }
};

/**
 * Close database without encrypting (for cleanup)
 */
export const closeDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};

/**
 * Delete all database files
 */
export const deleteDatabase = (): void => {
  if (remoteDatabase) throw new Error('Lokales Löschen ist im Serverbetrieb nicht verfügbar.');
  const encryptedDbPath = getEncryptedDbPath();
  const workingDbPath = getWorkingDbPath();
  closeDb();
  if (fs.existsSync(encryptedDbPath)) {
    fs.rmSync(encryptedDbPath, { force: true });
  }
  if (fs.existsSync(workingDbPath)) {
    fs.rmSync(workingDbPath, { force: true });
  }
};

/**
 * Create a backup of the database
 * @returns Path to the backup file
 */
export const backupDatabase = (): string => {
  if (remoteDatabase) throw new Error('Lokale Sicherheitskopien sind im Serverbetrieb nicht verfügbar.');
  const dataDir = getDataDir();
  ensureDataDir();
  const backupsDir = path.join(dataDir, 'backups');
  const target = path.join(backupsDir, `safety-${randomUUID()}.cdb`);
  writeAtomic(target, encodeBackup(getDb().serialize(), getEncryptionKey()));
  return target;
};

export { getDataDir, getEncryptedDbPath, getWorkingDbPath };
