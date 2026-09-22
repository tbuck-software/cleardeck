import { requireBirthDate } from '../../utils/calendarDate';
/**
 * Employee Repository
 *
 * Data access functions for employees and employment periods.
 */

import type {
  Aggregation,
  Employee,
  EmploymentPeriod,
  EmployeeWithPeriod,
  YearDataset,
} from '../../shared/types';

import { listWorkingTimes } from './workingTimes';
import { getDb } from '../database/connection';
import { buildEmployeeChangeEvents } from '../employeeHistory';
import { saveEvent } from './events';
import { daysBetween } from '../../utils/qpr';
import { localDate, requireDate, shiftDays } from '../../utils/calendarDate';
import { contiguousEmploymentStart, employmentMessages } from '../../utils/employment';
import { recordRepairEvent } from '../employmentRepairShared';
import { nextDeviceId } from '../syncRecords';
import {
  assertNoStrandedTerms,
  assertReportYear,
  findPeriodConflict,
  loadPeriod,
  updateEmployeeCache,
} from './employmentCore';

/**
 * Compute employee status for a given year
 */
const computeStatus = (endDate: string | null, year: number): 'active' | 'left' =>
  endDate && endDate <= (year < new Date().getFullYear() ? `${year}-12-31` : localDate())
    ? 'left'
    : 'active';

/**
 * Build aggregation data from employee list
 */
const buildAggregation = (employees: EmployeeWithPeriod[]): Aggregation => {
  let totalFte = 0;
  const categories = new Map<string, { headcount: number; fte: number }>();
  employees.forEach((emp) => {
    totalFte += emp.fte;
    const current = categories.get(emp.qualification) ?? { headcount: 0, fte: 0 };
    current.headcount += 1;
    current.fte += emp.fte;
    categories.set(emp.qualification, current);
  });

  return {
    totalHeadcount: employees.length,
    totalFte: Number(totalFte.toFixed(2)),
    categories: Array.from(categories.entries()).map(([qualification, value]) => ({
      qualification,
      headcount: value.headcount,
      fte: Number(value.fte.toFixed(2)),
    })),
  };
};

type EmployeePeriodRow = {
  employeeId: number;
  name: string;
  note: string | null;
  createdAt: string;
  birthDate: string | null;
  periodId: number;
  startDate: string;
  endDate: string | null;
  qualification: string;
  periodNote: string | null;
};

type PeriodWithEmployeeId = EmploymentPeriod & { employeeId: number };

type EmploymentTermSnapshot = {
  weeklyHours: number | null;
  fte: number;
  verified: number;
  effectiveFrom: string;
  sourceRef: string | null;
};

const buildEmploymentStartByPeriod = (allPeriods: PeriodWithEmployeeId[]) => {
  const periodsByEmployee = new Map<number, EmploymentPeriod[]>();
  allPeriods.forEach((period) => {
    const employeePeriods = periodsByEmployee.get(period.employeeId) ?? [];
    employeePeriods.push(period);
    periodsByEmployee.set(period.employeeId, employeePeriods);
  });
  const employmentStartByPeriod = new Map<number, string>();
  allPeriods.forEach((period) => {
    if (period.id == null) return;
    const start = contiguousEmploymentStart(
      periodsByEmployee.get(period.employeeId) ?? [],
      period.id,
      period.startDate,
    );
    if (start) employmentStartByPeriod.set(period.id, start);
  });
  return employmentStartByPeriod;
};

