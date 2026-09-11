import { requireDate, shiftDays } from '../utils/calendarDate';
import { formatDateDE } from '../utils/dateFormat';
import { getDb } from './database/connection';
import type {
  ConsolidatePreview,
  EmploymentIntegrityOverview,
  IntegrityIssue,
  IntegrityIssueKind,
  PeriodDatePreview,
  RepairRecordSummary,
} from '../shared/types';
import {
  allRows,
  assertFresh,
  getPeriod,
  overlaps,
  recordRepairEvent,
  repairToken,
  type Db,
  type PeriodRow,
  type EmployeeRow,
} from './employmentRepairShared';

const issueCounts = (issues: IntegrityIssue[]): Record<IntegrityIssueKind, number> => ({
  'reversed-period': issues.filter((issue) => issue.kind === 'reversed-period').length,
  'overlapping-periods': issues.filter((issue) => issue.kind === 'overlapping-periods').length,
  'suspicious-period': issues.filter((issue) => issue.kind === 'suspicious-period').length,
  'same-name': issues.filter((issue) => issue.kind === 'same-name').length,
});

const readableDate = (value: string | null): string => (value ? formatDateDE(value) : 'offen');

/** Read-only scan. It deliberately does not infer dates, hours, or identity. */
export const getEmploymentIntegrityOverview = (): EmploymentIntegrityOverview => {
  const db = getDb();
  const employees = allRows<EmployeeRow>(db, 'SELECT id,name,note,birthDate,department,fte,weeklyHours FROM employees ORDER BY name,id');
  const periods = allRows<PeriodRow>(
    db,
    'SELECT p.id,p.employeeId,e.name AS employeeName,p.startDate,p.endDate,p.qualification,p.note FROM employment_periods p JOIN employees e ON e.id=p.employeeId ORDER BY p.employeeId,p.startDate,p.id',
  );
  const issues: IntegrityIssue[] = [];

  periods.forEach((period) => {
    if (period.endDate && period.startDate > period.endDate) {
      issues.push({
        kind: 'reversed-period',
        severity: 'error',
        title: 'Beschäftigungszeitraum hat umgekehrte Daten',
        detail: `${period.employeeName}: Beginn ${formatDateDE(period.startDate)} liegt nach dem Ende ${formatDateDE(period.endDate)}. Bitte beide Daten prüfen.`,
        employeeIds: [period.employeeId],
        periodIds: [period.id],
      });
    }
    if (period.note && /übernommen|migration|migrat|altbestand|prüfen/i.test(period.note)) {
      issues.push({
        kind: 'suspicious-period',
        severity: 'warning',
        title: 'Abschnitt stammt vermutlich aus einer Übernahme',
        detail: `${period.employeeName}: Die Notiz weist auf übernommene oder zu prüfende Altdaten hin. Datum, Qualifikation und Arbeitszeit bitte nur mit gesicherten Angaben ändern.`,
        employeeIds: [period.employeeId],
        periodIds: [period.id],
      });
    }
  });

  const byEmployee = new Map<number, PeriodRow[]>();
  periods.forEach((period) => byEmployee.set(period.employeeId, [...(byEmployee.get(period.employeeId) ?? []), period]));
  byEmployee.forEach((personPeriods) => {
    for (let index = 0; index < personPeriods.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < personPeriods.length; otherIndex += 1) {
        const left = personPeriods[index];
        const right = personPeriods[otherIndex];
        if (!overlaps(left, right)) continue;
        issues.push({
          kind: 'overlapping-periods',
          severity: 'error',
          title: 'Beschäftigungszeiträume überschneiden sich',
          detail: `${left.employeeName}: ${readableDate(left.startDate)}–${readableDate(left.endDate)} und ${readableDate(right.startDate)}–${readableDate(right.endDate)} überschneiden sich. Einen Zeitraum mit Vorschau korrigieren.`,
          employeeIds: [left.employeeId],
          periodIds: [left.id, right.id],
        });
      }
    }
  });

  for (let index = 0; index < employees.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < employees.length; otherIndex += 1) {
      if (employees[index].name.trim().toLocaleLowerCase() !== employees[otherIndex].name.trim().toLocaleLowerCase()) continue;
      issues.push({
        kind: 'same-name',
        severity: 'warning',
        title: 'Mögliche Namensdopplung',
        detail: `${employees[index].name} und ${employees[otherIndex].name}: Gleiche Namen bedeuten nicht dieselbe Person. Ziel und Quelle bitte ausdrücklich auswählen.`,
        employeeIds: [employees[index].id, employees[otherIndex].id],
        periodIds: [],
      });
    }
  }

  return { issues, counts: issueCounts(issues), checkedAt: new Date().toISOString() };
};

