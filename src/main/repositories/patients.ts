import { requireBirthDate } from '../../utils/calendarDate';
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
  CareLevel,
  PatientService,
  ServiceType,
} from '../../shared/types';
import {
  deriveServiceScope,
  isActivePatient,
  needsAssessment,
  hkpCodesOf,
  representativeMissing,
  teilgruppeOf,
} from '../../utils/qpr';
import { localDate, requireDate } from '../../utils/calendarDate';
import { getDb } from '../database/connection';
import { isCareLevel } from '../../utils/careLevel';

const PATIENT_COLUMNS = `
  p.id,
  p.name,
  p.birthDate,
  p.diagnosis,
  p.note,
  p.createdAt, p.legacyQprStatus,
  p.contact,
  p.admissionDate,
  p.cognitionImpaired,
  p.mobilityImpaired,
  p.hkpCode,
  p.intensiveCare,
  p.careLevel, p.serviceStatus,p.serviceEndDate,p.serviceScope,p.representativeStatus,
  p.hkpCodes,p.assessmentSource,p.assessmentDate,p.assessmentNote,p.akiSetting,p.phkpFirst,p.phkpStartDate,
  p.serviceScopeSource
`;

type PatientRow = Omit<
  Patient,
  'cognitionImpaired' | 'mobilityImpaired' | 'hkpCodes' | 'phkpFirst'
> & {
  hkpCodes: string;
  phkpFirst: number;
  cognitionImpaired: number | null;
  mobilityImpaired: number | null;
};

const toBool = (value: number | null | undefined): boolean | null =>
  value == null ? null : value === 1;

const fromBool = (value: boolean | null | undefined): number | null =>
  value == null ? null : value ? 1 : 0;

const servicesForPatient = (patientId: number): PatientService[] =>
  getDb()
    .prepare(
      `SELECT ps.serviceDefinitionId, sd.name as label, ps.labelSnapshot, sd.serviceType
       FROM patient_services ps
       JOIN service_definitions sd ON sd.id=ps.serviceDefinitionId
       WHERE ps.patientId=? ORDER BY sd.sortOrder, sd.id`,
    )
    .all(patientId) as PatientService[];

const mapPatient = (row: PatientRow): Patient => ({
  ...(row as Omit<PatientRow, 'cognitionImpaired' | 'mobilityImpaired' | 'hkpCodes' | 'phkpFirst'>),
  hkpCodes: JSON.parse(row.hkpCodes || '[]'),
  phkpFirst: row.phkpFirst === 1,
  cognitionImpaired: toBool(row.cognitionImpaired),
  mobilityImpaired: toBool(row.mobilityImpaired),
});

