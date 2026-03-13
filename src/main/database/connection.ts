/**
 * Database connection management
 *
 * Handles SQLite database lifecycle: open, close, encrypt/decrypt
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { StorageMode } from '../../shared/types';

import { runMigrations } from './migrations';
import { seedDatabase } from './seed';
import { encryptFile, decryptFile } from '../crypto';

// Paths
const dataDir = path.join(app.getPath('userData'), 'data');
const encryptedDbPath = path.join(dataDir, 'employee.db.enc');
const workingDbPath = path.join(dataDir, 'employee.db');

// Database state
let db: DatabaseType | null = null;
let encryptionKey: Buffer | null = null;
let storageMode: StorageMode = 'encrypted';

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
  if (fs.existsSync(encryptedDbPath)) {
    fs.rmSync(encryptedDbPath, { force: true });
  }
};

/**
 * Ensure the data directory exists
 */
export const ensureDataDir = (): void => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

/**
 * Ensure the working database file exists (decrypting from encrypted if needed)
 */
const ensureWorkingDb = (): void => {
  ensureDataDir();
  if (fs.existsSync(workingDbPath)) {
    return;
  }

  if (fs.existsSync(encryptedDbPath) && storageMode === 'encrypted' && encryptionKey) {
    decryptFile(encryptedDbPath, workingDbPath, encryptionKey);
  } else if (fs.existsSync(encryptedDbPath) && storageMode === 'plain') {
    throw new Error(
      'Konfiguration ist auf unverschlüsselte Daten gestellt, aber es wurde nur eine verschlüsselte Datenbank gefunden.',
    );
  } else if (!fs.existsSync(workingDbPath)) {
    fs.writeFileSync(workingDbPath, '');
  }
};

/**
 * Open the database connection and run migrations
 * @throws Error if encryption key is not set
 */
export const openDatabase = (): void => {
  if (storageMode === 'encrypted' && !encryptionKey) {
    throw new Error('Datenbank ist gesperrt.');
  }
  ensureWorkingDb();
  db = new Database(workingDbPath);
  runMigrations(db);
  seedDatabase(db);
};

/**
 * Close database and encrypt to disk
 */
export const persistEncryptedDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
  if (storageMode === 'plain') {
    return;
  }
  if (!encryptionKey) return;
  if (fs.existsSync(workingDbPath)) {
    encryptFile(workingDbPath, encryptedDbPath, encryptionKey);
    fs.rmSync(workingDbPath, { force: true });
  }
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
  ensureDataDir();
  ensureWorkingDb();
  const backupsDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const source = fs.existsSync(encryptedDbPath) ? encryptedDbPath : workingDbPath;
  const ext = path.extname(source) || '.db';
  const filename = `employee-backup-${Date.now()}${ext}`;
  const target = path.join(backupsDir, filename);
  fs.copyFileSync(source, target);
  return target;
};

// Re-export paths for use elsewhere
export { dataDir, encryptedDbPath, workingDbPath };
