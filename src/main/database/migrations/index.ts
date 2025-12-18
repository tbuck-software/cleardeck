/**
 * Database Migration Runner
 *
 * Manages versioned database migrations. Each migration runs exactly once.
 * Add new migrations at the end with incrementing version numbers.
 */

import type { Database as DatabaseType } from 'better-sqlite3';

import { v001_initial } from './v001_initial';
import { v002_columns } from './v002_columns';
import { v003_fte } from './v003_fte';
import { v004_drop_weeklyhours } from './v004_drop_weeklyhours';
import { v005_drop_datasource } from './v005_drop_datasource';
import { v006_drop_documentpath } from './v006_drop_documentpath';
import { v007_drop_employee_qualification } from './v007_drop_employee_qualification';
import { v008_fix_employee_foreign_keys } from './v008_fix_employee_foreign_keys';
import { v009_employee_fields } from './v009_employee_fields';

export type Migration = {
  version: number;
  description: string;
  up: (db: DatabaseType) => void;
};

/**
 * All migrations in order
 * Add new migrations at the end of this array
 */
export const migrations: Migration[] = [
  v001_initial,
  v002_columns,
  v003_fte,
  v004_drop_weeklyhours,
  v005_drop_datasource,
  v006_drop_documentpath,
  v007_drop_employee_qualification,
  v008_fix_employee_foreign_keys,
  v009_employee_fields,
];

export const CURRENT_SCHEMA_VERSION = migrations.length;

/**
 * Get the current schema version from the database
 */
const getSchemaVersion = (db: DatabaseType): number => {
  try {
    const row = db
      .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;
    return row?.value ? Number(row.value) : 0;
  } catch {
    return 0; // settings table doesn't exist yet
  }
};

/**
 * Set the schema version in the database
 */
const setSchemaVersion = (db: DatabaseType, version: number): void => {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").run(
    String(version),
  );
};

/**
 * Detect the schema version of legacy databases (pre-versioning)
 * This allows us to skip migrations that have effectively already been applied
 */
const detectLegacyDatabaseVersion = (db: DatabaseType): number => {
  try {
    // Check if this is an existing database (has tables but no schema_version)
    const hasEmployees = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'")
      .get();
    if (!hasEmployees) return 0; // Fresh database

    // Check for migration markers from old system
    const hasFteMigration = db
      .prepare("SELECT value FROM settings WHERE key = 'migration_fte_recalc_v1'")
      .get();
    if (hasFteMigration) return 3; // Already ran the FTE migration

    // Has the weeklyHours column in employment_periods? (added in later versions)
    try {
      db.prepare('SELECT weeklyHours FROM employment_periods LIMIT 1').get();
      return 2; // Has the column, so migrations 1-2 are done
    } catch {
      return 1; // Basic schema exists
    }
  } catch {
    return 0;
  }
};

/**
 * Run all pending migrations
 */
export const runMigrations = (db: DatabaseType): void => {
  db.pragma('foreign_keys = ON');

  let currentVersion = getSchemaVersion(db);

  // For legacy databases without schema_version, detect their actual state
  if (currentVersion === 0) {
    const legacyVersion = detectLegacyDatabaseVersion(db);
    if (legacyVersion > 0) {
      console.log(`Detected legacy database at version ${legacyVersion}, updating schema_version`);
      currentVersion = legacyVersion;
      setSchemaVersion(db, legacyVersion);
    }
  }

  // Run all migrations that haven't been applied yet
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration v${migration.version}: ${migration.description}`);
      migration.up(db);
      setSchemaVersion(db, migration.version);
    }
  }
};