const withServices = (patient: Patient): Patient => {
  const services = patient.id ? servicesForPatient(patient.id) : [];
  return {
    ...patient,
    services,
    serviceDefinitionIds: services.map((service) => service.serviceDefinitionId),
  };
};

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
        (SELECT visitDate FROM patient_visits WHERE patientId = p.id AND status='completed' AND visitDate <= date('now','localtime') ORDER BY visitDate DESC,id DESC LIMIT 1) as latestVisitDate,
        EXISTS(SELECT 1 FROM patient_visits WHERE patientId=p.id AND status='completed' AND visitDate<=date('now','localtime') AND actionNeeded=1 AND resolvedAt IS NULL) as latestActionNeeded,
        (SELECT COUNT(*) FROM patient_visits WHERE patientId = p.id) as visitCount
      FROM patients p
      ORDER BY p.name ASC
    `,
    )
    .all() as (PatientRow & {
    latestActionNeeded: number | null;
    latestVisitDate: string | null;
    visitCount: number;
  })[];

  return rows.map((row) => ({
    ...withServices(mapPatient(row)),
    latestActionNeeded: toBool(row.latestActionNeeded),
    ...(db
      .prepare(
        "SELECT assignedTo as openActionOwner, actionDueDate as openActionDueDate FROM patient_visits WHERE patientId=? AND status='completed' AND actionNeeded=1 AND resolvedAt IS NULL ORDER BY COALESCE(actionDueDate,visitDate),id LIMIT 1",
      )
      .get(row.id) as
      | { openActionOwner: string | null; openActionDueDate: string | null }
      | undefined),
  }));
};

/**
 * Get a single patient by ID
 */
export const getPatient = (id: number): Patient | null => {
  const db = getDb();
  const row = db.prepare(`SELECT ${PATIENT_COLUMNS} FROM patients p WHERE p.id = ?`).get(id) as
    | PatientRow
    | undefined;
  return row ? withServices(mapPatient(row)) : null;
};

export type SavePatientInput = {
  serviceStatus?: 'active' | 'ended';
  serviceEndDate?: string | null;
  serviceScope?: 'eligible' | 'excluded' | 'unknown';
  serviceDefinitionIds?: number[];
  serviceScopeSource?: 'services' | 'legacy';
  representativeStatus?: 'present' | 'none' | 'unknown';
  hkpCodes?: HkpCode[];
  assessmentSource?: 'report' | 'own' | 'unknown';
  assessmentDate?: string | null;
  assessmentNote?: string | null;
  akiSetting?: 'EV' | 'MV' | null;
  phkpFirst?: boolean;
  phkpStartDate?: string | null;

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
  careLevel?: CareLevel | null;
};

/**
 * Save (create or update) a patient
 */
export const savePatient = (input: SavePatientInput): PatientWithLatestVisit[] => {
  const db = getDb();

  const existing = input.id ? getPatient(input.id) : null;
  if (input.id && !existing) throw new Error('Person nicht gefunden.');
  const merged = { ...existing, ...input };
  requireBirthDate(input.birthDate);
  if (!merged.name.trim()) throw new Error('Name darf nicht leer sein.');
  for (const value of [
    merged.admissionDate,
    merged.serviceEndDate,
    merged.assessmentDate,
    merged.phkpStartDate,
  ]) {
    if (value) requireDate(value);
  }
  if (merged.serviceEndDate && merged.admissionDate && merged.serviceEndDate < merged.admissionDate)
    throw new Error('Versorgungsende liegt vor der Aufnahme.');
  if (merged.assessmentDate && merged.assessmentDate > localDate())
    throw new Error('Einschätzungsdatum darf nicht in der Zukunft liegen.');
  if (merged.careLevel != null && !isCareLevel(merged.careLevel))
    throw new Error('Ungültiger Pflegegrad.');
  const codes = [
    ...new Set(
      input.hkpCodes ??
        (input.hkpCode !== undefined ? (input.hkpCode ? [input.hkpCode] : []) : hkpCodesOf(merged)),
    ),
  ];
  if (codes.some((c) => !['6', '8', '29', '31a'].includes(c)))
    throw new Error('Ungültige HKP-Ziffer.');
  const hasServiceRecord = input.serviceDefinitionIds !== undefined;
  const serviceIds = hasServiceRecord
    ? [...new Set(input.serviceDefinitionIds ?? [])]
    : existing?.serviceDefinitionIds ?? [];
  if (hasServiceRecord && serviceIds.some((id) => !Number.isInteger(id) || id <= 0))
    throw new Error('Ungültige Leistung ausgewählt.');
  let serviceTypes: ServiceType[] = [];
  let selectedDefinitions: Array<{
    id: number;
    name: string;
    active: number;
    serviceType: ServiceType;
  }> = [];
  if (serviceIds.length) {
    selectedDefinitions = db
      .prepare(
        'SELECT id,name,active,serviceType FROM service_definitions WHERE id IN (' +
          serviceIds.map(() => '?').join(',') +
          ')',
      )
      .all(...serviceIds) as Array<{
      id: number;
      name: string;
      active: number;
      serviceType: ServiceType;
    }>;
    if (selectedDefinitions.length !== serviceIds.length)
      throw new Error('Unbekannte Leistung ausgewählt.');
    const existingIds = new Set(existing?.serviceDefinitionIds ?? []);
    if (
      hasServiceRecord &&
      selectedDefinitions.some(
        (definition) => definition.active !== 1 && !existingIds.has(definition.id),
      )
    )
      throw new Error('Inaktive Leistungen können nicht neu zugeordnet werden.');
    serviceTypes = selectedDefinitions.map((row) => row.serviceType);
  } else if (!hasServiceRecord) {
    serviceTypes = (existing?.services ?? []).map((service) => service.serviceType);
  }
  const source = hasServiceRecord
    ? 'services'
    : input.serviceScopeSource ?? (input.id ? existing?.serviceScopeSource ?? 'legacy' : 'legacy');
  const derivedScope =
    source === 'services'
      ? deriveServiceScope(serviceTypes).scope
      : (input.serviceScope ?? merged.serviceScope ?? 'unknown');
  const params = {
    name: merged.name.trim(),
    birthDate: merged.birthDate ?? null,
    diagnosis: merged.diagnosis ?? null,
    note: merged.note ?? null,
    contact: merged.contact ?? null,
    admissionDate: merged.admissionDate ?? null,
    cognitionImpaired: fromBool(merged.cognitionImpaired),
    mobilityImpaired: fromBool(merged.mobilityImpaired),
    hkpCode: codes[0] ?? null,
    hkpCodes: JSON.stringify(codes),
    intensiveCare: merged.intensiveCare ?? null,
    careLevel: merged.careLevel ?? null,
    serviceStatus: merged.serviceStatus ?? 'active',
    serviceEndDate: merged.serviceEndDate ?? null,
    serviceScope: derivedScope,
    serviceScopeSource: source,
    representativeStatus:
      merged.representativeStatus ?? (merged.contact?.trim() ? 'present' : 'unknown'),
    assessmentSource: merged.assessmentSource ?? 'unknown',
    assessmentDate: merged.assessmentDate ?? null,
    assessmentNote: merged.assessmentNote ?? null,
    akiSetting: merged.akiSetting ?? null,
    phkpFirst: merged.phkpFirst ? 1 : 0,
    phkpStartDate: merged.phkpStartDate ?? null,
  };
  if (
    !['active', 'ended'].includes(params.serviceStatus) ||
    !['eligible', 'excluded', 'unknown'].includes(params.serviceScope) ||
    !['report', 'own', 'unknown'].includes(params.assessmentSource) ||
    !['services', 'legacy'].includes(params.serviceScopeSource) ||
    !['present', 'none', 'unknown'].includes(params.representativeStatus) ||
    (params.akiSetting && !['EV', 'MV'].includes(params.akiSetting))
  )
    throw new Error('Ungültiger Versorgungsstatus.');
  const keys = Object.keys(params);
  const persist = db.transaction(() => {
    let patientId = input.id;
    if (input.id)
      db.prepare(`UPDATE patients SET ${keys.map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({
        ...params,
        id: input.id,
      });
    else {
      db.prepare(
        `INSERT INTO patients (${keys.join(',')}) VALUES (${keys.map((k) => `@${k}`).join(',')})`,
      ).run(params);
      patientId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
    }

    if (hasServiceRecord && patientId) {
      const currentIds = new Set(existing?.serviceDefinitionIds ?? []);
      const nextIds = new Set(serviceIds);
      const remove = [...currentIds].filter((id) => !nextIds.has(id));
      const deleteAssignment = db.prepare(
        'DELETE FROM patient_services WHERE patientId=? AND serviceDefinitionId=?',
      );
      remove.forEach((id) => deleteAssignment.run(patientId, id));
      const insert = db.prepare(
        'INSERT INTO patient_services(patientId,serviceDefinitionId,labelSnapshot) VALUES (?,?,?)',
      );
      selectedDefinitions
        .filter((definition) => !currentIds.has(definition.id))
        .forEach((definition) => insert.run(patientId, definition.id, definition.name));
    }
  });
  persist();

  return listPatients();
};

