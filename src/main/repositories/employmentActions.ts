import { getDb } from '../database/connection';
import { localDate, requireDate, shiftDays } from '../../utils/calendarDate';
import type {
  Employee,
  RecordDepartureInput,
  SwitchQualificationInput,
  YearDataset,
} from '../../shared/types';
import { getYearDataset } from './employees';

type PeriodRow = {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string | null;
  qualification: string;
  note: string | null;
};

type TermRow = {
  id: number;
  periodId: number;
  effectiveFrom: string;
  weeklyHours: number | null;
  fte: number;
  verified: number;
  sourceRef: string | null;
};

const assertReportYear = (year: number): void => {
  if (!Number.isInteger(year) || year < 1900 || year > 2200)
    throw new Error('Ungültiges Berichtsjahr.');
};

const loadEmployee = (employeeId: number): Employee => {
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw new Error('Person nicht gefunden.');
  const employee = getDb().prepare('SELECT * FROM employees WHERE id=?').get(employeeId) as
    | Employee
    | undefined;
  if (!employee) throw new Error('Person nicht gefunden.');
  return employee;
};

const loadPeriod = (employeeId: number, periodId: number): PeriodRow => {
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

const updateEmployeeCache = (employeeId: number): void => {
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

const assertNoPeriodConflict = (
  employeeId: number,
  periodId: number,
  startDate: string,
  endDate: string | null,
): void => {
  const conflict = getDb()
    .prepare(
      `SELECT startDate,endDate FROM employment_periods
       WHERE employeeId=? AND id<>? AND startDate<=? AND COALESCE(endDate,'9999-12-31')>=?
       LIMIT 1`,
    )
    .get(employeeId, periodId, endDate ?? '9999-12-31', startDate) as
    | { startDate: string; endDate: string | null }
    | undefined;
  if (conflict)
    throw new Error(
      `Die Beschäftigungsperiode überschneidet sich mit dem bestehenden Zeitraum ab ${conflict.startDate}. Bitte den vorhandenen oder zukünftigen Zeitraum zuerst prüfen.`,
    );
};

/** Close one employment period without touching its employee or working-time history. */
export const recordDeparture = (input: RecordDepartureInput): YearDataset => {
  const db = getDb();
  assertReportYear(input.year);
  loadEmployee(input.employeeId);
  requireDate(input.endDate, 'Austrittsdatum');

  db.transaction(() => {
    const period = loadPeriod(input.employeeId, input.periodId);
    if (input.endDate < period.startDate)
      throw new Error('Das Austrittsdatum liegt vor dem Beginn der Beschäftigungsperiode.');

    // A recorded departure may move in either direction as long as no later
    // period and no later working-time state would be stranded.
    assertNoPeriodConflict(input.employeeId, period.id, period.startDate, input.endDate);
    const futureTerm = db
      .prepare(
        'SELECT effectiveFrom FROM employment_terms WHERE periodId=? AND effectiveFrom>? ORDER BY effectiveFrom LIMIT 1',
      )
      .get(period.id, input.endDate) as { effectiveFrom: string } | undefined;
    if (futureTerm)
      throw new Error(
        `Der Arbeitszeitstand ab ${futureTerm.effectiveFrom} liegt nach dem neuen Austritt. Kürze den Zeitraum erst nach einer Arbeitszeitkorrektur, damit keine Arbeitszeitdaten verloren gehen.`,
      );

    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run(input.endDate, period.id);
    updateEmployeeCache(input.employeeId);
  })();

  return getYearDataset(input.year);
};

/** Split a period at a qualification transition and carry its effective term forward. */
export const switchQualification = (input: SwitchQualificationInput): YearDataset => {
  const db = getDb();
  assertReportYear(input.year);
  loadEmployee(input.employeeId);
  if (!input.qualification?.trim()) throw new Error('Eine neue Qualifikation ist erforderlich.');
  requireDate(input.effectiveFrom, 'Wechseldatum');

  db.transaction(() => {
    const period = loadPeriod(input.employeeId, input.periodId);
    if (input.effectiveFrom <= period.startDate)
      throw new Error('Der Qualifikationswechsel muss nach dem Beginn der bisherigen Periode liegen.');
    if (period.endDate && input.effectiveFrom > period.endDate)
      throw new Error('Das Wechseldatum liegt nach dem Ende der bisherigen Beschäftigungsperiode.');
    if (period.qualification === input.qualification.trim())
      throw new Error('Die neue Qualifikation entspricht bereits der bisherigen.');

    const next = db
      .prepare(
        `SELECT id,startDate,endDate FROM employment_periods
         WHERE employeeId=? AND id<>? AND startDate>?
         ORDER BY startDate,id LIMIT 1`,
      )
      .get(input.employeeId, period.id, period.startDate) as
      | { id: number; startDate: string; endDate: string | null }
      | undefined;
    if (next && next.startDate <= input.effectiveFrom)
      throw new Error(
        `Am ${next.startDate} gibt es bereits einen zukünftigen Beschäftigungszeitraum. Bitte prüfe diesen Zeitraum, bevor du die Qualifikation wechselst.`,
      );
    if (next && !period.endDate)
      throw new Error(
        'Ein zukünftiger Beschäftigungszeitraum ist vorhanden, obwohl die bisherige Periode offen ist. Bitte die Zeiträume zuerst prüfen.',
      );
    if (next && period.endDate && next.startDate <= period.endDate)
      throw new Error(
        'Die vorhandenen Beschäftigungszeiträume überschneiden sich. Bitte die zukünftigen Zeiträume zuerst prüfen.',
      );
    const newEndDate = period.endDate;
    assertNoPeriodConflict(input.employeeId, period.id, period.startDate, input.effectiveFrom);
    if (newEndDate && newEndDate < input.effectiveFrom)
      throw new Error('Das Wechseldatum überschneidet sich mit einem bestehenden Zeitraum.');

    const terms = db
      .prepare(
        'SELECT id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms WHERE periodId=? ORDER BY effectiveFrom,id',
      )
      .all(period.id) as TermRow[];
    const futureTerms = terms.filter((term) => term.effectiveFrom >= input.effectiveFrom);
    if (futureTerms.some((term) => newEndDate && term.effectiveFrom > newEndDate))
      throw new Error(
        'Ein Arbeitszeitstand liegt hinter dem möglichen Ende der neuen Periode. Bitte prüfe die zukünftige Beschäftigungsperiode zuerst.',
      );

    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run(
      shiftDays(input.effectiveFrom, -1),
      period.id,
    );
    const newPeriodId = Number(
      db
        .prepare(
          'INSERT INTO employment_periods(employeeId,startDate,endDate,qualification,note) VALUES (?,?,?,?,?)',
        )
        .run(
          input.employeeId,
          input.effectiveFrom,
          newEndDate,
          input.qualification.trim(),
          input.note === undefined ? period.note : input.note?.trim() || null,
        ).lastInsertRowid,
    );

    const transitionTerm = futureTerms.find((term) => term.effectiveFrom === input.effectiveFrom);
    const carry = transitionTerm
      ? undefined
      : [...terms].reverse().find((term) => term.effectiveFrom < input.effectiveFrom);
    if (carry) {
      db.prepare(
        `INSERT INTO employment_terms(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
         VALUES (?,?,?,?,?,?)`,
      ).run(
        newPeriodId,
        input.effectiveFrom,
        carry.weeklyHours,
        carry.fte,
        carry.verified,
        carry.sourceRef,
      );
      db.prepare(
        `INSERT INTO employment_term_history(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
         VALUES (?,?,?,?,?,?)`,
      ).run(
        newPeriodId,
        input.effectiveFrom,
        carry.weeklyHours,
        carry.fte,
        carry.verified,
        carry.sourceRef,
      );
    }
    if (futureTerms.length > 0) {
      for (const term of futureTerms) {
        db.prepare('UPDATE employment_terms SET periodId=? WHERE id=?').run(newPeriodId, term.id);
        db.prepare(
          `INSERT INTO employment_term_history(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
           VALUES (?,?,?,?,?,?)`,
        ).run(
          newPeriodId,
          term.effectiveFrom,
          term.weeklyHours,
          term.fte,
          term.verified,
          term.sourceRef,
        );
      }
    }
    updateEmployeeCache(input.employeeId);
  })();

  return getYearDataset(input.year);
};
