/**
 * Migration v007: Move qualification fully to employment_periods
 *
 * - Backfill missing period qualifications from employees.qualification
 * - Drop the qualification column from employees
 */

import type { Migration } from './index';

export const v007_drop_employee_qualification: Migration = {
  version: 7,
  description: 'Backfill period qualification and drop employees.qualification',
  up: (db) => {
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    db.pragma('foreign_keys = OFF');

    const migrate = db.transaction(() => {
      // 1) Backfill period qualifications where missing, using employee qualification
      db.exec(`
        UPDATE employment_periods
        SET qualification = (
          SELECT qualification FROM employees e WHERE e.id = employment_periods.employeeId
        )
        WHERE qualification IS NULL OR qualification = '';
      `);

      // 2) Drop qualification from employees by recreating the table
      db.exec(`
        ALTER TABLE employees RENAME TO employees_old;

        CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          note TEXT,
          weeklyHours REAL,
          fte REAL,
          createdAt TEXT DEFAULT (datetime('now'))
        );

        INSERT INTO employees (id, name, note, weeklyHours, fte, createdAt)
        SELECT id, name, note, weeklyHours, fte, createdAt
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

