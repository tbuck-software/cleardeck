/**
 * Migration v005: Remove dataSource from employees
 *
 * The data source field is no longer needed; all period data stays in employment_periods.
 * This migration drops the obsolete column from employees.
 */

import type { Migration } from './index';

export const v005_drop_datasource: Migration = {
  version: 5,
  description: 'Remove dataSource column from employees table',
  up: (db) => {
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    db.pragma('foreign_keys = OFF');

    const migrate = db.transaction(() => {
      db.exec(`
        ALTER TABLE employees RENAME TO employees_old;

        CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          qualification TEXT NOT NULL,
          note TEXT,
          weeklyHours REAL,
          fte REAL,
          documentPath TEXT,
          createdAt TEXT DEFAULT (datetime('now'))
        );

        INSERT INTO employees (id, name, qualification, note, weeklyHours, fte, documentPath, createdAt)
        SELECT id, name, qualification, note, weeklyHours, fte, documentPath, createdAt
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
