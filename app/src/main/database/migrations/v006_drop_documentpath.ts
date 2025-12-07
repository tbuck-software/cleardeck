/**
 * Migration v006: Remove documentPath from employees
 *
 * The document path field is no longer required. This migration drops the column.
 */

import type { Migration } from './index';

export const v006_drop_documentpath: Migration = {
  version: 6,
  description: 'Remove documentPath column from employees table',
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
          createdAt TEXT DEFAULT (datetime('now'))
        );

        INSERT INTO employees (id, name, qualification, note, weeklyHours, fte, createdAt)
        SELECT id, name, qualification, note, weeklyHours, fte, createdAt
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

