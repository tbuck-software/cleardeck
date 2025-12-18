/**
 * Migration v009: Add birthDate, department, and event expiration
 *
 * Adds fields for:
 * - Employee birthDate (for birthday tracking)
 * - Employee department (for team distribution)
 * - Event expiresAt (for tracking expiring trainings/certifications)
 */

import type { Migration } from './index';

export const v009_employee_fields: Migration = {
  version: 9,
  description: 'Add birthDate, department to employees and expiresAt to events',
  up: (db) => {
    // Add birthDate column to employees (YYYY-MM-DD format)
    db.exec(`ALTER TABLE employees ADD COLUMN birthDate TEXT`);

    // Add department column to employees
    db.exec(`ALTER TABLE employees ADD COLUMN department TEXT`);

    // Add expiresAt column to employee_events (for training/certification expiry)
    db.exec(`ALTER TABLE employee_events ADD COLUMN expiresAt TEXT`);

    // Create index for efficient expiry lookups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_events_expires ON employee_events(expiresAt)`);
  },
};
