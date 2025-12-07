import type { Migration } from './index';

type Db = Parameters<Migration['up']>[0];

const tableExists = (db: Db, name: string): boolean => {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name) as { name?: string } | undefined;
  return Boolean(row?.name);
};

/**
 * Some databases ended up with foreign keys pointing at a transient
 * employees_old table. This migration repairs those foreign keys and
 * removes the stray table without losing data.
 */
export const v008_fix_employee_foreign_keys: Migration = {
  version: 8,
  description: 'Repair employee foreign keys and clean up employees_old',
  up: (db) => {
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    db.pragma('foreign_keys = OFF');

    const hasEmployees = tableExists(db, 'employees');
    const hasEmployeesOld = tableExists(db, 'employees_old');

    // Recover data if the primary table is missing but the temp table remains
    if (!hasEmployees && hasEmployeesOld) {
      db.exec('ALTER TABLE employees_old RENAME TO employees;');
    } else if (!hasEmployees) {
      db.exec(`
        CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          note TEXT,
          weeklyHours REAL,
          fte REAL,
          createdAt TEXT DEFAULT (datetime('now'))
        );
      `);
    }

    // Drop leftover temp table to avoid future FK lookups against it
    if (tableExists(db, 'employees_old')) {
      db.exec('DROP TABLE employees_old;');
    }

    // Recreate employment_periods with a clean FK to employees (without fte/weeklyHours)
    if (tableExists(db, 'employment_periods')) {
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

        INSERT INTO employment_periods_new (
          id, employeeId, startDate, endDate, qualification, note
        )
        SELECT id, employeeId, startDate, endDate, qualification, note
        FROM employment_periods;

        DROP TABLE employment_periods;
        ALTER TABLE employment_periods_new RENAME TO employment_periods;

        CREATE INDEX IF NOT EXISTS idx_periods_employee ON employment_periods(employeeId);
        CREATE INDEX IF NOT EXISTS idx_periods_dates ON employment_periods(startDate, endDate);
      `);
    }

    // Recreate employee_events with a clean FK to employees
    if (tableExists(db, 'employee_events')) {
      db.exec(`
        CREATE TABLE employee_events_new (
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

        INSERT INTO employee_events_new (
          id, employeeId, eventDate, type, title, details, meta, previousValue, newValue, createdAt
        )
        SELECT id, employeeId, eventDate, type, title, details, meta, previousValue, newValue, createdAt
        FROM employee_events;

        DROP TABLE employee_events;
        ALTER TABLE employee_events_new RENAME TO employee_events;

        CREATE INDEX IF NOT EXISTS idx_events_employee ON employee_events(employeeId);
        CREATE INDEX IF NOT EXISTS idx_events_date ON employee_events(eventDate);
      `);
    }

    if (foreignKeys) {
      db.pragma('foreign_keys = ON');
    }
  },
};