const mapEmployeePeriod = (
  db: ReturnType<typeof getDb>,
  row: EmployeePeriodRow,
  year: number,
  endIso: string,
  employmentStartByPeriod: Map<number, string>,
): EmployeeWithPeriod => {
  const reference = row.endDate && row.endDate < endIso ? row.endDate : endIso;
  const terms = db
    .prepare(
      'SELECT weeklyHours,fte,verified,effectiveFrom,sourceRef FROM employment_terms WHERE periodId=? AND effectiveFrom<=? ORDER BY effectiveFrom DESC LIMIT 1',
    )
    .get(row.periodId, reference) as EmploymentTermSnapshot | undefined;
  return {
    id: row.employeeId,
    periodId: row.periodId,
    name: row.name,
    qualification: row.qualification,
    startDate: row.startDate,
    endDate: row.endDate,
    employmentStartDate: employmentStartByPeriod.get(row.periodId) ?? row.startDate,
    birthDate: row.birthDate,
    note: row.periodNote ?? row.note,
    weeklyHours: terms?.weeklyHours ?? null,
    fte: terms?.fte ?? 0,
    sourceRef: terms?.sourceRef ?? null,
    workingTimes: listWorkingTimes(row.employeeId),
    hoursHistory: db
      .prepare(
        `SELECT h.id,h.effectiveFrom,h.weeklyHours,h.fte,h.verified,h.sourceRef,h.changedAt FROM employment_term_history h JOIN employment_periods p ON p.id=h.periodId WHERE p.employeeId=? ORDER BY h.id DESC`,
      )
      .all(row.employeeId) as EmployeeWithPeriod['hoursHistory'],
    hoursVerified: terms?.verified === 1,
    hoursMissing: !terms,
    hoursEffectiveFrom: terms?.effectiveFrom,
    status: computeStatus(row.endDate ?? null, year),
    createdAt: row.createdAt,
  };
};

/**
 * Get all employees with their current period for a given year
 */
export const getYearDataset = (
  year: number,
  mode: 'year' | 'stichtag' | 'current' | 'year-average' | 'month-end-average' | 'directory' = 'year',
): YearDataset => {
  assertReportYear(year);
  const db = getDb();
  const startIso = mode === 'directory' ? '1900-01-01' : `${year}-01-01`;
  const endIso =
    mode === 'directory' ? '2200-12-31' : mode === 'current' ? localDate() : `${year}-12-31`;
  const earliest = (
    db.prepare('SELECT MIN(startDate) as startDate FROM employment_periods').get() as {
      startDate: string | null;
    }
  ).startDate;
  const firstYear = Math.max(
    1900,
    Math.min(new Date().getFullYear() - 2, Number(earliest?.slice(0, 4)) || year),
  );
  const availableYears = Array.from(
    { length: new Date().getFullYear() - firstYear + 1 },
    (_, i) => firstYear + i,
  );
  const base = db.prepare("SELECT value FROM settings WHERE key='baseHours'").get() as
    | { value?: string }
    | undefined;
  const rows = db
    .prepare(
      `SELECT e.id AS employeeId,e.name,e.note,e.createdAt,e.birthDate,
    p.id AS periodId,p.startDate,p.endDate,p.qualification,p.note AS periodNote
    FROM employees e JOIN employment_periods p ON p.employeeId=e.id
    WHERE p.startDate<=? AND (p.endDate IS NULL OR p.endDate>=?) ORDER BY p.startDate DESC,p.id DESC`,
    )
    .all(
      endIso,
      mode === 'stichtag' || mode === 'current' ? endIso : startIso,
    ) as EmployeePeriodRow[];
  const allPeriods = db
    .prepare('SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods ORDER BY employeeId,startDate,id')
    .all() as PeriodWithEmployeeId[];
  const employmentStartByPeriod = buildEmploymentStartByPeriod(allPeriods);
  if (mode === 'year-average' || mode === 'month-end-average') {
    const employees: EmployeeWithPeriod[] = [];
    const yearDays = daysBetween(startIso, endIso) + 1;
    const monthEnds = Array.from({ length: 12 }, (_, month) =>
      localDate(new Date(year, month + 1, 0, 12)),
    );
    for (const row of rows) {
      const start = row.startDate > startIso ? row.startDate : startIso;
      const end = row.endDate && row.endDate < endIso ? row.endDate : endIso;
      const terms = db
        .prepare(
          'SELECT weeklyHours,fte,verified,effectiveFrom,sourceRef FROM employment_terms WHERE periodId=? AND effectiveFrom<=? ORDER BY effectiveFrom',
        )
        .all(row.periodId, end) as {
        weeklyHours: number | null;
        fte: number;
        verified: number;
        effectiveFrom: string;
        sourceRef: string | null;
      }[];
      const boundaries = [
        start,
        ...terms.map((t) => t.effectiveFrom).filter((date) => date > start && date <= end),
      ];
      for (let i = 0; i < boundaries.length; i++) {
        const segmentStart = boundaries[i],
          segmentEnd = i + 1 < boundaries.length ? shiftDays(boundaries[i + 1], -1) : end;
        const term = [...terms].reverse().find((t) => t.effectiveFrom <= segmentStart);
        const days = daysBetween(segmentStart, segmentEnd) + 1;
        const reportMonthEnds = mode === 'month-end-average'
          ? monthEnds.filter((date) => date >= segmentStart && date <= segmentEnd)
          : undefined;
        if (reportMonthEnds?.length === 0) continue;
        const weight = reportMonthEnds ? reportMonthEnds.length / 12 : days / yearDays;
        employees.push({
          id: row.employeeId,
          periodId: row.periodId,
          name: row.name,
          qualification: row.qualification,
          startDate: segmentStart,
          endDate: segmentEnd,
          employmentStartDate: employmentStartByPeriod.get(row.periodId) ?? row.startDate,
          birthDate: row.birthDate,
          note: row.periodNote ?? row.note,
          sourceRef: term?.sourceRef ?? null,
          weeklyHours: term?.weeklyHours ?? null,
          fte: (term?.fte ?? 0) * weight,
          unweightedFte: term?.fte ?? null,
          hoursVerified: term?.verified === 1,
          hoursMissing: !term,
          reportDays: reportMonthEnds ? undefined : days,
          reportMonthEnds,
          hoursEffectiveFrom: term?.effectiveFrom,
          status: computeStatus(row.endDate ?? null, year),
        });
      }
    }
    const aggregation = buildAggregation(employees);
    aggregation.totalHeadcount = new Set(employees.map((e) => e.id)).size;
    aggregation.categories.forEach((c) => {
      c.headcount = new Set(
        employees.filter((e) => e.qualification === c.qualification).map((e) => e.id),
      ).size;
    });
    return {
      employees,
      aggregation,
      availableYears,
      baseHours: Number(base?.value) || 36,
      reportMode: mode,
      referenceDate: endIso,
      unverifiedHoursCount: employees.filter((e) => !e.hoursVerified).length,
    };
  }
  const seen = new Set<number>();
  const employees: EmployeeWithPeriod[] = [];
  for (const row of rows) {
    if (seen.has(row.employeeId)) continue;
    seen.add(row.employeeId);
    employees.push(mapEmployeePeriod(db, row, year, endIso, employmentStartByPeriod));
  }
  employees.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return {
    employees,
    availableYears,
    aggregation: buildAggregation(employees),
    baseHours: Number(base?.value) || 36,
    reportMode: mode,
    referenceDate: endIso,
    unverifiedHoursCount: employees.filter((e) => !e.hoursVerified).length,
  };
};

