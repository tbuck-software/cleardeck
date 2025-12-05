/**
 * Migration v004: Remove weeklyHours from employees
 *
 * weeklyHours is now stored on employment_periods.
 * This migration drops the obsolete column from employees.
 */

import type { Migration } from './index';

export const v004_drop_weeklyhours: Migration = {
  version: 4,
  description: 'Remove weeklyHours column from employees table',
  up: (db) => {
    // Temporarily disable FK checks while we recreate the table
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    db.pragma('foreign_keys = OFF');

    const migrate = db.transaction(() => {
      db.exec(`
        ALTER TABLE employees RENAME TO employees_old;

        CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          qualification TEXT NOT NULL,
          dataSource TEXT,
          note TEXT,
          documentPath TEXT,
          createdAt TEXT DEFAULT (datetime('now'))
        );

        INSERT INTO employees (id, name, qualification, dataSource, note, documentPath, createdAt)
        SELECT id, name, qualification, dataSource, note, documentPath, createdAt
        FROM employees_old;

        DROP TABLE employees_old;
      `);
    });

    migrate();

    if (foreignKeys) {
      db.pragma('foreign_keys = ON');
    }
  },
};
