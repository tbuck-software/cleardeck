import type { Migration } from './index';

export const v012_employee_competencies: Migration = {
  version: 12,
  description: 'Add competency definitions and employee competency pass',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS competency_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_competency_definitions_sort
        ON competency_definitions(sortOrder);

      CREATE TABLE IF NOT EXISTS employee_competencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        competencyDefinitionId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        startedAt TEXT,
        completedAt TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        UNIQUE(employeeId, competencyDefinitionId),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (competencyDefinitionId) REFERENCES competency_definitions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_employee_competencies_employee
        ON employee_competencies(employeeId);
      CREATE INDEX IF NOT EXISTS idx_employee_competencies_definition
        ON employee_competencies(competencyDefinitionId);
    `);

    db.prepare(
      `
      INSERT OR IGNORE INTO competency_definitions (name, sortOrder, note)
      VALUES ('Einarbeitung', 1, 'Praktische Einarbeitung im Pflegealltag')
    `,
    ).run();

    db.prepare(
      `
      UPDATE competency_definitions
      SET name = 'Einarbeitung'
      WHERE name = 'Onboarding'
    `,
    ).run();

    db.prepare(
      'UPDATE competency_definitions SET sortOrder = id WHERE sortOrder IS NULL',
    ).run();
  },
};