/**
 * List all periods for an employee
 */
export const listPeriods = (employeeId: number): EmploymentPeriod[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, startDate, endDate, qualification, note
      FROM employment_periods
      WHERE employeeId = ?
      ORDER BY startDate DESC;
    `,
    )
    .all(employeeId) as EmploymentPeriod[];
  return rows;
};

/** Get one period with the same effective working-time mapping used by reports. */
export const getEmployeePeriod = (
  employeeId: number,
  periodId: number,
  year: number,
): EmployeeWithPeriod => {
  assertReportYear(year);
  const db = getDb();
  const row = db
    .prepare(
      `SELECT e.id AS employeeId,e.name,e.note,e.createdAt,e.birthDate,
       p.id AS periodId,p.startDate,p.endDate,p.qualification,p.note AS periodNote
       FROM employees e JOIN employment_periods p ON p.employeeId=e.id
       WHERE e.id=? AND p.id=?`,
    )
    .get(employeeId, periodId) as EmployeePeriodRow | undefined;
  if (!row) throw new Error('Beschäftigungsperiode nicht gefunden.');
  const employeePeriods = db
    .prepare('SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE employeeId=? ORDER BY startDate,id')
    .all(employeeId) as PeriodWithEmployeeId[];
  // Same reference date as the year dataset, so both map the same term.
  return mapEmployeePeriod(
    db,
    row,
    year,
    `${year}-12-31`,
    buildEmploymentStartByPeriod(employeePeriods),
  );
};

type PeriodBoundsInput = { startDate: string; endDate: string | null };

/** The single write path for period dates keeps the previous values as evidence. */
const recordPeriodDateCorrection = (
  before: EmploymentPeriod & { id: number; employeeId: number },
  after: PeriodBoundsInput,
): void => {
  if (before.startDate === after.startDate && (before.endDate ?? null) === after.endDate) return;
  recordRepairEvent(
    before.employeeId,
    'Zeitraum korrigiert – ursprüngliche Daten erhalten',
    'Die Beschäftigungsdaten wurden ausdrücklich korrigiert. Die ursprünglichen Daten bleiben hier als Nachweis erhalten.',
    {
      kind: 'employment-period-date-correction',
      period: {
        id: before.id,
        employeeId: before.employeeId,
        startDate: before.startDate,
        endDate: before.endDate ?? null,
        qualification: before.qualification,
        note: before.note ?? null,
      },
      correctedDates: { startDate: after.startDate, endDate: after.endDate },
    },
    `${before.startDate} – ${before.endDate ?? 'offen'}`,
    `${after.startDate} – ${after.endDate ?? 'offen'}`,
  );
};

/**
 * Save (create or update) an employee and their period
 */
export const saveEmployee = (input: {
  id?: number;
  periodId?: number;
  name: string;
  fte: number;
  weeklyHours?: number | null;
  startDate: string;
  endDate?: string | null;
  note?: string | null;
  periodNote?: string | null;
  year: number;
  qualification: string;
  birthDate?: string | null;
  sourceRef?: string | null;
  hoursEffectiveFrom?: string;
  hoursVerified?: boolean;
  updateHours?: boolean;
}): YearDataset => {
  const db = getDb();

  requireDate(input.startDate, 'Beginn');
  requireBirthDate(input.birthDate);
  if (input.endDate) {
    requireDate(input.endDate, 'Ende');
    if (input.endDate < input.startDate) throw new Error('Das Ende liegt vor dem Beginn.');
  }
  if (!input.name.trim() || !input.qualification.trim())
    throw new Error('Name und Qualifikation sind erforderlich.');
  if (!Number.isFinite(input.fte) || input.fte < 0 || input.fte > 1)
    throw new Error('VZÄ müssen zwischen 0 und 1 liegen.');
  if (
    input.weeklyHours != null &&
    (!Number.isFinite(input.weeklyHours) || input.weeklyHours < 0 || input.weeklyHours > 168)
  )
    throw new Error('Ungültige Wochenstunden.');
  db.transaction(() => {
    let employeeId = input.id;
    let periodId = input.periodId;
    const previous = employeeId
      ? (db.prepare('SELECT * FROM employees WHERE id=?').get(employeeId) as Employee | undefined)
      : undefined;
    if (employeeId && !previous) throw new Error('Person nicht gefunden.');
    const birthDate =
      input.birthDate === undefined ? (previous?.birthDate ?? null) : input.birthDate;
    if (employeeId) {
      db.prepare('UPDATE employees SET name=?,note=?,birthDate=? WHERE id=?').run(
        input.name.trim(),
        input.note ?? null,
        birthDate,
        employeeId,
      );
    } else {
      employeeId = Number(
        nextDeviceId(db, 'employees'),
      );
      db.prepare(
        'INSERT INTO employees(id,name,note,birthDate,fte,weeklyHours) VALUES (?,?,?,?,?,?)',
      ).run(
        employeeId,
        input.name.trim(),
        input.note ?? null,
        birthDate,
        input.fte,
        input.weeklyHours ?? null,
      );
    }
    const existingPeriod = periodId ? loadPeriod(employeeId, periodId) : undefined;
    const bounds: PeriodBoundsInput = {
      startDate: input.startDate,
      endDate: input.endDate || null,
    };
    // A value-only correction leaves the dates alone; unrelated legacy overlaps must not block it.
    const periodDatesUnchanged = Boolean(
      existingPeriod &&
        existingPeriod.startDate === bounds.startDate &&
        (existingPeriod.endDate ?? null) === bounds.endDate,
    );
    if (!periodDatesUnchanged && findPeriodConflict(employeeId, periodId, bounds.startDate, bounds.endDate))
      throw new Error(employmentMessages.overlap);
    if (periodId) {
      const before = db
        .prepare('SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE id=?')
        .get(periodId) as EmploymentPeriod & { id: number; employeeId: number };
      // Same rule as the recorded departure: narrowing must not orphan terms.
      if (!periodDatesUnchanged) assertNoStrandedTerms(periodId, bounds);
      db.prepare(
        'UPDATE employment_periods SET startDate=?,endDate=?,qualification=? WHERE id=?',
      ).run(input.startDate, input.endDate || null, input.qualification, periodId);
      if (input.periodNote !== undefined)
        db.prepare('UPDATE employment_periods SET note=? WHERE id=?').run(
          input.periodNote,
          periodId,
        );
      recordPeriodDateCorrection(before, bounds);
    } else {
      periodId = Number(
        nextDeviceId(db, 'employment_periods'),
      );
      db.prepare(
        'INSERT INTO employment_periods(id,employeeId,startDate,endDate,qualification,note) VALUES (?,?,?,?,?,?)',
      ).run(
        periodId,
        employeeId,
        input.startDate,
        input.endDate || null,
        input.qualification,
        input.periodNote ?? null,
      );
    }
    const existing = db
      .prepare(
        'SELECT id,fte,weeklyHours,verified,effectiveFrom,sourceRef FROM employment_terms WHERE periodId=? ORDER BY effectiveFrom DESC LIMIT 1',
      )
    .get(periodId) as
      | {
          id: number;
          fte: number;
          weeklyHours: number | null;
          verified: number;
          effectiveFrom: string;
          sourceRef: string | null;
        }
      | undefined;
    const changed =
      !existing ||
      existing.fte !== input.fte ||
      existing.weeklyHours !== (input.weeklyHours ?? null);
    const confirming =
      input.hoursVerified === true &&
      (existing?.verified !== 1 ||
        (input.hoursEffectiveFrom && input.hoursEffectiveFrom !== existing?.effectiveFrom) ||
        input.sourceRef !== existing?.sourceRef);
    if (input.updateHours !== false && (!existing || changed || confirming)) {
      const effective = input.hoursEffectiveFrom || (existing ? localDate() : input.startDate);
      requireDate(effective, 'Stunden gültig ab');
      if (effective < input.startDate || (input.endDate && effective > input.endDate))
        throw new Error('Stundenänderung muss innerhalb der Beschäftigungsperiode liegen.');
      const sourceRef = input.sourceRef?.trim() || null;
      const effectiveTermId =
        existing?.effectiveFrom === effective
          ? existing.id
          : nextDeviceId(db, 'employment_terms');
      const values = [
        periodId,
        effective,
        input.weeklyHours ?? null,
        input.fte,
        input.hoursVerified === false ? 0 : 1,
        sourceRef,
      ];
      db.prepare(
        'INSERT INTO employment_terms(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) VALUES (?,?,?,?,?,?,?) ON CONFLICT(periodId,effectiveFrom) DO UPDATE SET weeklyHours=excluded.weeklyHours,fte=excluded.fte,verified=excluded.verified,sourceRef=excluded.sourceRef',
      ).run(effectiveTermId, ...values);
      db.prepare(
        'INSERT INTO employment_term_history(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) VALUES (?,?,?,?,?,?,?)',
      ).run(nextDeviceId(db, 'employment_term_history'), ...values);
      if (existing)
        buildEmployeeChangeEvents({
          previous: existing,
          next: { fte: input.fte, weeklyHours: input.weeklyHours },
          eventDate: effective,
        }).forEach((event) => saveEvent({ employeeId, ...event }));
    }
    updateEmployeeCache(employeeId);
  })();
  return getYearDataset(input.year);
};

/**
 * Delete an employee
 */
export const deleteEmployee = (id: number, year: number): YearDataset => {
  const db = getDb();
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  return getYearDataset(year);
};

/**
 * Delete an employment period
 */
export const deletePeriod = (periodId: number, year: number): YearDataset => {
  const db = getDb();
  db.prepare('DELETE FROM employment_periods WHERE id = ?').run(periodId);
  return getYearDataset(year);
};
