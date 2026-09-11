import { formatDateDE } from '../utils/dateFormat';
import {
  employmentMessages,
  hasReversedDates,
  looksMigrated,
  orderPeriods,
  periodsAdjacent,
  periodsOverlap,
} from '../utils/employment';
import { getDb } from './database/connection';
import type {
  ConsolidatePreview,
  EmploymentIntegrityOverview,
  IntegrityEmployee,
  IntegrityIssue,
  IntegrityPeriod,
} from '../shared/types';
import {
  PERIOD_COLUMNS,
  PERIOD_TABLES,
  allRows,
  assertFresh,
  getPeriod,
  periodRecordSummaries,
  recordRepairEvent,
  repairToken,
  type Db,
  type PeriodRow,
} from './employmentRepairShared';

/** Read-only scan. It deliberately does not infer dates, hours, or identity. */
export const getEmploymentIntegrityOverview = (): EmploymentIntegrityOverview => {
  const db = getDb();
  const employees = allRows<IntegrityEmployee>(
    db,
    'SELECT id,name,birthDate FROM employees ORDER BY name,id',
  );
  const periods = allRows<IntegrityPeriod>(
    db,
    `SELECT p.id,p.employeeId,p.startDate,p.endDate,p.qualification,p.note,t.weeklyHours,t.fte
     FROM employment_periods p
     LEFT JOIN employment_terms t
       ON t.id=(SELECT id FROM employment_terms WHERE periodId=p.id ORDER BY effectiveFrom DESC,id DESC LIMIT 1)
     ORDER BY p.employeeId,p.startDate,p.id`,
  );
  const issues: IntegrityIssue[] = [];

  periods.forEach((period) => {
    if (hasReversedDates(period))
      issues.push({
        kind: 'reversed-period',
        severity: 'error',
        employeeId: period.employeeId,
        relatedEmployeeId: null,
        periodIds: [period.id],
      });
    if (looksMigrated(period.note))
      issues.push({
        kind: 'suspicious-period',
        severity: 'warning',
        employeeId: period.employeeId,
        relatedEmployeeId: null,
        periodIds: [period.id],
      });
  });

  const byEmployee = new Map<number, IntegrityPeriod[]>();
  periods.forEach((period) =>
    byEmployee.set(period.employeeId, [...(byEmployee.get(period.employeeId) ?? []), period]),
  );
  byEmployee.forEach((personPeriods, employeeId) => {
    for (let index = 0; index < personPeriods.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < personPeriods.length; otherIndex += 1) {
        const left = personPeriods[index];
        const right = personPeriods[otherIndex];
        if (!periodsOverlap(left, right)) continue;
        issues.push({
          kind: 'overlapping-periods',
          severity: 'error',
          employeeId,
          relatedEmployeeId: null,
          periodIds: [left.id, right.id],
        });
      }
    }
  });

  // Same name is a warning for both people, never proof of identity.
  for (let index = 0; index < employees.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < employees.length; otherIndex += 1) {
      const left = employees[index];
      const right = employees[otherIndex];
      if (left.name.trim().toLocaleLowerCase() !== right.name.trim().toLocaleLowerCase()) continue;
      issues.push(
        { kind: 'same-name', severity: 'warning', employeeId: left.id, relatedEmployeeId: right.id, periodIds: [] },
        { kind: 'same-name', severity: 'warning', employeeId: right.id, relatedEmployeeId: left.id, periodIds: [] },
      );
    }
  }

  return { issues, employees, periods };
};

const validateConsolidation = (db: Db, firstId: number, secondId: number): {
  first: PeriodRow;
  second: PeriodRow;
  conflicts: string[];
} => {
  if (firstId === secondId) throw new Error(employmentMessages.sameSection);
  const [first, second] = orderPeriods(getPeriod(firstId), getPeriod(secondId));
  const conflicts: string[] = [];
  if (first.employeeId !== second.employeeId) conflicts.push(employmentMessages.differentEmployees);
  if (first.qualification !== second.qualification)
    conflicts.push('Die Qualifikationen unterscheiden sich. Eine Zusammenlegung würde historische Angaben verdecken.');
  if (hasReversedDates(first) || hasReversedDates(second)) conflicts.push(employmentMessages.reversedPeriod);
  if (!periodsAdjacent(first, second)) conflicts.push(employmentMessages.notAdjacent);
  const merged = { startDate: first.startDate, endDate: second.endDate };
  if (first.employeeId === second.employeeId) {
    const neighbors = allRows<PeriodRow>(
      db,
      `SELECT ${PERIOD_COLUMNS} FROM employment_periods WHERE employeeId=? AND id NOT IN (?,?)`,
      first.employeeId,
      first.id,
      second.id,
    );
    if (neighbors.some((neighbor) => periodsOverlap(merged, neighbor)))
      conflicts.push(employmentMessages.overlap);
  }
  const sourceTerms = allRows<{ effectiveFrom: string }>(db, 'SELECT effectiveFrom FROM employment_terms WHERE periodId=?', second.id);
  const targetTerms = allRows<{ effectiveFrom: string }>(db, 'SELECT effectiveFrom FROM employment_terms WHERE periodId=?', first.id);
  const targetTermDates = new Set(targetTerms.map((row) => row.effectiveFrom));
  sourceTerms.forEach((term) => {
    if (targetTermDates.has(term.effectiveFrom))
      conflicts.push(`Arbeitszeitstände kollidieren am ${formatDateDE(term.effectiveFrom)}. Bitte einen Stand auswählen.`);
  });
  [...sourceTerms, ...targetTerms].forEach((term) => {
    if (term.effectiveFrom < merged.startDate || (merged.endDate != null && term.effectiveFrom > merged.endDate))
      conflicts.push(`Arbeitszeitstand vom ${formatDateDE(term.effectiveFrom)} läge außerhalb des zusammengelegten Zeitraums.`);
  });
  return { first, second, conflicts: [...new Set(conflicts)] };
};

export const previewConsolidatePeriods = (input: { periodIds: [number, number] }): ConsolidatePreview => {
  const db = getDb();
  const { first, second, conflicts } = validateConsolidation(db, input.periodIds[0], input.periodIds[1]);
  return {
    kind: 'consolidate-periods',
    token: repairToken(db, 'consolidate-periods', input, PERIOD_TABLES),
    employee: { id: first.employeeId, name: first.employeeName! },
    before: [first, second].map((period) => ({ id: period.id, startDate: period.startDate, endDate: period.endDate, qualification: period.qualification })),
    after: { startDate: first.startDate, endDate: second.endDate, qualification: first.qualification },
    affectedRecords: [...periodRecordSummaries(db, first.id), ...periodRecordSummaries(db, second.id)],
    conflicts,
  };
};

export const applyConsolidatePeriods = (input: {
  periodIds: [number, number];
  previewToken: string;
}): void => {
  const db = getDb();
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'consolidate-periods', { periodIds: input.periodIds }, PERIOD_TABLES);
    const { first, second, conflicts } = validateConsolidation(db, input.periodIds[0], input.periodIds[1]);
    if (conflicts.length) throw new Error(conflicts.join(' '));
    db.prepare('UPDATE employment_terms SET periodId=? WHERE periodId=?').run(first.id, second.id);
    db.prepare('UPDATE employment_term_history SET periodId=? WHERE periodId=?').run(first.id, second.id);
    const note = [first.note, second.note && `Zusammengeführt aus einem weiteren Abschnitt: ${second.note}`].filter(Boolean).join('\n');
    recordRepairEvent(
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
