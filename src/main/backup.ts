/**
 * Backups into a folder the user picks — typically a NAS share.
 *
 * A backup is a snapshot of the live database, sealed with the same data key as
 * the local one. Naming is `cleardeck-<date>_<time>.cdb`, which sorts
 * chronologically and is what the retention prune relies on.
 */

import { dialog } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { decryptFile, encryptFile } from './crypto';
import { getEncryptedDbPath, getWorkingDbPath } from './appPaths';
import {
  closeDb,
  getDb,
  getEncryptionKey,
  getStorageMode,
  isDbOpen,
  openDatabase,
} from './database/connection';
import {
  getBackupSettings,
  setBackupSettings,
  type AutoBackupMode,
  type BackupSettings,
} from './repositories/settings';

export const BACKUP_EXTENSION = '.cdb';

export interface BackupFile {
  file: string;
  path: string;
  size: number;
  modifiedAt: string;
}

export interface BackupResult {
  saved: boolean;
  file?: string;
  error?: string;
}

const stamp = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;

export const listBackups = (folder: string | null): BackupFile[] => {
  if (!folder || !fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(BACKUP_EXTENSION))
    .map((name) => {
      const full = path.join(folder, name);
      const stats = fs.statSync(full);
      return { file: name, path: full, size: stats.size, modifiedAt: stats.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
};

/** Keep the newest `keep` files; the rest go. */
const prune = (folder: string, keep: number): void => {
  listBackups(folder)
    .slice(keep)
    .forEach((backup) => fs.rmSync(backup.path, { force: true }));
};

export const chooseBackupFolder = async (): Promise<string | null> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Backup-Ordner wählen',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || filePaths.length === 0) return null;
  setBackupSettings({ folder: filePaths[0] });
  return filePaths[0];
};

/**
 * Snapshot the open database into the backup folder.
 *
 * Uses SQLite's online backup so the running app is not interrupted, and
 * awaits it — the copy is only complete once the promise resolves.
 */
export const runBackup = async (): Promise<BackupResult> => {
  const settings = getBackupSettings();
  if (!settings.folder) {
    return { saved: false, error: 'Es ist kein Backup-Ordner eingestellt.' };
  }
  if (!isDbOpen()) {
    return { saved: false, error: 'Die Datenbank ist nicht geöffnet.' };
  }

  const temporary = path.join(os.tmpdir(), `cleardeck-backup-${Date.now()}.db`);
  const target = path.join(settings.folder, `cleardeck-${stamp(new Date())}${BACKUP_EXTENSION}`);

  try {
    fs.mkdirSync(settings.folder, { recursive: true });
    await getDb().backup(temporary);

    const key = getEncryptionKey();
    if (getStorageMode() === 'encrypted' && key) {
      encryptFile(temporary, target, key);
    } else {
      fs.copyFileSync(temporary, target);
    }

    prune(settings.folder, settings.keep);
    setBackupSettings({ lastBackupAt: new Date().toISOString() });
    return { saved: true, file: path.basename(target) };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Das Backup konnte nicht geschrieben werden.';
    return { saved: false, error: message };
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};

const MS_PER_DAY = 86_400_000;

/**
 * Whether an automatic backup is due.
 *
 * Evaluated when the app closes rather than on a timer: a desktop app that is
 * open all day would otherwise back up at an arbitrary moment, and one that is
 * never open would never fire the timer at all.
 */
export const isAutoBackupDue = (
  settings: Pick<BackupSettings, 'auto' | 'folder' | 'lastBackupAt'>,
  now: Date = new Date(),
): boolean => {
  if (!settings.folder || settings.auto === 'off') return false;
  if (settings.auto === 'close') return true;
  if (!settings.lastBackupAt) return true;

  const elapsed = now.getTime() - new Date(settings.lastBackupAt).getTime();
  const interval: Record<Exclude<AutoBackupMode, 'off' | 'close'>, number> = {
    daily: MS_PER_DAY,
    weekly: 7 * MS_PER_DAY,
  };
  return elapsed >= interval[settings.auto];
};

/** Called on shutdown; never throws, so a missing NAS cannot block the quit. */
export const runAutoBackupIfDue = async (): Promise<void> => {
  try {
    if (!isDbOpen()) return;
    if (!isAutoBackupDue(getBackupSettings())) return;
    await runBackup();
  } catch {
    // A failed backup is recorded by the caller's diagnostics, not fatal here.
  }
};

/**
 * Replace the local database with a backup from the folder.
 *
 * A safety copy is written first, so a restore of the wrong file is itself
 * undoable. Backups are sealed with the data key rather than the password —
 * and a password change re-wraps that same key — so every backup this
 * installation wrote opens with the current session, no password prompt needed.
 */
export const restoreBackup = async (source: string): Promise<BackupResult> => {
  if (!fs.existsSync(source)) {
    return { saved: false, error: 'Die gewählte Sicherung ist nicht mehr vorhanden.' };
  }

  const safety = await runBackup();
  if (!safety.saved) {
    return { saved: false, error: `Sicherheits-Backup fehlgeschlagen: ${safety.error ?? 'unbekannt'}` };
  }

  const key = getEncryptionKey();
  const encrypted = getStorageMode() === 'encrypted';
  if (encrypted && !key) {
    return { saved: false, error: 'Bitte zuerst anmelden.' };
  }

  try {
    closeDb();
    const working = getWorkingDbPath();
    fs.rmSync(working, { force: true });
    fs.rmSync(getEncryptedDbPath(), { force: true });

    if (encrypted && key) {
      decryptFile(source, working, key);
    } else {
      fs.copyFileSync(source, working);
    }

    openDatabase();
    return { saved: true, file: path.basename(source) };
  } catch (err) {
    // The working copy is gone at this point; reopening rebuilds an empty one
    // rather than leaving the app without a database at all.
    try {
      openDatabase();
    } catch {
      // Surfaced through the error below.
    }
    const message =
      err instanceof Error ? err.message : 'Die Sicherung konnte nicht wiederhergestellt werden.';
    return { saved: false, error: message };
  }
};
