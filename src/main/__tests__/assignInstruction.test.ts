/// <reference types="vitest/globals" />
// @vitest-environment node

/**
 * Runs against real SQLite through node:sqlite — better-sqlite3 is built for
 * Electron's ABI and cannot load here, so getDb is pointed at a memory database.
 */

import { DatabaseSync } from 'node:sqlite';
import { assignInstructionToEmployees, listEmployeesWithOpenInstruction } from '../repositories/instructions';

const state: { db: DatabaseSync | null } = { db: null };

/** node:sqlite has no better-sqlite3 `transaction()`; this is the same contract. */
const adapt = (db: DatabaseSync) => ({
  prepare: (sql: string) => db.prepare(sql),
  exec: (sql: string) => db.exec(sql),
  transaction:
    <T extends unknown[]>(fn: (...args: T) => void) =>
    (...args: T) => {
      db.exec('BEGIN');
      try {
        fn(...args);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
});

vi.mock('../database/connection', () => ({
  getDb: () => adapt(state.db as DatabaseSync),
}));

const setup = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, birthDate TEXT);
    CREATE TABLE instruction_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT UNIQUE NOT NULL,
      legalBasis TEXT,
      note TEXT,
      sortOrder INTEGER,
      intervalMonths INTEGER,
      intervalSource TEXT
    );
    CREATE TABLE employee_instructions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER NOT NULL,
      instructionDefinitionId INTEGER NOT NULL,
      dueDate TEXT,
      completedAt TEXT,
      conductedBy TEXT,
      note TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO employees (name) VALUES ('Anna Berg'), ('Bo Clemens'), ('Cem Dogan');
    INSERT INTO instruction_definitions (topic, sortOrder, intervalMonths, intervalSource)
      VALUES ('Hautschutzunterweisung', 1, 12, 'norm');
  `);
  return db;
};

const rows = () =>
  (state.db as DatabaseSync)
    .prepare('SELECT employeeId, dueDate, completedAt FROM employee_instructions ORDER BY employeeId')
    .all() as Array<{ employeeId: number; dueDate: string | null; completedAt: string | null }>;

describe('assignInstructionToEmployees', () => {
  beforeEach(() => {
    state.db = setup();
  });

  afterEach(() => {
    state.db?.close();
    state.db = null;
  });

  it('legt für jede ausgewählte Person einen offenen Eintrag mit demselben Termin an', () => {
    const assigned = assignInstructionToEmployees({
      instructionDefinitionId: 1,
      employeeIds: [1, 2, 3],
      dueDate: '2026-11-30',
    });

    expect(assigned).toBe(3);
    expect(rows()).toEqual([
      { employeeId: 1, dueDate: '2026-11-30', completedAt: null },
      { employeeId: 2, dueDate: '2026-11-30', completedAt: null },
      { employeeId: 3, dueDate: '2026-11-30', completedAt: null },
    ]);
  });

  it('überspringt Personen, die schon einen offenen Eintrag haben', () => {
    assignInstructionToEmployees({ instructionDefinitionId: 1, employeeIds: [1], dueDate: '2026-11-30' });

    const assigned = assignInstructionToEmployees({
      instructionDefinitionId: 1,
      employeeIds: [1, 2],
      dueDate: '2027-01-15',
    });

    expect(assigned).toBe(1);
    expect(rows()).toEqual([
      { employeeId: 1, dueDate: '2026-11-30', completedAt: null },
      { employeeId: 2, dueDate: '2027-01-15', completedAt: null },
    ]);
  });

  it('ordnet trotz abgeschlossenem Eintrag neu zu — das ist der Folgetermin', () => {
    (state.db as DatabaseSync)
      .prepare(
        "INSERT INTO employee_instructions (employeeId, instructionDefinitionId, completedAt) VALUES (1, 1, '2025-06-01')",
      )
      .run();

    const assigned = assignInstructionToEmployees({
      instructionDefinitionId: 1,
      employeeIds: [1],
      dueDate: '2026-06-01',
    });

    expect(assigned).toBe(1);
    expect(rows()).toHaveLength(2);
  });

  it('erlaubt eine Zuordnung ohne Termin', () => {
    assignInstructionToEmployees({ instructionDefinitionId: 1, employeeIds: [2], dueDate: '' });

    expect(rows()).toEqual([{ employeeId: 2, dueDate: null, completedAt: null }]);
  });

  it('meldet nur Personen mit offenem Eintrag zurück', () => {
    assignInstructionToEmployees({ instructionDefinitionId: 1, employeeIds: [1, 3], dueDate: null });
    (state.db as DatabaseSync)
      .prepare("UPDATE employee_instructions SET completedAt = '2026-02-02' WHERE employeeId = 3")
      .run();

    expect(listEmployeesWithOpenInstruction(1)).toEqual([1]);
  });
});
