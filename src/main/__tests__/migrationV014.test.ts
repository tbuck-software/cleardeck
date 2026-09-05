/// <reference types="vitest/globals" />
// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { v010_patients } from '../database/migrations/v010_patients';
import { v014_qpr_stichprobe } from '../database/migrations/v014_qpr_stichprobe';

/**
 * better-sqlite3 is compiled against Electron's ABI and cannot load under
 * vitest, so the migrations run here against Node's own SQLite. Only the
 * `pragma()` helper differs; everything else is the same call shape, which
 * keeps the actual SQL under test.
 */
type Db = DatabaseSync & {
  pragma: (source: string, options?: { simple?: boolean }) => unknown;
};

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

/** A v010-shaped database with the old A–D rating in place. */
const legacyDatabase = (): Db => {
  const db = withPragma(new DatabaseSync(':memory:'));
  db.exec('PRAGMA foreign_keys = ON');
  v010_patients.up(db as never);

  db.prepare(
    "INSERT INTO patients (id, name, birthDate, diagnosis, qprStatus, note) VALUES (1, 'Erika Mustermann', '1941-03-02', 'Demenz', 'C', 'Tochter ist Ansprechpartnerin.')",
  ).run();
  db.prepare(
    "INSERT INTO patients (id, name, qprStatus) VALUES (2, 'Heinz Albrecht', NULL)",
  ).run();

  db.prepare(
    "INSERT INTO patient_visits (id, patientId, visitDate, qprRating, comment) VALUES (1, 1, '2026-02-10', 'A', 'Stabil')",
  ).run();
  db.prepare(
    "INSERT INTO patient_visits (id, patientId, visitDate, qprRating, comment) VALUES (2, 1, '2026-08-20', 'C', 'Gewichtsverlust')",
  ).run();
  db.prepare(
    "INSERT INTO patient_visits (id, patientId, visitDate, qprRating, comment) VALUES (3, 2, '2026-06-03', 'D', 'Dekubitus')",
  ).run();

  return db;
};

const columns = (db: Db, table: string): string[] =>
  (db.prepare(`PRAGMA table_info('${table}')`).all() as { name: string }[]).map((row) => row.name);

describe('v014_qpr_stichprobe', () => {
  let db: Db;

  beforeEach(() => {
    db = legacyDatabase();
    v014_qpr_stichprobe.up(db as never);
  });

  afterEach(() => db.close());

  it('legt die Gutachten-Felder an', () => {
    expect(columns(db, 'patients')).toEqual(
      expect.arrayContaining([
        'cognitionImpaired',
        'mobilityImpaired',
        'hkpCode',
        'intensiveCare',
        'careLevel',
        'contact',
        'admissionDate',
      ]),
    );
  });

  it('deutet den alten Buchstaben nicht als Teilgruppe um', () => {
    const patient = db
      .prepare('SELECT cognitionImpaired, mobilityImpaired, legacyQprStatus FROM patients WHERE id = 1')
      .get() as { cognitionImpaired: number | null; mobilityImpaired: number | null; legacyQprStatus: string };

    // Die Person startet als Datenlücke, nicht als erfundene Einstufung.
    expect(patient.cognitionImpaired).toBeNull();
    expect(patient.mobilityImpaired).toBeNull();
    // Der alte Wert geht dabei nicht verloren.
    expect(patient.legacyQprStatus).toBe('C');
  });

  it('überträgt C und D der Visiten als Handlungsbedarf', () => {
    const visits = db
      .prepare('SELECT id, actionNeeded, legacyQprRating FROM patient_visits ORDER BY id')
      .all() as { id: number; actionNeeded: number; legacyQprRating: string }[];

    expect(visits).toEqual([
      { id: 1, actionNeeded: 0, legacyQprRating: 'A' },
      { id: 2, actionNeeded: 1, legacyQprRating: 'C' },
      { id: 3, actionNeeded: 1, legacyQprRating: 'D' },
    ]);
  });

  it('behält Kommentare, Daten und Zuordnung der Visiten', () => {
    const visit = db
      .prepare('SELECT patientId, visitDate, comment FROM patient_visits WHERE id = 2')
      .get() as { patientId: number; visitDate: string; comment: string };

    expect(visit).toEqual({ patientId: 1, visitDate: '2026-08-20', comment: 'Gewichtsverlust' });
  });

  it('erlaubt neue Visiten ohne den alten Pflichtbuchstaben', () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO patient_visits (patientId, visitDate, actionNeeded, comment) VALUES (1, '2026-09-05', 0, 'Ohne Bewertung')",
        )
        .run(),
    ).not.toThrow();
  });

  it('räumt Visiten beim Löschen der Person weiterhin mit ab', () => {
    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM patients WHERE id = 1').run();

    const remaining = db
      .prepare('SELECT COUNT(*) as count FROM patient_visits WHERE patientId = 1')
      .get() as { count: number };
    expect(remaining.count).toBe(0);
  });

  it('legt die Tabellen für MD-Prüfungen an', () => {
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[]
    ).map((row) => row.name);

    expect(tables).toEqual(expect.arrayContaining(['audits', 'audit_results', 'audit_clients']));
  });

  it('lässt nur die definierten Prüfergebnisse zu', () => {
    db.prepare("INSERT INTO audits (id, auditDate, inspector) VALUES (1, '2025-11-12', 'MD Nord')").run();

    expect(() =>
      db.prepare("INSERT INTO audit_results (auditId, sectionKey, result) VALUES (1, 'qb1', 'B')").run(),
    ).not.toThrow();
    expect(() =>
      db.prepare("INSERT INTO audit_results (auditId, sectionKey, result) VALUES (1, 'qb1', 'Z')").run(),
    ).toThrow();
  });

  it('ist wiederholbar, ohne Daten zu verlieren', () => {
    v014_qpr_stichprobe.up(db as never);

    const count = db.prepare('SELECT COUNT(*) as count FROM patient_visits').get() as { count: number };
    expect(count.count).toBe(3);

    const patient = db
      .prepare('SELECT legacyQprStatus FROM patients WHERE id = 1')
      .get() as { legacyQprStatus: string };
    expect(patient.legacyQprStatus).toBe('C');
  });
});
