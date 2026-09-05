/// <reference types="vitest/globals" />
// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { v015_instruction_intervals } from '../database/migrations/v015_instruction_intervals';

type Db = DatabaseSync & { pragma: (source: string, options?: { simple?: boolean }) => unknown };

const withPragma = (db: DatabaseSync): Db => {
  const adapted = db as Db;
  adapted.pragma = (source, options) => {
    if (source.includes('=')) {
      db.exec(`PRAGMA ${source}`);
      return undefined;
    }
    const row = db.prepare(`PRAGMA ${source}`).get() as Record<string, unknown> | undefined;
    if (!row) return options?.simple ? undefined : [];
    return options?.simple ? Object.values(row)[0] : [row];
  };
  return adapted;
};

/** A v013-shaped database, including the UNIQUE key v015 has to remove. */
const legacyDatabase = (): Db => {
  const db = withPragma(new DatabaseSync(':memory:'));
  db.exec(`
    CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, birthDate TEXT);
    CREATE TABLE instruction_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT UNIQUE NOT NULL,
      legalBasis TEXT,
      note TEXT,
      sortOrder INTEGER
    );
    CREATE TABLE employee_instructions (
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
  `);

  db.prepare("INSERT INTO employees (id, name) VALUES (1, 'Anna Berger')").run();
  const def = db.prepare('INSERT INTO instruction_definitions (topic, legalBasis, sortOrder) VALUES (?, ?, ?)');
  def.run('Hygieneunterweisung (jährlich)', 'IfSG / KRINKO', 1);
  def.run('Einweisung Medizinprodukte (MPG)', 'MDR / MPDG', 2);
  def.run('Brandschutzunterweisung', 'ArbStättV', 3);
  def.run('Datenschutz-Grundunterweisung', 'DSGVO / BDSG', 4);
  // Eine eigene Korrektur des Dienstes, die nicht ueberschrieben werden darf.
  def.run('Abfallentsorgung nach LAGA', 'eigene Fassung', 5);

  db.prepare(
    "INSERT INTO employee_instructions (id, employeeId, instructionDefinitionId, dueDate, completedAt) VALUES (7, 1, 1, '2026-11-30', '2025-11-28')",
  ).run();

  return db;
};

const basisOf = (db: Db, topic: string): string =>
  (db.prepare('SELECT legalBasis FROM instruction_definitions WHERE topic = ?').get(topic) as {
    legalBasis: string;
  }).legalBasis;

const intervalOf = (db: Db, topic: string) =>
  db.prepare('SELECT intervalMonths, intervalSource FROM instruction_definitions WHERE topic = ?').get(topic) as {
    intervalMonths: number | null;
    intervalSource: string | null;
  };

describe('v015_instruction_intervals', () => {
  let db: Db;

  beforeEach(() => {
    db = legacyDatabase();
    v015_instruction_intervals.up(db as never);
  });

  afterEach(() => db.close());

  it('korrigiert die belegten Rechtsgrundlagen', () => {
    expect(basisOf(db, 'Hygieneunterweisung (jährlich)')).toBe('BioStoffV § 14 / TRBA 250');
    expect(basisOf(db, 'Einweisung Medizinprodukte (MPG)')).toBe('MPBetreibV § 4 / § 11');
    expect(basisOf(db, 'Brandschutzunterweisung')).toBe('ArbStättV § 6 / ASR A2.2');
  });

  it('überschreibt eine eigene Fassung nicht', () => {
    expect(basisOf(db, 'Abfallentsorgung nach LAGA')).toBe('eigene Fassung');
  });

  it('setzt nur die aus einer Norm ableitbaren Intervalle', () => {
    expect(intervalOf(db, 'Hygieneunterweisung (jährlich)')).toEqual({
      intervalMonths: 12,
      intervalSource: 'norm',
    });
    expect(intervalOf(db, 'Brandschutzunterweisung')).toEqual({
      intervalMonths: 12,
      intervalSource: 'norm',
    });
  });

  it('lässt Medizinprodukte und Datenschutz ausdrücklich ohne Intervall', () => {
    // Die MPBetreibV kennt kein Zeitintervall, die DSGVO auch nicht.
    expect(intervalOf(db, 'Einweisung Medizinprodukte (MPG)').intervalMonths).toBeNull();
    expect(intervalOf(db, 'Datenschutz-Grundunterweisung').intervalMonths).toBeNull();
  });

  it('entfernt den Unique-Key, der einen Folgeeintrag verhindert hat', () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO employee_instructions (employeeId, instructionDefinitionId, dueDate) VALUES (1, 1, '2026-11-28')",
        )
        .run(),
    ).not.toThrow();

    const rows = db
      .prepare('SELECT COUNT(*) as count FROM employee_instructions WHERE employeeId = 1 AND instructionDefinitionId = 1')
      .get() as { count: number };
    expect(rows.count).toBe(2);
  });

  it('rettet die vorhandenen Zuordnungen beim Umbau', () => {
    const row = db.prepare('SELECT * FROM employee_instructions WHERE id = 7').get() as {
      employeeId: number;
      dueDate: string;
      completedAt: string;
    };
    expect(row).toMatchObject({ employeeId: 1, dueDate: '2026-11-30', completedAt: '2025-11-28' });
  });

  it('ist wiederholbar', () => {
    v015_instruction_intervals.up(db as never);

    expect(basisOf(db, 'Abfallentsorgung nach LAGA')).toBe('eigene Fassung');
    const rows = db.prepare('SELECT COUNT(*) as count FROM employee_instructions').get() as { count: number };
    expect(rows.count).toBe(1);
  });
});
