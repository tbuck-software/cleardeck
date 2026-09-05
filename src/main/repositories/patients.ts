/**
 * Patient Repository
 *
 * Stammdaten carry the MD sampling attributes (Modul 1/2, HKP code, AKI);
 * Pflegevisiten carry actionNeeded. The Teilgruppe itself is never stored —
 * it is derived, so it cannot drift out of sync with the assessment fields.
 */

import type {
  HkpCode,
  IntensiveCare,
  Patient,
  PatientVisit,
  PatientWithLatestVisit,
  PatientActionNeeded,
  PatientStats,
} from '../../shared/types';
import { teilgruppeOf } from '../../utils/qpr';
import { getDb } from '../database/connection';

const PATIENT_COLUMNS = `
  p.id,
  p.name,
  p.birthDate,
  p.diagnosis,
  p.note,
  p.createdAt,
  p.contact,
  p.admissionDate,
  p.cognitionImpaired,
  p.mobilityImpaired,
  p.hkpCode,
  p.intensiveCare,
  p.careLevel
`;

type PatientRow = Omit<Patient, 'cognitionImpaired' | 'mobilityImpaired'> & {
  cognitionImpaired: number | null;
  mobilityImpaired: number | null;
};

const toBool = (value: number | null | undefined): boolean | null =>
  value == null ? null : value === 1;

const fromBool = (value: boolean | null | undefined): number | null =>
  value == null ? null : value ? 1 : 0;

const mapPatient = (row: PatientRow): Patient => ({
  ...(row as Omit<PatientRow, 'cognitionImpaired' | 'mobilityImpaired'>),
  cognitionImpaired: toBool(row.cognitionImpaired),
  mobilityImpaired: toBool(row.mobilityImpaired),
});

/**
 * List all patients with their latest visit info
 */
export const listPatients = (): PatientWithLatestVisit[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        ${PATIENT_COLUMNS},
        (SELECT visitDate FROM patient_visits WHERE patientId = p.id ORDER BY visitDate DESC LIMIT 1) as latestVisitDate,
        (SELECT actionNeeded FROM patient_visits WHERE patientId = p.id ORDER BY visitDate DESC LIMIT 1) as latestActionNeeded,
        (SELECT COUNT(*) FROM patient_visits WHERE patientId = p.id) as visitCount
      FROM patients p
      ORDER BY p.name ASC
    `,
    )
    .all() as (PatientRow & { latestActionNeeded: number | null; latestVisitDate: string | null; visitCount: number })[];

  return rows.map((row) => ({
    ...mapPatient(row),
    latestActionNeeded: toBool(row.latestActionNeeded),
  }));
};

/**
 * Get a single patient by ID
 */
export const getPatient = (id: number): Patient | null => {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${PATIENT_COLUMNS} FROM patients p WHERE p.id = ?`)
    .get(id) as PatientRow | undefined;
  return row ? mapPatient(row) : null;
};

export type SavePatientInput = {
  id?: number;
  name: string;
  birthDate?: string | null;
  diagnosis?: string | null;
  note?: string | null;
  contact?: string | null;
  admissionDate?: string | null;
  cognitionImpaired?: boolean | null;
  mobilityImpaired?: boolean | null;
  hkpCode?: HkpCode | null;
  intensiveCare?: IntensiveCare | null;
  careLevel?: number | null;
};

/**
 * Save (create or update) a patient
 */
