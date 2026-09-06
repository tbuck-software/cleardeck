/**
 * Settings Repository
 *
 * Data access functions for application settings stored in the database.
 */

import { getDb } from '../database/connection';

/**
 * Get the base hours setting (default: 36)
 */
export const getBaseHours = (): number => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'baseHours'").get() as
    | { value?: string }
    | undefined;
  return row?.value ? Number(row.value) || 36 : 36;
};

/**
 * Set the base hours setting (clamped to 1-168)
 */
export const setBaseHours = (hours: number): number => {
  const db = getDb();
  const clamped = Math.max(1, Math.min(168, hours));
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('baseHours', ?)").run(
    String(clamped),
  );
  return clamped;
};

/**
 * Get hidden event types for upcoming events display
 * Returns array of event type strings that should be hidden
 */
export const getHiddenEventTypes = (): string[] => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'hiddenEventTypes'").get() as
    | { value?: string }
    | undefined;
  if (!row?.value) return [];
  try {
    return JSON.parse(row.value);
  } catch {
    return [];
  }
};

/**
 * Set hidden event types for upcoming events display
 */
export const setHiddenEventTypes = (types: string[]): string[] => {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('hiddenEventTypes', ?)").run(
    JSON.stringify(types),
  );
  return types;
};

/**
 * Interval between Pflegevisiten. The QPR sets no fixed number, so the service
 * picks one and the app measures against it; 90 days is the common choice.
 */
export const getVisitIntervalDays = (): number => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'visitIntervalDays'").get() as
    | { value?: string }
    | undefined;
  return row?.value ? Number(row.value) || 90 : 90;
};

export const setVisitIntervalDays = (days: number): number => {
  const db = getDb();
  const clamped = Math.max(7, Math.min(365, days));
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('visitIntervalDays', ?)").run(
    String(clamped),
  );
  return clamped;
};

/** How far ahead an upcoming Einweisung counts as "bald fällig". */
export const getInstructionReminderDays = (): number => {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'instructionReminderDays'")
    .get() as { value?: string } | undefined;
  return row?.value ? Number(row.value) || 30 : 30;
};

export const setInstructionReminderDays = (days: number): number => {
  const db = getDb();
  const clamped = Math.max(1, Math.min(365, days));
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('instructionReminderDays', ?)",
  ).run(String(clamped));
  return clamped;
};

export type AutoBackupMode = 'off' | 'close' | 'daily' | 'weekly';

export interface BackupSettings {
  folder: string | null;
  auto: AutoBackupMode;
  /** How many backups to keep in the folder; older ones are pruned. */
  keep: number;
  lastBackupAt: string | null;
  lastBackupError?: string | null;
}

const readSetting = (key: string): string | null => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value?: string }
    | undefined;
  return row?.value ?? null;
};

const writeSetting = (key: string, value: string | null): void => {
  const db = getDb();
  if (value == null) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return;
  }
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
};

const AUTO_MODES: AutoBackupMode[] = ['off', 'close', 'daily', 'weekly'];

export const getBackupSettings = (): BackupSettings => {
  const auto = readSetting('backupAuto');
  const keep = Number(readSetting('backupKeep'));
  return {
    folder: readSetting('backupFolder'),
    auto: AUTO_MODES.includes(auto as AutoBackupMode) ? (auto as AutoBackupMode) : 'off',
    keep: Number.isFinite(keep) && keep > 0 ? keep : 10,
    lastBackupAt: readSetting('backupLastAt'),
    lastBackupError: readSetting('backupLastError'),
  };
};

export const setBackupSettings = (next: Partial<BackupSettings>): BackupSettings => {
  if (next.folder !== undefined) writeSetting('backupFolder', next.folder);
  if (next.auto !== undefined) writeSetting('backupAuto', next.auto);
  if (next.keep !== undefined)
    writeSetting('backupKeep', String(Math.max(1, Math.min(365, next.keep))));
  if (next.lastBackupError !== undefined) writeSetting('backupLastError', next.lastBackupError);
  if (next.lastBackupAt !== undefined) writeSetting('backupLastAt', next.lastBackupAt);
  return getBackupSettings();
};
