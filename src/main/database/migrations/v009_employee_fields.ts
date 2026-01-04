/**
 * Migration v009: Add birthDate, department, and event expiration
 *
 * Adds fields for:
 * - Employee birthDate (for birthday tracking)
 * - Employee department (for team distribution)
 * - Event expiresAt (for tracking expiring trainings/certifications)
 */

import type { Database as DatabaseType } from 'better-sqlite3';

import type { Migration } from './index';

/**
 * Check if a column exists in a table
 */
const hasColumn = (db: DatabaseType, table: string, column: string): boolean => {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return columns.some((col) => col.name === column);
};

/**
 * Safely add a column if it doesn't already exist
 */
const addColumnIfNotExists = (
  db: DatabaseType,
  table: string,
  column: string,
  type: string,
): void => {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

export const v009_employee_fields: Migration = {
  version: 9,
  description: 'Add birthDate, department to employees and expiresAt to events',
  up: (db) => {
    // Add birthDate column to employees (YYYY-MM-DD format)
    addColumnIfNotExists(db, 'employees', 'birthDate', 'TEXT');

    // Add department column to employees
    addColumnIfNotExists(db, 'employees', 'department', 'TEXT');

    // Add expiresAt column to employee_events (for training/certification expiry)
    addColumnIfNotExists(db, 'employee_events', 'expiresAt', 'TEXT');

    // Create index for efficient expiry lookups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_events_expires ON employee_events(expiresAt)`);
  },
};
