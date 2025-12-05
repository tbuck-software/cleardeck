/**
 * Migration v002: Add Missing Columns
 *
 * Adds columns that were introduced after the initial schema.
 * Uses try/catch for backwards compatibility with existing databases
 * where some columns may already exist.
 */

import type { Migration } from './index';

export const v002_columns: Migration = {
  version: 2,
  description: 'Add missing columns for legacy databases (sortOrder, notes, weeklyHours, event history)',
  up: (db) => {
    const addColumnIfMissing = (table: string, column: string, type: string) => {
      try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
      } catch {
        // Column already exists
      }
    };

    addColumnIfMissing('qualification_types', 'sortOrder', 'INTEGER');
    addColumnIfMissing('qualification_types', 'note', 'TEXT');
    addColumnIfMissing('employees', 'weeklyHours', 'REAL');
    addColumnIfMissing('employment_periods', 'note', 'TEXT');
    addColumnIfMissing('employment_periods', 'weeklyHours', 'REAL');
    addColumnIfMissing('employee_events', 'previousValue', 'TEXT');
    addColumnIfMissing('employee_events', 'newValue', 'TEXT');

    // Ensure sortOrder and index
    db.prepare('UPDATE qualification_types SET sortOrder = id WHERE sortOrder IS NULL').run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_qualification_sort ON qualification_types(sortOrder)',
    ).run();
  },
};