export const savePatient = (input: SavePatientInput): PatientWithLatestVisit[] => {
  const db = getDb();

  const params = {
    name: input.name,
    birthDate: input.birthDate ?? null,
    diagnosis: input.diagnosis ?? null,
    note: input.note ?? null,
    contact: input.contact ?? null,
    admissionDate: input.admissionDate ?? null,
    cognitionImpaired: fromBool(input.cognitionImpaired),
    mobilityImpaired: fromBool(input.mobilityImpaired),
    hkpCode: input.hkpCode ?? null,
    intensiveCare: input.intensiveCare ?? null,
    careLevel: input.careLevel ?? null,
  };

  if (input.id) {
    db.prepare(
      `
      UPDATE patients
      SET name = @name, birthDate = @birthDate, diagnosis = @diagnosis, note = @note,
          contact = @contact, admissionDate = @admissionDate,
          cognitionImpaired = @cognitionImpaired, mobilityImpaired = @mobilityImpaired,
          hkpCode = @hkpCode, intensiveCare = @intensiveCare, careLevel = @careLevel
      WHERE id = @id
    `,
    ).run({ ...params, id: input.id });
  } else {
    db.prepare(
      `
      INSERT INTO patients (name, birthDate, diagnosis, note, contact, admissionDate,
                            cognitionImpaired, mobilityImpaired, hkpCode, intensiveCare, careLevel)
      VALUES (@name, @birthDate, @diagnosis, @note, @contact, @admissionDate,
              @cognitionImpaired, @mobilityImpaired, @hkpCode, @intensiveCare, @careLevel)
    `,
    ).run(params);
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

type VisitRow = Omit<PatientVisit, 'actionNeeded'> & { actionNeeded: number };

const mapVisit = (row: VisitRow): PatientVisit => ({
  ...row,
  actionNeeded: row.actionNeeded === 1,
});

/**
 * List all visits for a patient
 */
export const listVisits = (patientId: number): PatientVisit[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, patientId, visitDate, actionNeeded, comment, createdAt
      FROM patient_visits
      WHERE patientId = ?
      ORDER BY visitDate DESC
    `,
    )
    .all(patientId) as VisitRow[];
  return rows.map(mapVisit);
};

/**
 * Save (create or update) a visit
 */
export const saveVisit = (input: {
  id?: number;
  patientId: number;
  visitDate: string;
  actionNeeded: boolean;
  comment?: string | null;
}): PatientVisit[] => {
  const db = getDb();

  if (input.id) {
    db.prepare(
      `
      UPDATE patient_visits
      SET visitDate = @visitDate, actionNeeded = @actionNeeded, comment = @comment
      WHERE id = @id
    `,
    ).run({
      id: input.id,
      visitDate: input.visitDate,
      actionNeeded: input.actionNeeded ? 1 : 0,
      comment: input.comment ?? null,
    });
  } else {
    db.prepare(
      `
      INSERT INTO patient_visits (patientId, visitDate, actionNeeded, comment)
      VALUES (@patientId, @visitDate, @actionNeeded, @comment)
    `,
    ).run({
      patientId: input.patientId,
      visitDate: input.visitDate,
      actionNeeded: input.actionNeeded ? 1 : 0,
      comment: input.comment ?? null,
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
 * The last few visits of every patient, oldest first per patient — feeds the
 * trend bars in the list without a query per row.
 */
export const listRecentVisits = (perPatient = 4): Record<number, PatientVisit[]> => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, patientId, visitDate, actionNeeded, comment, createdAt
      FROM (
        SELECT
          v.*,
          ROW_NUMBER() OVER (PARTITION BY v.patientId ORDER BY v.visitDate DESC) AS rn
        FROM patient_visits v
      )
      WHERE rn <= ?
      ORDER BY patientId ASC, visitDate ASC
    `,
    )
    .all(perPatient) as VisitRow[];

  const grouped: Record<number, PatientVisit[]> = {};
  rows.forEach((row) => {
    const visit = mapVisit(row);
    (grouped[visit.patientId] ??= []).push(visit);
  });
  return grouped;
};

/**
 * Patients whose most recent visit recorded a follow-up — for the dashboard.
 * Only the latest visit counts: an older flag was answered by the visit after it.
 */
export const getActionNeeded = (limit = 10): PatientActionNeeded[] => {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        p.id as patientId,
        p.name as patientName,
        v.id as visitId,
        v.visitDate,
        v.comment
      FROM patients p
      INNER JOIN patient_visits v ON v.id = (
        SELECT id FROM patient_visits WHERE patientId = p.id ORDER BY visitDate DESC LIMIT 1
      )
      WHERE v.actionNeeded = 1
      ORDER BY v.visitDate DESC
      LIMIT ?
    `,
    )
    .all(limit) as PatientActionNeeded[];
};

/**
 * Get upcoming patient birthdays within a date range
 */
export const listPatientBirthdays = (
  startDate: string,
  endDate: string,
): { patientId: number; patientName: string; birthDate: string; date: string; hasKnownYear: boolean }[] => {
  const db = getDb();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results: { patientId: number; patientName: string; birthDate: string; date: string; hasKnownYear: boolean }[] = [];

  // Get all patients with birth dates
  const patients = db
    .prepare(`SELECT id, name, birthDate FROM patients WHERE birthDate IS NOT NULL`)
    .all() as { id: number; name: string; birthDate: string }[];

  for (const patient of patients) {
    const birthDate = new Date(patient.birthDate);
    const birthYear = parseInt(patient.birthDate.slice(0, 4), 10);
    const hasKnownYear = birthYear > 0;

    // Check each year in range
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      const thisYearBirthday = new Date(year, birthDate.getMonth(), birthDate.getDate());
      if (thisYearBirthday >= start && thisYearBirthday <= end) {
        results.push({
          patientId: patient.id,
          patientName: patient.name,
          birthDate: patient.birthDate,
          date: thisYearBirthday.toISOString().slice(0, 10),
          hasKnownYear,
        });
      }
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Get patient visits within a date range (for calendar)
 */
export const listPatientVisitsInRange = (
  startDate: string,
  endDate: string,
): { visitId: number; patientId: number; patientName: string; visitDate: string; actionNeeded: boolean; comment: string | null }[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        v.id as visitId,
        v.patientId,
        p.name as patientName,
        v.visitDate,
        v.actionNeeded,
        v.comment
      FROM patient_visits v
      INNER JOIN patients p ON v.patientId = p.id
      WHERE date(v.visitDate) >= date(?)
        AND date(v.visitDate) <= date(?)
      ORDER BY v.visitDate ASC
    `,
    )
    .all(startDate, endDate) as { visitId: number; patientId: number; patientName: string; visitDate: string; actionNeeded: number; comment: string | null }[];

  return rows.map((row) => ({ ...row, actionNeeded: row.actionNeeded === 1 }));
};

