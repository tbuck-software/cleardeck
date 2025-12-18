/**
 * Migration v004: Remove fte and weeklyHours from employment_periods
 *
 * fte and weeklyHours are now stored on employees, not on employment_periods.
 * This migration removes those columns from the employment_periods table.
 */

import type { Migration } from './index';

export const v004_drop_weeklyhours: Migration = {
  version: 4,
  description: 'Remove fte and weeklyHours columns from employment_periods table',
  up: (db) => {
    // Check if columns exist before attempting to remove them
    const tableInfo = db.prepare("PRAGMA table_info('employment_periods')").all() as {
      name: string;
    }[];
    const columns = tableInfo.map((col) => col.name);

    // Only proceed if fte or weeklyHours columns exist
    if (!columns.includes('fte') && !columns.includes('weeklyHours')) {
      return; // Nothing to do
    }

    // Temporarily disable FK checks while we recreate the table
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    db.pragma('foreign_keys = OFF');

    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE employment_periods_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT,
          qualification TEXT,
          note TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );

        INSERT INTO employment_periods_new (id, employeeId, startDate, endDate, qualification, note)
        SELECT id, employeeId, startDate, endDate, qualification, note
        FROM employment_periods;

        DROP TABLE employment_periods;
        ALTER TABLE employment_periods_new RENAME TO employment_periods;

        CREATE INDEX IF NOT EXISTS idx_periods_employee ON employment_periods(employeeId);
        CREATE INDEX IF NOT EXISTS idx_periods_dates ON employment_periods(startDate, endDate);
      `);
    });

    migrate();

    if (foreignKeys) {
      db.pragma('foreign_keys = ON');
    }
  },
};


