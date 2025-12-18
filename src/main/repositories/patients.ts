/**
 * Patient Repository
 *
 * Data access functions for patients and patient visits.
 * Implements QPR 2026 rating system (A-D scale).
 */

import type {
  Patient,
  PatientVisit,
  PatientWithLatestVisit,
  PatientConcerningRating,
  PatientStats,
  QprRating,
} from '../../shared/types';
import { getDb } from '../database/connection';

/**
 * List all patients with their latest visit info
 */
export const listPatients = (): PatientWithLatestVisit[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        p.id,
        p.name,
        p.birthDate,
        p.diagnosis,
        p.qprStatus,
        p.note,
        p.createdAt,
        (SELECT visitDate FROM patient_visits WHERE patientId = p.id ORDER BY visitDate DESC LIMIT 1) as latestVisitDate,
        (SELECT qprRating FROM patient_visits WHERE patientId = p.id ORDER BY visitDate DESC LIMIT 1) as latestQprRating,
        (SELECT COUNT(*) FROM patient_visits WHERE patientId = p.id) as visitCount
      FROM patients p
      ORDER BY p.name ASC
    `,
    )
    .all() as PatientWithLatestVisit[];
  return rows;
};

/**
 * Get a single patient by ID
 */
export const getPatient = (id: number): Patient | null => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Patient | undefined;
  return row ?? null;
};

/**
 * Save (create or update) a patient
 */
export const savePatient = (input: {
  id?: number;
  name: string;
  birthDate?: string | null;
  diagnosis?: string | null;
  qprStatus?: QprRating | null;
  note?: string | null;
}): PatientWithLatestVisit[] => {
  const db = getDb();

  if (input.id) {
    db.prepare(
      `
      UPDATE patients
      SET name = @name, birthDate = @birthDate, diagnosis = @diagnosis,
          qprStatus = @qprStatus, note = @note
      WHERE id = @id
    `,
    ).run({
      id: input.id,
      name: input.name,
      birthDate: input.birthDate ?? null,
      diagnosis: input.diagnosis ?? null,
      qprStatus: input.qprStatus ?? null,
      note: input.note ?? null,
    });
  } else {
    db.prepare(
      `
      INSERT INTO patients (name, birthDate, diagnosis, qprStatus, note)
      VALUES (@name, @birthDate, @diagnosis, @qprStatus, @note)
    `,
    ).run({
      name: input.name,
      birthDate: input.birthDate ?? null,
      diagnosis: input.diagnosis ?? null,
      qprStatus: input.qprStatus ?? null,
      note: input.note ?? null,
    });
  }

  return listPatients();
};

/**
 * Delete a patient
 */
export const deletePatient = (id: number): PatientWithLatestVisit[] => {
  const db = getDb();
  db.prepare('DELETE FROM patients WHERE id = ?').run(id);
  return listPatients();
};

/**
 * List all visits for a patient
 */
export const listVisits = (patientId: number): PatientVisit[] => {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT * FROM patient_visits
      WHERE patientId = ?
      ORDER BY visitDate DESC
    `,
    )
    .all(patientId) as PatientVisit[];
};

/**
 * Save (create or update) a visit
 */
export const saveVisit = (input: {
  id?: number;
  patientId: number;
  visitDate: string;
  qprRating: QprRating;
  comment?: string | null;
}): PatientVisit[] => {
  const db = getDb();

  if (input.id) {
    db.prepare(
      `
      UPDATE patient_visits
      SET visitDate = @visitDate, qprRating = @qprRating, comment = @comment
      WHERE id = @id
    `,
    ).run({
      id: input.id,
      visitDate: input.visitDate,
      qprRating: input.qprRating,
      comment: input.comment ?? null,
    });
  } else {
    db.prepare(
      `
      INSERT INTO patient_visits (patientId, visitDate, qprRating, comment)
      VALUES (@patientId, @visitDate, @qprRating, @comment)
    `,
    ).run({
      patientId: input.patientId,
      visitDate: input.visitDate,
      qprRating: input.qprRating,
      comment: input.comment ?? null,
    });

    // Update patient's qprStatus to match latest visit
    db.prepare(`UPDATE patients SET qprStatus = @qprRating WHERE id = @patientId`).run({
      qprRating: input.qprRating,
      patientId: input.patientId,
    });
  }

  return listVisits(input.patientId);
};

/**
 * Delete a visit
 */
export const deleteVisit = (id: number, patientId: number): PatientVisit[] => {
  const db = getDb();
  db.prepare('DELETE FROM patient_visits WHERE id = ?').run(id);
  return listVisits(patientId);
};

/**
 * Get patients with concerning ratings (C or D) - for dashboard
 */
export const getConcerningRatings = (limit = 10): PatientConcerningRating[] => {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        p.id as patientId,
        p.name as patientName,
        v.id as visitId,
        v.visitDate,
        v.qprRating,
        v.comment
      FROM patient_visits v
      INNER JOIN patients p ON v.patientId = p.id
      WHERE v.qprRating IN ('C', 'D')
      ORDER BY v.visitDate DESC, v.qprRating DESC
      LIMIT ?
    `,
    )
    .all(limit) as PatientConcerningRating[];
};

/**
 * Get patient statistics - for dashboard
 */
export const getPatientStats = (): PatientStats => {
  const db = getDb();

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number };

  const ratingRows = db
    .prepare(
      `
      SELECT qprStatus, COUNT(*) as count
      FROM patients
      GROUP BY qprStatus
    `,
    )
    .all() as { qprStatus: QprRating | null; count: number }[];

  const byRating = { A: 0, B: 0, C: 0, D: 0, unrated: 0 };
  ratingRows.forEach((row) => {
    if (row.qprStatus) {
      byRating[row.qprStatus] = row.count;
    } else {
      byRating.unrated = row.count;
    }
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRow = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM patient_visits
      WHERE date(visitDate) >= date(?)
    `,
    )
    .get(thirtyDaysAgo.toISOString().slice(0, 10)) as { count: number };

  const concerningRow = db
    .prepare(
      `
      SELECT COUNT(DISTINCT patientId) as count
      FROM patient_visits
      WHERE qprRating IN ('C', 'D')
    `,
    )
    .get() as { count: number };

  return {
    totalPatients: totalRow.count,
    byRating,
    recentVisits: recentRow.count,
    concerningCount: concerningRow.count,
  };
};
