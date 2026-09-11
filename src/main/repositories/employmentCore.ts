/**
 * Shared guards and lookups for employment periods and their working-time terms.
 *
 * Both the free-form employee editor and the recorded employment actions write
 * to the same two tables, so they have to agree on what a period may become.
 */

import { getDb } from '../database/connection';
import { localDate } from '../../utils/calendarDate';
import { periodsOverlap } from '../../utils/employment';
import type { Employee } from '../../shared/types';

export type PeriodRow = {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string | null;
  qualification: string;
  note: string | null;
};

export const assertReportYear = (year: number): void => {
  if (!Number.isInteger(year) || year < 1900 || year > 2200)
    throw new Error('Ungültiges Berichtsjahr.');
};

export const loadEmployee = (employeeId: number): Employee => {
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw new Error('Person nicht gefunden.');
  const employee = getDb().prepare('SELECT * FROM employees WHERE id=?').get(employeeId) as
    | Employee
    | undefined;
  if (!employee) throw new Error('Person nicht gefunden.');
  return employee;
};

export const loadPeriod = (employeeId: number, periodId: number): PeriodRow => {
  if (!Number.isInteger(periodId) || periodId <= 0)
    throw new Error('Beschäftigungsperiode nicht gefunden.');
  const period = getDb()
    .prepare(
      'SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE id=? AND employeeId=?',
    )
    .get(periodId, employeeId) as PeriodRow | undefined;
  if (!period) throw new Error('Beschäftigungsperiode nicht gefunden.');
  return period;
};

/** Retain the legacy employee columns as a current-value cache; reports use terms. */
export const updateEmployeeCache = (employeeId: number): void => {
  const db = getDb();
  const current = db
    .prepare(
      `SELECT t.fte,t.weeklyHours
       FROM employment_terms t
       JOIN employment_periods p ON p.id=t.periodId
       WHERE p.employeeId=? AND t.effectiveFrom<=?
       ORDER BY t.effectiveFrom DESC,t.id DESC LIMIT 1`,
    )
    .get(employeeId, localDate()) as { fte: number; weeklyHours: number | null } | undefined;
  if (current)
    db.prepare('UPDATE employees SET fte=?,weeklyHours=? WHERE id=?').run(
      current.fte,
      current.weeklyHours,
      employeeId,
    );
};

/** The other period this one would overlap, if any. Callers word their own error. */
export const findPeriodConflict = (
  employeeId: number,
  periodId: number | undefined,
  startDate: string,
  endDate: string | null,
): { id: number; startDate: string; endDate: string | null } | undefined =>
  (
    getDb()
      .prepare(
        `SELECT id,startDate,endDate FROM employment_periods
         WHERE employeeId=? AND id<>? ORDER BY startDate,id`,
      )
      .all(employeeId, periodId ?? -1) as { id: number; startDate: string; endDate: string | null }[]
  ).find((other) => periodsOverlap({ startDate, endDate }, other));

/** Narrowing a period at either end must not leave a working-time state outside of it. */
export const assertNoStrandedTerms = (
  periodId: number,
  bounds: { startDate?: string; endDate?: string | null },
): void => {
  const db = getDb();
  if (bounds.endDate) {
    const late = db
      .prepare(
        'SELECT effectiveFrom FROM employment_terms WHERE periodId=? AND effectiveFrom>? ORDER BY effectiveFrom LIMIT 1',
      )
      .get(periodId, bounds.endDate) as { effectiveFrom: string } | undefined;
    if (late)
      throw new Error(
        `Der Arbeitszeitstand ab ${late.effectiveFrom} liegt nach dem neuen Austritt. Kürze den Zeitraum erst nach einer Arbeitszeitkorrektur, damit keine Arbeitszeitdaten verloren gehen.`,
      );
  }
  if (bounds.startDate) {
    const early = db
      .prepare(
        'SELECT effectiveFrom FROM employment_terms WHERE periodId=? AND effectiveFrom<? ORDER BY effectiveFrom DESC LIMIT 1',
      )
      .get(periodId, bounds.startDate) as { effectiveFrom: string } | undefined;
    if (early)
      throw new Error(
        `Der Arbeitszeitstand ab ${early.effectiveFrom} läge außerhalb des neuen Zeitraums. Datum und Arbeitszeit bitte getrennt prüfen.`,
      );
  }
};