/**
 * Delete a patient
 */
export const deletePatient = (id: number): PatientWithLatestVisit[] => {
  const db = getDb();
  db.prepare(
    "UPDATE patients SET serviceStatus='ended',serviceEndDate=COALESCE(serviceEndDate,?) WHERE id=?",
  ).run(localDate(), id);
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
      SELECT id, patientId, visitDate, actionNeeded, comment, createdAt, resolvedAt, status, assignedTo, actionDueDate, legacyQprRating
      FROM patient_visits
      WHERE patientId = ?
      ORDER BY visitDate DESC,id DESC
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
  resolvedAt?: string | null;
  status?: 'planned' | 'completed';
  assignedTo?: string | null;
  actionDueDate?: string | null;
}): PatientVisit[] => {
  const db = getDb();

  requireDate(input.visitDate);
  if (input.actionDueDate) requireDate(input.actionDueDate);
  const status = input.status ?? (input.visitDate > localDate() ? 'planned' : 'completed');
  if (
    !['planned', 'completed'].includes(status) ||
    (status === 'completed' && input.visitDate > localDate())
  )
    throw new Error('Eine zukünftige Visite kann nur geplant werden.');
  if (input.resolvedAt) {
    requireDate(input.resolvedAt);
    if (input.resolvedAt < input.visitDate || input.resolvedAt > localDate())
      throw new Error('Erledigung muss zwischen Visite und heute liegen.');
  }
  const params = {
    assignedTo: input.assignedTo?.trim() || null,
    actionDueDate: input.actionDueDate || null,
    status,
    patientId: input.patientId,
    visitDate: input.visitDate,
    actionNeeded: input.actionNeeded ? 1 : 0,
    comment: input.comment ?? null,
    resolvedAt: input.resolvedAt ?? null,
  };
  if (input.id) {
    const old = db.prepare('SELECT patientId FROM patient_visits WHERE id=?').get(input.id) as
      | { patientId: number }
      | undefined;
    if (!old || old.patientId !== input.patientId)
      throw new Error('Visite gehört nicht zu dieser Person.');
    db.prepare(
      'UPDATE patient_visits SET visitDate=@visitDate,actionNeeded=@actionNeeded,comment=@comment,resolvedAt=@resolvedAt,status=@status,assignedTo=@assignedTo,actionDueDate=@actionDueDate WHERE id=@id AND patientId=@patientId',
    ).run({ ...params, id: input.id });
  } else
    db.prepare(
      'INSERT INTO patient_visits (patientId,visitDate,actionNeeded,comment,resolvedAt,status,assignedTo,actionDueDate) VALUES (@patientId,@visitDate,@actionNeeded,@comment,@resolvedAt,@status,@assignedTo,@actionDueDate)',
    ).run(params);

  return listVisits(input.patientId);
};

