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


