/**
 * Migration v010: Departments Table
 *
 * Creates a departments table for managing department entities.
 * Migrates existing department strings from employees to the new table.
 */

import type { Migration } from './index';

export const v010_departments: Migration = {
  version: 10,
  description: 'Create departments table and migrate existing data',
  up: (db) => {
    // Create departments table (similar structure to qualification_types)
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_department_sort ON departments(sortOrder);
    `);

    // Migrate existing unique department values from employees
    const existingDepartments = db
      .prepare(
        `SELECT DISTINCT department FROM employees
         WHERE department IS NOT NULL AND department != ''
         ORDER BY department`
      )
      .all() as { department: string }[];

    const insertDept = db.prepare(
      'INSERT OR IGNORE INTO departments (name, sortOrder) VALUES (?, ?)'
    );

    existingDepartments.forEach((row, idx) => {
      insertDept.run(row.department, idx + 1);
    });
  },
};
