/**
 * Migration v001: Initial Schema
 *
 * Creates all core tables for the employee database:
 * - settings: Key-value store for app configuration
 * - qualification_types: Employee qualification categories
 * - employees: Core employee data
 * - employment_periods: Time-bound employment details (FTE, dates)
 * - employee_events: Timeline events (join, leave, etc.)
 */

import type { Migration } from './index';

export const v001_initial: Migration = {
  version: 1,
  description: 'Initial schema with all tables',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS qualification_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      );
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        qualification TEXT NOT NULL,
        dataSource TEXT,
        note TEXT,
        weeklyHours REAL,
        fte REAL,
        documentPath TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS employment_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        qualification TEXT,
        note TEXT,
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_periods_employee ON employment_periods(employeeId);
      CREATE INDEX IF NOT EXISTS idx_periods_dates ON employment_periods(startDate, endDate);
      CREATE TABLE IF NOT EXISTS employee_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        eventDate TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        details TEXT,
        meta TEXT,
        previousValue TEXT,
        newValue TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_events_employee ON employee_events(employeeId);
      CREATE INDEX IF NOT EXISTS idx_events_date ON employee_events(eventDate);
    `);

    // Seed default qualifications
    const defaults = ['3-jährig examiniert', '1-jährig examiniert', 'Pflegekraft/-helfer', 'Sonstige'];
    const seedQuali = db.prepare('INSERT OR IGNORE INTO qualification_types (name) VALUES (?)');
    defaults.forEach((q) => seedQuali.run(q));

    // Set default baseHours
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('baseHours', '36')").run();

    // Initialize sortOrder
    db.prepare('UPDATE qualification_types SET sortOrder = id WHERE sortOrder IS NULL').run();
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_qualification_sort ON qualification_types(sortOrder)',
    ).run();
  },
};


