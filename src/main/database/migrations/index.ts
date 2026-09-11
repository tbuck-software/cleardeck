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
import { v010_patients } from './v010_patients';
import { v012_employee_competencies } from './v012_employee_competencies';
import { v013_competency_matrix } from './v013_competency_matrix';
import { v014_qpr_stichprobe } from './v014_qpr_stichprobe';
import { v015_instruction_intervals } from './v015_instruction_intervals';
import { v021_catalog_actions } from './v021_catalog_actions';
import { v020_employment_provenance } from './v020_employment_provenance';
import { v019_patient_scope_audit } from './v019_patient_scope_audit';
import { v018_instruction_evidence } from './v018_instruction_evidence';
import { v017_employment_terms } from './v017_employment_terms';
import { v016_missing_instructions } from './v016_missing_instructions';
import { v022_patient_service_scope } from './v022_patient_service_scope';

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
  v010_patients,
  v012_employee_competencies,
  v013_competency_matrix,
  v014_qpr_stichprobe,
  v015_instruction_intervals,
  v016_missing_instructions,
  v017_employment_terms,
  v018_instruction_evidence,
  v019_patient_scope_audit,
  v020_employment_provenance,
  v021_catalog_actions,
  v022_patient_service_scope,
];

export const CURRENT_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0;

/**
 * Get the current schema version from the database
 */
const getSchemaVersion = (db: DatabaseType): number => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as
      | { value?: string }
      | undefined;
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

  // Safety check: Ensure v010 patients tables exist (fixes edge case where schema_version was set but tables not created)
  const hasPatients = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patients'")
    .get();
  if (!hasPatients) {
    console.log('Repairing: patients table missing, running v010 migration...');
    const v010 = migrations.find((m) => m.version === 10);
    if (v010) {
      v010.up(db);
    }
  }

  const hasCompetencyDefinitions = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='competency_definitions'")
    .get();
  const hasEmployeeCompetencies = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_competencies'")
    .get();
  if (!hasCompetencyDefinitions || !hasEmployeeCompetencies) {
    console.log('Repairing: competency tables missing, running v012 migration...');
    const v012 = migrations.find((m) => m.version === 12);
    if (v012) {
      v012.up(db);
    }
  }

  const hasInstructionDefinitions = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='instruction_definitions'")
    .get();
  const hasEmployeeInstructions = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_instructions'")
    .get();
  const competencyColumns = db
    .prepare("PRAGMA table_info('competency_definitions')")
    .all() as Array<{ name: string }>;
  const employeeCompetencyColumns = db
    .prepare("PRAGMA table_info('employee_competencies')")
    .all() as Array<{ name: string }>;
  const needsV013Repair =
    !hasInstructionDefinitions ||
    !hasEmployeeInstructions ||
    !competencyColumns.some((column) => column.name === 'category') ||
    !competencyColumns.some((column) => column.name === 'relevance') ||
    !employeeCompetencyColumns.some((column) => column.name === 'level') ||
    !employeeCompetencyColumns.some((column) => column.name === 'approvedAt') ||
    !employeeCompetencyColumns.some((column) => column.name === 'approvedBy');
  if (needsV013Repair) {
    console.log('Repairing: competency matrix tables/columns missing, running v013 migration...');
    const v013 = migrations.find((m) => m.version === 13);
    if (v013) {
      v013.up(db);
    }
  }

  const patientColumns = db.prepare("PRAGMA table_info('patients')").all() as Array<{
    name: string;
  }>;
  const visitColumns = db.prepare("PRAGMA table_info('patient_visits')").all() as Array<{
    name: string;
  }>;
  const hasAudits = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audits'")
    .get();
  const instructionColumns = db
    .prepare("PRAGMA table_info('instruction_definitions')")
    .all() as Array<{ name: string }>;
  if (!instructionColumns.some((column) => column.name === 'intervalMonths')) {
    console.log('Repairing: instruction interval columns missing, running v015 migration...');
    migrations.find((m) => m.version === 15)?.up(db);
  }

  const needsV014Repair =
    !hasAudits ||
    !patientColumns.some((column) => column.name === 'cognitionImpaired') ||
    !visitColumns.some((column) => column.name === 'actionNeeded');
  if (needsV014Repair) {
    console.log(
      'Repairing: QPR Teilgruppe columns/audit tables missing, running v014 migration...',
    );
    const v014 = migrations.find((m) => m.version === 14);
    if (v014) {
      v014.up(db);
    }
  }
};