const periodRecordSummaries = (db: Db, periodId: number): RepairRecordSummary[] => {
  const terms = allRows<{ id: number }>(db, 'SELECT id FROM employment_terms WHERE periodId=?', periodId);
  const history = allRows<{ id: number }>(db, 'SELECT id FROM employment_term_history WHERE periodId=?', periodId);
  return [
    { table: 'employment_terms', ids: terms.map((row) => row.id), count: terms.length },
    { table: 'employment_term_history', ids: history.map((row) => row.id), count: history.length },
  ].filter((record) => record.count > 0);
};

const validatePeriodDates = (db: Db, periodId: number, startDate: string, endDate: string | null): string[] => {
  requireDate(startDate, 'Beginn');
  if (endDate) requireDate(endDate, 'Ende');
  if (endDate && endDate < startDate) return ['Das Ende liegt vor dem Beginn.'];
  const period = getPeriod(periodId);
  const conflicts = allRows<PeriodRow>(
    db,
    `SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods
     WHERE employeeId=? AND id<>?`,
    period.employeeId,
    periodId,
  ).filter((other) => overlaps({ startDate, endDate }, other));
  const messages = conflicts.map(() => 'Die neuen Daten überschneiden sich mit einem anderen Zeitraum. Bitte zuerst den Nachbarzeitraum korrigieren.');
  const outOfRangeTerms = allRows<{ effectiveFrom: string }>(
    db,
    'SELECT effectiveFrom FROM employment_terms WHERE periodId=? AND (effectiveFrom<? OR (? IS NOT NULL AND effectiveFrom>?))',
    periodId,
    startDate,
    endDate,
    endDate,
  );
  if (outOfRangeTerms.length)
    messages.push(`${outOfRangeTerms.length} Arbeitszeitstand/-stände lägen außerhalb des neuen Zeitraums. Datum und Arbeitszeit bitte getrennt prüfen.`);
  return messages;
};

export const previewPeriodDateCorrection = (input: {
  periodId: number;
  startDate: string;
  endDate: string | null;
}): PeriodDatePreview => {
  const db = getDb();
  const period = getPeriod(input.periodId);
  const conflicts = validatePeriodDates(db, input.periodId, input.startDate, input.endDate);
  return {
    kind: 'period-date',
    token: repairToken(db, 'period-date', input),
    period: {
      id: period.id,
      employeeId: period.employeeId,
      employeeName: period.employeeName!,
      qualification: period.qualification,
      before: { startDate: period.startDate, endDate: period.endDate },
      after: { startDate: input.startDate, endDate: input.endDate },
    },
    affectedRecords: periodRecordSummaries(db, input.periodId),
    conflicts,
  };
};