/**
 * Delete a visit
 */
export const deleteVisit = (id: number, patientId: number): PatientVisit[] => {
  const db = getDb();
  db.prepare('DELETE FROM patient_visits WHERE id = ? AND patientId = ?').run(id, patientId);
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
      SELECT id, patientId, visitDate, actionNeeded, comment, createdAt, resolvedAt, status, assignedTo, actionDueDate, legacyQprRating
      FROM (
        SELECT
          v.*,
          ROW_NUMBER() OVER (PARTITION BY v.patientId ORDER BY v.visitDate DESC,v.id DESC) AS rn
        FROM patient_visits v WHERE v.status='completed'
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
export const getActionNeeded = (limit = -1): PatientActionNeeded[] =>
  getDb()
    .prepare(
      `
  SELECT p.id as patientId,p.name as patientName,v.id as visitId,v.visitDate,v.comment
  FROM patients p JOIN patient_visits v ON v.patientId=p.id
  WHERE p.serviceStatus='active' AND (p.serviceEndDate IS NULL OR p.serviceEndDate>=?)
    AND v.status='completed' AND v.visitDate<=? AND v.actionNeeded=1 AND v.resolvedAt IS NULL
  ORDER BY v.visitDate,v.id LIMIT ?`,
    )
    .all(localDate(), localDate(), limit) as PatientActionNeeded[];

/**
 * Get upcoming patient birthdays within a date range
 */
export const listPatientBirthdays = (
  startDate: string,
  endDate: string,
): {
  patientId: number;
  patientName: string;
  birthDate: string;
  date: string;
  hasKnownYear: boolean;
}[] => {
  const db = getDb();
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const results: {
    patientId: number;
    patientName: string;
    birthDate: string;
    date: string;
    hasKnownYear: boolean;
  }[] = [];

  // Get all patients with birth dates
  const patients = db
    .prepare(
      `SELECT id, name, birthDate, admissionDate, serviceEndDate FROM patients WHERE birthDate IS NOT NULL AND serviceStatus='active'`,
    )
    .all() as {
    id: number;
    name: string;
    birthDate: string;
    admissionDate: string | null;
    serviceEndDate: string | null;
  }[];

  for (const patient of patients) {
    const birthDate = new Date(`${patient.birthDate}T12:00:00`);
    const birthYear = parseInt(patient.birthDate.slice(0, 4), 10);
    const hasKnownYear = birthYear > 0;

    // Check each year in range
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      const thisYearBirthday = new Date(year, birthDate.getMonth(), birthDate.getDate());
      if (
        localDate(thisYearBirthday) >= startDate &&
        localDate(thisYearBirthday) <= endDate &&
        thisYearBirthday.getMonth() === birthDate.getMonth() &&
        (!patient.admissionDate || patient.admissionDate <= localDate(thisYearBirthday)) &&
        (!patient.serviceEndDate || patient.serviceEndDate >= localDate(thisYearBirthday))
      ) {
        results.push({
          patientId: patient.id,
          patientName: patient.name,
          birthDate: patient.birthDate,
          date: localDate(thisYearBirthday),
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
): {
  visitId: number;
  patientId: number;
  patientName: string;
  visitDate: string;
  status: 'planned' | 'completed';
  actionNeeded: boolean;
  comment: string | null;
}[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        v.id as visitId,
        v.patientId,
        p.name as patientName,
        v.visitDate,
        v.status,
        CASE WHEN v.status='completed' AND v.resolvedAt IS NULL THEN v.actionNeeded ELSE 0 END AS actionNeeded,
        v.comment
      FROM patient_visits v
      INNER JOIN patients p ON v.patientId = p.id
      WHERE date(v.visitDate) >= date(?)
        AND date(v.visitDate) <= date(?)
      ORDER BY v.visitDate ASC
    `,
    )
    .all(startDate, endDate) as {
    visitId: number;
    patientId: number;
    patientName: string;
    visitDate: string;
    status: 'planned' | 'completed';
    actionNeeded: number;
    comment: string | null;
  }[];

  return rows.map((row) => ({ ...row, actionNeeded: row.actionNeeded === 1 }));
};

export const getPatientStats = (): PatientStats => {
  const patients = listPatients().filter((p) => isActivePatient(p));
  const byGroup = { A: 0, B: 0, C: 0, none: 0, unrated: 0 };
  patients.forEach((p) => {
    const group = needsAssessment(p) ? null : teilgruppeOf(p.cognitionImpaired, p.mobilityImpaired);
    if (group == null) byGroup.unrated++;
    else byGroup[group]++;
  });
  const recent = getDb()
    .prepare(
      `SELECT COUNT(*) as count FROM patient_visits WHERE status='completed' AND visitDate BETWEEN date(?,'-30 days') AND ?`,
    )
    .get(localDate(), localDate()) as { count: number };
  return {
    totalPatients: patients.length,
    byGroup,
    hkpCount: patients.filter((p) => hkpCodesOf(p).length > 0).length,
    intensiveCareCount: patients.filter((p) => p.intensiveCare).length,
    recentVisits: recent.count,
    actionNeededCount: getActionNeeded().length,
    missingContactCount: patients.filter(representativeMissing).length,
  };
};
