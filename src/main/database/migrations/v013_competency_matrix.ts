import type { Migration } from './index';
import { defaultCompetencyCatalog, defaultInstructionCatalog } from '../defaultCatalog';

export const v013_competency_matrix: Migration = {
  version: 13,
  description: 'Extend competencies with matrix fields and add instruction catalog',
  up: (db) => {
    const competencyColumns = db
      .prepare("PRAGMA table_info('competency_definitions')")
      .all() as Array<{ name: string }>;
    const employeeCompetencyColumns = db
      .prepare("PRAGMA table_info('employee_competencies')")
      .all() as Array<{ name: string }>;

    const addCompetencyColumn = (name: string, sqlType: string, defaultValue?: string) => {
      if (competencyColumns.some((column) => column.name === name)) return;
      const clause = defaultValue ? ` DEFAULT ${defaultValue}` : '';
      db.exec(`ALTER TABLE competency_definitions ADD COLUMN ${name} ${sqlType}${clause}`);
    };
    const addEmployeeCompetencyColumn = (name: string, sqlType: string) => {
      if (employeeCompetencyColumns.some((column) => column.name === name)) return;
      db.exec(`ALTER TABLE employee_competencies ADD COLUMN ${name} ${sqlType}`);
    };

    addCompetencyColumn('code', 'TEXT');
    addCompetencyColumn('category', 'TEXT', "'Allgemein'");
    addCompetencyColumn('relevance', 'TEXT', "'Alle'");
    addEmployeeCompetencyColumn('level', 'INTEGER');
    addEmployeeCompetencyColumn('approvedAt', 'TEXT');
    addEmployeeCompetencyColumn('approvedBy', 'TEXT');

    db.exec(`
      CREATE TABLE IF NOT EXISTS instruction_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT UNIQUE NOT NULL,
        legalBasis TEXT,
        note TEXT,
        sortOrder INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_instruction_definitions_sort
        ON instruction_definitions(sortOrder);

      CREATE TABLE IF NOT EXISTS employee_instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        instructionDefinitionId INTEGER NOT NULL,
        dueDate TEXT,
        completedAt TEXT,
        conductedBy TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        UNIQUE(employeeId, instructionDefinitionId),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (instructionDefinitionId) REFERENCES instruction_definitions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_employee_instructions_employee
        ON employee_instructions(employeeId);
      CREATE INDEX IF NOT EXISTS idx_employee_instructions_definition
        ON employee_instructions(instructionDefinitionId);
    `);

    db.prepare(
      `
      UPDATE employee_competencies
      SET level = CASE
        WHEN status = 'completed' THEN 4
        WHEN status = 'in-progress' THEN 2
        ELSE level
      END
      WHERE level IS NULL
    `,
    ).run();

    db.prepare(
      `
      UPDATE employee_competencies
      SET approvedAt = completedAt
      WHERE approvedAt IS NULL AND completedAt IS NOT NULL
    `,
    ).run();

    const insertCompetency = db.prepare(
      `
      INSERT OR IGNORE INTO competency_definitions (code, name, category, relevance, note, sortOrder)
      VALUES (@code, @name, @category, @relevance, @note, @sortOrder)
    `,
    );
    defaultCompetencyCatalog.forEach((item, index) => {
      insertCompetency.run({
        ...item,
        sortOrder: index + 1,
      });
    });

    db.prepare(
      `
      UPDATE competency_definitions
      SET category = COALESCE(NULLIF(category, ''), 'Allgemein'),
          relevance = COALESCE(NULLIF(relevance, ''), 'Alle')
    `,
    ).run();

    const insertInstruction = db.prepare(
      `
      INSERT OR IGNORE INTO instruction_definitions (topic, legalBasis, note, sortOrder)
      VALUES (@topic, @legalBasis, @note, @sortOrder)
    `,
    );
    defaultInstructionCatalog.forEach((item, index) => {
      insertInstruction.run({
        ...item,
        sortOrder: index + 1,
      });
    });

    db.prepare(
      'UPDATE instruction_definitions SET sortOrder = id WHERE sortOrder IS NULL',
    ).run();
  },
};
