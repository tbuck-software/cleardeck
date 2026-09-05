/**
 * Migration v015: repetition intervals belong to the instruction, not the app.
 *
 * See docs/adr/0002. Three intervals are in play (12, 24 and 6 months) plus a
 * group with no interval at all, so a single global figure cannot be right.
 *
 * The table is also rebuilt to drop UNIQUE(employeeId, instructionDefinitionId).
 * That constraint allowed exactly one row per person and topic, which makes a
 * follow-up entry impossible — the completed record would have to be
 * overwritten, and with it the evidence of when the last one happened.
 *
 * The catalogue corrections run here rather than in defaultCatalog.ts because
 * that file is only ever read by v013's INSERT OR IGNORE — editing it would
 * leave every existing database on the wrong legal basis. Only rows still
 * carrying the originally seeded value are touched, so a service that has
 * already corrected an entry keeps its own wording.
 */

import type { Migration } from './index';
import { defaultInstructionCatalog } from '../defaultCatalog';

type Db = Parameters<Migration['up']>[0];

const columnNames = (db: Db, table: string): string[] =>
  (db.prepare(`PRAGMA table_info('${table}')`).all() as Array<{ name: string }>).map((c) => c.name);

/**
 * topic → the value v013 originally seeded. Only rows still holding it are
 * rewritten, so an own correction survives. These strings are history and stay
 * hardcoded; the corrected values come from the catalogue.
 */
const PREVIOUSLY_SEEDED_BASIS: Record<string, string> = {
  'Hygieneunterweisung (jährlich)': 'IfSG / KRINKO',
  'Einweisung Medizinprodukte (MPG)': 'MDR / MPDG',
  'Brandschutzunterweisung': 'ArbStättV',
  'Erstunterweisung Arbeitsschutz': 'ArbSchG § 12',
};

export const v015_instruction_intervals: Migration = {
  version: 15,
  description: 'Add per-definition instruction intervals and correct seeded legal bases',
  up: (db) => {
    const columns = columnNames(db, 'instruction_definitions');
    if (!columns.includes('intervalMonths')) {
      db.exec('ALTER TABLE instruction_definitions ADD COLUMN intervalMonths INTEGER');
    }
    if (!columns.includes('intervalSource')) {
      db.exec("ALTER TABLE instruction_definitions ADD COLUMN intervalSource TEXT CHECK(intervalSource IN ('norm', 'betrieblich'))");
    }

    // Rebuild without the UNIQUE key so a completed entry and its follow-up can
    // live side by side. SQLite cannot drop a constraint in place.
    const hasUniqueKey = (
      db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='employee_instructions'")
        .get() as { sql?: string } | undefined
    )?.sql?.includes('UNIQUE(employeeId, instructionDefinitionId)');

    if (hasUniqueKey) {
      const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
      db.pragma('foreign_keys = OFF');

      db.exec(`
        CREATE TABLE employee_instructions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          instructionDefinitionId INTEGER NOT NULL,
          dueDate TEXT,
          completedAt TEXT,
          conductedBy TEXT,
          note TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
          FOREIGN KEY (instructionDefinitionId) REFERENCES instruction_definitions(id) ON DELETE CASCADE
        );
        INSERT INTO employee_instructions_new
          (id, employeeId, instructionDefinitionId, dueDate, completedAt, conductedBy, note, createdAt)
          SELECT id, employeeId, instructionDefinitionId, dueDate, completedAt, conductedBy, note, createdAt
          FROM employee_instructions;
        DROP TABLE employee_instructions;
        ALTER TABLE employee_instructions_new RENAME TO employee_instructions;
        CREATE INDEX IF NOT EXISTS idx_employee_instructions_employee
          ON employee_instructions(employeeId);
        CREATE INDEX IF NOT EXISTS idx_employee_instructions_definition
          ON employee_instructions(instructionDefinitionId);
      `);

      if (foreignKeys) db.pragma('foreign_keys = ON');
    }

    const fixBasis = db.prepare(
      'UPDATE instruction_definitions SET legalBasis = ? WHERE topic = ? AND legalBasis = ?',
    );
    // Only set an interval where none has been chosen yet, so a re-run or an
    // existing decision is never overwritten.
    const setInterval = db.prepare(
      'UPDATE instruction_definitions SET intervalMonths = ?, intervalSource = ? WHERE topic = ? AND intervalMonths IS NULL',
    );

    defaultInstructionCatalog.forEach((entry) => {
      const previous = PREVIOUSLY_SEEDED_BASIS[entry.topic];
      if (previous && previous !== entry.legalBasis) {
        fixBasis.run(entry.legalBasis, entry.topic, previous);
      }

      const months = 'intervalMonths' in entry ? entry.intervalMonths : null;
      const source = 'intervalSource' in entry ? entry.intervalSource : null;
      if (months != null) setInterval.run(months, source ?? 'betrieblich', entry.topic);
    });
  },
};