export const applyPeriodDateCorrection = (input: {
  periodId: number;
  startDate: string;
  endDate: string | null;
  previewToken: string;
}): void => {
  const db = getDb();
  if (!Number.isInteger(input.periodId)) throw new Error('Beschäftigungsperiode nicht gefunden.');
  assertFresh(db, input.previewToken, 'period-date', {
    periodId: input.periodId,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'period-date', {
      periodId: input.periodId,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    const conflicts = validatePeriodDates(db, input.periodId, input.startDate, input.endDate);
    if (conflicts.length) throw new Error(conflicts.join(' '));
    const period = getPeriod(input.periodId);
    recordRepairEvent(
      db,
      period.employeeId,
      'Zeitraum korrigiert – ursprüngliche Daten erhalten',
      'Die Beschäftigungsdaten wurden ausdrücklich korrigiert. Die ursprünglichen Daten bleiben hier als Nachweis erhalten.',
      {
        kind: 'employment-period-date-correction',
        period: {
          id: period.id,
          employeeId: period.employeeId,
          startDate: period.startDate,
          endDate: period.endDate,
          qualification: period.qualification,
          note: period.note,
        },
        correctedDates: { startDate: input.startDate, endDate: input.endDate },
      },
      `${period.startDate} – ${period.endDate ?? 'offen'}`,
      `${input.startDate} – ${input.endDate ?? 'offen'}`,
    );
    db.prepare('UPDATE employment_periods SET startDate=?,endDate=? WHERE id=?').run(
      input.startDate,
      input.endDate,
      input.periodId,
    );
  })();
};

const periodOrder = (left: PeriodRow, right: PeriodRow): [PeriodRow, PeriodRow] =>
  left.startDate <= right.startDate ? [left, right] : [right, left];

const validateConsolidation = (db: Db, firstId: number, secondId: number): {
  first: PeriodRow;
  second: PeriodRow;
  conflicts: string[];
} => {
  if (firstId === secondId) throw new Error('Bitte zwei verschiedene Abschnitte auswählen.');
  const [first, second] = periodOrder(getPeriod(firstId), getPeriod(secondId));
  const conflicts: string[] = [];
  if (first.employeeId !== second.employeeId) conflicts.push('Abschnitte gehören zu verschiedenen Personen.');
  if (first.qualification !== second.qualification) conflicts.push('Die Qualifikationen unterscheiden sich. Eine Zusammenlegung würde historische Angaben verdecken.');
  if (first.endDate && first.startDate > first.endDate) conflicts.push('Ein ausgewählter Zeitraum hat umgekehrte Daten. Bitte zuerst Beginn und Ende prüfen.');
  if (second.endDate && second.startDate > second.endDate) conflicts.push('Ein ausgewählter Zeitraum hat umgekehrte Daten. Bitte zuerst Beginn und Ende prüfen.');
  if (!first.endDate) conflicts.push('Der erste Zeitraum ist offen und damit nicht an den nächsten Zeitraum angrenzend.');
  else if (shiftDays(first.endDate, 1) !== second.startDate) conflicts.push('Die Abschnitte grenzen nicht unmittelbar aneinander.');
  const merged: Pick<PeriodRow, 'startDate' | 'endDate'> = { startDate: first.startDate, endDate: second.endDate };
  if (first.employeeId === second.employeeId) {
    const neighbors = allRows<PeriodRow>(db, 'SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE employeeId=? AND id NOT IN (?,?)', first.employeeId, first.id, second.id);
    neighbors.forEach((neighbor) => {
      if (overlaps(merged, neighbor)) conflicts.push('Der zusammengelegte Zeitraum überschneidet sich mit einem weiteren Zeitraum. Bitte diesen zuerst korrigieren.');
    });
  }
  const sourceTerms = allRows<{ effectiveFrom: string }>(db, 'SELECT effectiveFrom FROM employment_terms WHERE periodId=?', second.id);
  const targetTermDates = new Set(allRows<{ effectiveFrom: string }>(db, 'SELECT effectiveFrom FROM employment_terms WHERE periodId=?', first.id).map((row) => row.effectiveFrom));
  sourceTerms.forEach((term) => {
    if (targetTermDates.has(term.effectiveFrom)) conflicts.push(`Arbeitszeitstände kollidieren am ${formatDateDE(term.effectiveFrom)}. Bitte einen Stand auswählen.`);
  });
  [...sourceTerms, ...allRows<{ effectiveFrom: string }>(db, 'SELECT effectiveFrom FROM employment_terms WHERE periodId=?', first.id)].forEach((term) => {
    if (term.effectiveFrom < merged.startDate || (merged.endDate != null && term.effectiveFrom > merged.endDate))
      conflicts.push(`Arbeitszeitstand vom ${formatDateDE(term.effectiveFrom)} läge außerhalb des zusammengelegten Zeitraums.`);
  });
  return { first, second, conflicts: [...new Set(conflicts)] };
};

export const previewConsolidatePeriods = (input: { periodIds: [number, number] }): ConsolidatePreview => {
  const db = getDb();
  const validation = validateConsolidation(db, input.periodIds[0], input.periodIds[1]);
  const { first, second } = validation;
  return {
    kind: 'consolidate-periods',
    token: repairToken(db, 'consolidate-periods', input),
    employee: { id: first.employeeId, name: first.employeeName! },
    before: [first, second].map((period) => ({ id: period.id, startDate: period.startDate, endDate: period.endDate, qualification: period.qualification })),
    after: { startDate: first.startDate, endDate: second.endDate, qualification: first.qualification },
    affectedRecords: [
      ...periodRecordSummaries(db, first.id),
      ...periodRecordSummaries(db, second.id),
    ],
    conflicts: validation.conflicts,
  };
};

export const applyConsolidatePeriods = (input: {
  periodIds: [number, number];
  previewToken: string;
}): void => {
  const db = getDb();
  assertFresh(db, input.previewToken, 'consolidate-periods', { periodIds: input.periodIds });
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'consolidate-periods', { periodIds: input.periodIds });
    const validation = validateConsolidation(db, input.periodIds[0], input.periodIds[1]);
    if (validation.conflicts.length) throw new Error(validation.conflicts.join(' '));
    const { first, second } = validation;
    db.prepare('UPDATE employment_terms SET periodId=? WHERE periodId=?').run(first.id, second.id);
    db.prepare('UPDATE employment_term_history SET periodId=? WHERE periodId=?').run(first.id, second.id);
    const note = [first.note, second.note && `Zusammengeführt aus einem weiteren Abschnitt: ${second.note}`].filter(Boolean).join('\n');
    recordRepairEvent(
      db,
      first.employeeId,
      'Zusammenlegung – ursprünglicher Abschnitt erhalten',
      'Der zweite Beschäftigungsabschnitt wurde zusammengelegt. Seine ursprünglichen Daten bleiben hier als Nachweis erhalten.',
      {
        kind: 'employment-period-consolidation',
        retainedPeriod: first,
        removedPeriod: second,
      },
    );
    db.prepare('UPDATE employment_periods SET endDate=?,note=? WHERE id=?').run(second.endDate, note || null, first.id);
    db.prepare('DELETE FROM employment_periods WHERE id=?').run(second.id);
  })();
};

export { applyEmployeeMerge, previewEmployeeMerge } from './employmentMergeRepair';
export { applyReconcilePeriods, previewReconcilePeriods } from './employmentPeriodReconcile';
