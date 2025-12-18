/**
 * Migration v010: Patients and Patient Visits
 *
 * Creates tables for patient management with QPR 2026 rating system:
 * - patients: Core patient data (name, birthDate, diagnosis, qprStatus)
 * - patient_visits: Visit records with QPR A-D ratings
 *
 * QPR 2026 Rating Scale:
 * A - Keine Auffälligkeiten (No issues)
 * B - Auffälligkeiten ohne Risiko (Issues without risk)
 * C - Defizite mit Risiko negativer Folgen (Deficits with risk)
 * D - Defizite mit eingetretenen negativen Folgen (Deficits with consequences)
 */

import type { Migration } from './index';

export const v010_patients: Migration = {
  version: 10,
  description: 'Add patients and patient_visits tables for QPR 2026 tracking',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        birthDate TEXT,
        diagnosis TEXT,
        qprStatus TEXT CHECK(qprStatus IN ('A', 'B', 'C', 'D')),
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
      CREATE INDEX IF NOT EXISTS idx_patients_qpr ON patients(qprStatus);

      CREATE TABLE IF NOT EXISTS patient_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patientId INTEGER NOT NULL,
        visitDate TEXT NOT NULL,
        qprRating TEXT NOT NULL CHECK(qprRating IN ('A', 'B', 'C', 'D')),
        comment TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_visits_patient ON patient_visits(patientId);
      CREATE INDEX IF NOT EXISTS idx_visits_date ON patient_visits(visitDate);
      CREATE INDEX IF NOT EXISTS idx_visits_rating ON patient_visits(qprRating);
    `);
  },
};
