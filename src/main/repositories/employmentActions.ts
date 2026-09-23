import { getDb } from '../database/connection';
import { requireDate, shiftDays } from '../../utils/calendarDate';
import { continuesAfterPeriod, employmentMessages } from '../../utils/employment';
import type {
  RecordDepartureInput,
  SwitchQualificationInput,
  YearDataset,
} from '../../shared/types';
import { getYearDataset } from './employees';
import { nextDeviceId } from '../syncRecords';
import {
  assertNoStrandedTerms,
  assertReportYear,
  findPeriodConflict,
  loadEmployee,
  loadPeriod,
  updateEmployeeCache,
} from './employmentCore';

type TermRow = {
  id: number;
  periodId: number;
  effectiveFrom: string;
  weeklyHours: number | null;
  fte: number;
  verified: number;
  sourceRef: string | null;
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
    if (findPeriodConflict(input.employeeId, period.id, period.startDate, input.endDate))
      throw new Error(employmentMessages.overlap);
    assertNoStrandedTerms(period.id, { endDate: input.endDate });

    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run(input.endDate, period.id);
    updateEmployeeCache(input.employeeId);
  })();

  return getYearDataset(input.year);
};

/** Split or immediately continue a period, carrying its effective working time forward. */
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
    const continuation = continuesAfterPeriod(period, input.effectiveFrom);
    if (period.endDate && input.effectiveFrom > period.endDate && !continuation)
      throw new Error('Der Qualifikationswechsel muss innerhalb der bisherigen Periode oder am unmittelbaren Folgetag liegen.');
    if (period.qualification === input.qualification.trim())
      throw new Error('Die neue Qualifikation entspricht bereits der bisherigen.');

    const newEndDate = continuation ? null : period.endDate;
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
    if (next && !newEndDate)
      throw new Error(
        'Ein zukünftiger Beschäftigungszeitraum ist vorhanden. Bitte die Zeiträume zuerst prüfen.',
      );
    if (next && period.endDate && next.startDate <= period.endDate)
      throw new Error(
        'Die vorhandenen Beschäftigungszeiträume überschneiden sich. Bitte die zukünftigen Zeiträume zuerst prüfen.',
      );
    if (findPeriodConflict(input.employeeId, period.id, input.effectiveFrom, newEndDate))
      throw new Error(employmentMessages.overlap);

    const terms = db
      .prepare(
        'SELECT id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms WHERE periodId=? ORDER BY effectiveFrom,id',
      )
      .all(period.id) as TermRow[];
    const futureTerms = terms.filter((term) => term.effectiveFrom >= input.effectiveFrom);
    if (futureTerms.some((term) => period.endDate && term.effectiveFrom > period.endDate))
      throw new Error(
        'Ein Arbeitszeitstand liegt nach dem Ende der bisherigen Beschäftigungsperiode. Bitte die Arbeitszeitdaten zuerst prüfen.',
      );

    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run(
      shiftDays(input.effectiveFrom, -1),
      period.id,
    );
    const newPeriodId = nextDeviceId(db, 'employment_periods');
    db.prepare(
      'INSERT INTO employment_periods(id,employeeId,startDate,endDate,qualification,note) VALUES (?,?,?,?,?,?)',
    ).run(
      newPeriodId,
      input.employeeId,
      input.effectiveFrom,
      newEndDate,
      input.qualification.trim(),
      period.note,
    );

    const transitionTerm = futureTerms.find((term) => term.effectiveFrom === input.effectiveFrom);
    const carry = transitionTerm
      ? undefined
      : [...terms].reverse().find((term) => term.effectiveFrom < input.effectiveFrom);
    if (carry) {
      db.prepare(
        `INSERT INTO employment_terms(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
         VALUES (?,?,?,?,?,?,?)`,
      ).run(
        nextDeviceId(db, 'employment_terms'),
        newPeriodId,
        input.effectiveFrom,
        carry.weeklyHours,
        carry.fte,
        carry.verified,
        carry.sourceRef,
      );
      db.prepare(
        `INSERT INTO employment_term_history(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
         VALUES (?,?,?,?,?,?,?)`,
      ).run(
        nextDeviceId(db, 'employment_term_history'),
        newPeriodId,
        input.effectiveFrom,
        carry.weeklyHours,
        carry.fte,
        carry.verified,
        carry.sourceRef,
      );
    }
    for (const term of futureTerms) {
      db.prepare('UPDATE employment_terms SET periodId=? WHERE id=?').run(newPeriodId, term.id);
      db.prepare(
        `INSERT INTO employment_term_history(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
         VALUES (?,?,?,?,?,?,?)`,
      ).run(
        nextDeviceId(db, 'employment_term_history'),
        newPeriodId,
        term.effectiveFrom,
        term.weeklyHours,
        term.fte,
        term.verified,
        term.sourceRef,
      );
    }
    updateEmployeeCache(input.employeeId);
  })();

  return getYearDataset(input.year);
};