export const getPatientStats = (): PatientStats => {
  const db = getDb();

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number };

  const assessmentRows = db
    .prepare('SELECT cognitionImpaired, mobilityImpaired FROM patients')
    .all() as { cognitionImpaired: number | null; mobilityImpaired: number | null }[];

  const byGroup = { A: 0, B: 0, C: 0, none: 0, unrated: 0 };
  assessmentRows.forEach((row) => {
    const group = teilgruppeOf(toBool(row.cognitionImpaired), toBool(row.mobilityImpaired));
    if (group == null) byGroup.unrated += 1;
    else byGroup[group] += 1;
  });

  const hkpRow = db
    .prepare('SELECT COUNT(*) as count FROM patients WHERE hkpCode IS NOT NULL')
    .get() as { count: number };
  const intensiveRow = db
    .prepare('SELECT COUNT(*) as count FROM patients WHERE intensiveCare IS NOT NULL')
    .get() as { count: number };
  const contactRow = db
    .prepare("SELECT COUNT(*) as count FROM patients WHERE contact IS NULL OR TRIM(contact) = ''")
    .get() as { count: number };

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

  const actionRow = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM patients p
      INNER JOIN patient_visits v ON v.id = (
        SELECT id FROM patient_visits WHERE patientId = p.id ORDER BY visitDate DESC LIMIT 1
      )
      WHERE v.actionNeeded = 1
    `,
    )
    .get() as { count: number };

  return {
    totalPatients: totalRow.count,
    byGroup,
    hkpCount: hkpRow.count,
    intensiveCareCount: intensiveRow.count,
    recentVisits: recentRow.count,
    actionNeededCount: actionRow.count,
    missingContactCount: contactRow.count,
  };
};
