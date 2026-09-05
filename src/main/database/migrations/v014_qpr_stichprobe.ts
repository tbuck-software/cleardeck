/**
 * Migration v014: split the overloaded A–D letter into its three real meanings.
 *
 * v010 stored one `qprStatus` per patient and one `qprRating` per visit, both
 * on an A–D "rating" scale. docs/adr/0001 rejects that model: A–D is the MD's
 * *sampling group*, derived from the Pflegegrad assessment — not a judgement,
 * and not something a Pflegevisite produces.
 *
 * The old letters are therefore NOT reinterpreted as Teilgruppen; that would
 * invent assessment data. They are preserved verbatim in legacy columns and
 * the new assessment fields start empty, so the app reports each person as a
 * data gap until Modul 1/2 is entered. Visit letters do map: the app already
 * treated C/D as "concerning", which is exactly the new actionNeeded flag.
 */

import type { Migration } from './index';

type Db = Parameters<Migration['up']>[0];

const columnNames = (db: Db, table: string): string[] =>
  (db.prepare(`PRAGMA table_info('${table}')`).all() as Array<{ name: string }>).map((c) => c.name);

const tableExists = (db: Db, name: string): boolean =>
  Boolean(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name) as
      | { name?: string }
      | undefined)?.name,
  );

export const v014_qpr_stichprobe: Migration = {
  version: 14,
  description: 'Separate QPR Teilgruppe, Pflegevisite and Prüfergebnis; add audit tables',
  up: (db) => {
    if (!tableExists(db, 'patients')) return;

    const patientColumns = columnNames(db, 'patients');
    const addPatientColumn = (name: string, sqlType: string) => {
      if (patientColumns.includes(name)) return;
      db.exec(`ALTER TABLE patients ADD COLUMN ${name} ${sqlType}`);
    };

    addPatientColumn('contact', 'TEXT');
    addPatientColumn('admissionDate', 'TEXT');
    addPatientColumn('cognitionImpaired', 'INTEGER');
    addPatientColumn('mobilityImpaired', 'INTEGER');
    addPatientColumn('hkpCode', 'TEXT');
    addPatientColumn('intensiveCare', 'TEXT');
    addPatientColumn('careLevel', 'INTEGER');
    addPatientColumn('legacyQprStatus', 'TEXT');

    // Park the old per-patient letter rather than reading a Teilgruppe into it.
    if (patientColumns.includes('qprStatus')) {
      db.exec(
        'UPDATE patients SET legacyQprStatus = qprStatus WHERE qprStatus IS NOT NULL AND legacyQprStatus IS NULL',
      );
    }

    db.exec('CREATE INDEX IF NOT EXISTS idx_patients_hkp ON patients(hkpCode)');

    // patient_visits is rebuilt: qprRating was NOT NULL with a CHECK, so new
    // rows could not be written without supplying a letter that no longer exists.
    const visitColumns = columnNames(db, 'patient_visits');
    if (tableExists(db, 'patient_visits') && !visitColumns.includes('actionNeeded')) {
      const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
      db.pragma('foreign_keys = OFF');

      db.exec(`
        CREATE TABLE patient_visits_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patientId INTEGER NOT NULL,
          visitDate TEXT NOT NULL,
          actionNeeded INTEGER NOT NULL DEFAULT 0,
          comment TEXT,
          legacyQprRating TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );
      `);

      const hasRating = visitColumns.includes('qprRating');
      db.exec(`
        INSERT INTO patient_visits_new (id, patientId, visitDate, actionNeeded, comment, legacyQprRating, createdAt)
        SELECT
          id,
          patientId,
          visitDate,
          ${hasRating ? "CASE WHEN qprRating IN ('C', 'D') THEN 1 ELSE 0 END" : '0'},
          comment,
          ${hasRating ? 'qprRating' : 'NULL'},
          createdAt
        FROM patient_visits;
      `);

      db.exec('DROP TABLE patient_visits;');
      db.exec('ALTER TABLE patient_visits_new RENAME TO patient_visits;');
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_visits_patient ON patient_visits(patientId);
        CREATE INDEX IF NOT EXISTS idx_visits_date ON patient_visits(visitDate);
        CREATE INDEX IF NOT EXISTS idx_visits_action ON patient_visits(actionNeeded);
      `);

      if (foreignKeys) db.pragma('foreign_keys = ON');
    }

    // External MD results: one row per audit, per quality aspect, per sampled client.
    db.exec(`
      CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auditDate TEXT NOT NULL,
        inspector TEXT,
        kind TEXT CHECK(kind IN ('regel', 'anlass')),
        findings TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(auditDate);

      CREATE TABLE IF NOT EXISTS audit_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auditId INTEGER NOT NULL,
        sectionKey TEXT NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('A', 'B', 'C', 'D', 'text', 'ok', 'no')),
        note TEXT,
        FOREIGN KEY (auditId) REFERENCES audits(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_audit_results_audit ON audit_results(auditId);

      CREATE TABLE IF NOT EXISTS audit_clients (
        auditId INTEGER NOT NULL,
        patientId INTEGER NOT NULL,
        PRIMARY KEY (auditId, patientId),
        FOREIGN KEY (auditId) REFERENCES audits(id) ON DELETE CASCADE,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );
    `);
  },
};
