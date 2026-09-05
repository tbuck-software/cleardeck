/// <reference types="vitest/globals" />
// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { v016_missing_instructions } from '../database/migrations/v016_missing_instructions';

const database = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE instruction_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT UNIQUE NOT NULL,
      legalBasis TEXT,
      note TEXT,
      sortOrder INTEGER,
      intervalMonths INTEGER,
      intervalSource TEXT
    );
  `);
  db.prepare(
    "INSERT INTO instruction_definitions (topic, legalBasis, sortOrder) VALUES ('Brandschutzunterweisung', 'ArbStättV § 6 / ASR A2.2', 3)",
  ).run();
  return db;
};

const entry = (db: DatabaseSync, topic: string) =>
  db.prepare('SELECT * FROM instruction_definitions WHERE topic = ?').get(topic) as
    | { legalBasis: string; note: string | null; intervalMonths: number | null; intervalSource: string | null; sortOrder: number }
    | undefined;

describe('v016_missing_instructions', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = database();
    v016_missing_instructions.up(db as never);
  });

  afterEach(() => db.close());

  it('ergänzt die fünf belegten Pflichten', () => {
    [
      'Unterweisung Gefahrstoffe (Desinfektion & Reinigung)',
      'Ersthelfer-Fortbildung',
      'Brandschutzhelfer-Ausbildung',
      'Hautschutzunterweisung',
      'Belehrung nach IfSG § 43',
    ].forEach((topic) => expect(entry(db, topic)).toBeDefined());
  });

  it('übernimmt Intervall und Herkunft aus der Norm', () => {
    expect(entry(db, 'Unterweisung Gefahrstoffe (Desinfektion & Reinigung)')).toMatchObject({
      intervalMonths: 12,
      intervalSource: 'norm',
    });
    expect(entry(db, 'Ersthelfer-Fortbildung')).toMatchObject({
      intervalMonths: 24,
      intervalSource: 'norm',
    });
  });

  it('lässt die Brandschutzhelfer-Ausbildung ohne Frist', () => {
    // ASR A2.2 empfiehlt nur eine Spanne; verbindlich ist die Gefährdungsbeurteilung.
    const helper = entry(db, 'Brandschutzhelfer-Ausbildung');
    expect(helper?.intervalMonths).toBeNull();
    expect(helper?.note).toMatch(/Gefährdungsbeurteilung/);
  });

  it('nennt die Einschränkung der IfSG-Belehrung in der Notiz', () => {
    expect(entry(db, 'Belehrung nach IfSG § 43')?.note).toMatch(/eigener Küche/);
  });

  it('hängt hinten an, statt die vorhandene Reihenfolge zu stören', () => {
    expect(entry(db, 'Brandschutzunterweisung')?.sortOrder).toBe(3);
    expect(entry(db, 'Unterweisung Gefahrstoffe (Desinfektion & Reinigung)')?.sortOrder).toBe(4);
  });

  it('überschreibt einen selbst angelegten gleichnamigen Eintrag nicht', () => {
    const fresh = database();
    fresh
      .prepare(
        "INSERT INTO instruction_definitions (topic, legalBasis, sortOrder) VALUES ('Hautschutzunterweisung', 'eigene Fassung', 9)",
      )
      .run();
    v016_missing_instructions.up(fresh as never);

    expect(entry(fresh, 'Hautschutzunterweisung')?.legalBasis).toBe('eigene Fassung');
    fresh.close();
  });
});
