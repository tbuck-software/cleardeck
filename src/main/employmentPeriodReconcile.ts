import { requireDate } from '../utils/calendarDate';
import { formatDateDE } from '../utils/dateFormat';
import { employmentMessages, hasReversedDates, periodsOverlap } from '../utils/employment';
import type { ReconcilePeriodsPreview } from '../shared/types';
import { getDb } from './database/connection';
import {
  PERIOD_COLUMNS,
  PERIOD_TABLES,
  allRows,
  assertFresh,
  getPeriod,
  periodRecordSummaries,
  recordRepairEvent,
  repairToken,
  rowsEqual,
  type Db,
  type PeriodRow,
} from './employmentRepairShared';
import { nextDeviceId } from './syncRecords';

type TermRow = Record<string, unknown> & {
  id: number;
  periodId: number;
  effectiveFrom: string;
  weeklyHours: number | null;
  fte: number;
  verified: number;
  sourceRef: string | null;
};

const sameTerm = (left: TermRow, right: TermRow): boolean =>
  rowsEqual(left, right, ['id', 'periodId', 'createdAt']);

const validate = (
  db: Db,
  input: {
    periodIds: [number, number];
    retainedPeriodId: number;
    startDate: string;
    endDate: string | null;
  },
) => {
  if (input.periodIds[0] === input.periodIds[1]) throw new Error(employmentMessages.sameSection);
  if (!input.periodIds.includes(input.retainedPeriodId)) throw new Error('Der beibehaltene Abschnitt gehört nicht zur Auswahl.');
  const removedPeriodId = input.periodIds.find((id) => id !== input.retainedPeriodId)!;
  const retained = getPeriod(input.retainedPeriodId);
  const removed = getPeriod(removedPeriodId);
  const conflicts: string[] = [];
  requireDate(input.startDate, 'Beginn');
  if (input.endDate) requireDate(input.endDate, 'Ende');
  if (input.endDate && input.endDate < input.startDate) conflicts.push(employmentMessages.reversedInput);
  if (retained.employeeId !== removed.employeeId) conflicts.push(employmentMessages.differentEmployees);
  if (retained.qualification !== removed.qualification) conflicts.push('Die Qualifikationen unterscheiden sich. Bitte die richtige Zielperiode auswählen.');
  const anyReversed = hasReversedDates(retained) || hasReversedDates(removed);
  const sameStart = retained.startDate === removed.startDate;
  if (retained.employeeId === removed.employeeId) {
    const neighbors = allRows<PeriodRow>(
      db,
      `SELECT ${PERIOD_COLUMNS} FROM employment_periods WHERE employeeId=? AND id NOT IN (?,?)`,
      retained.employeeId,
      retained.id,
      removed.id,
    );
    if (neighbors.some((neighbor) => periodsOverlap({ startDate: input.startDate, endDate: input.endDate }, neighbor)))
      conflicts.push(employmentMessages.overlap);
  }
  const targetTerms = allRows<TermRow>(db, 'SELECT * FROM employment_terms WHERE periodId=?', retained.id);
  const sourceTerms = allRows<TermRow>(db, 'SELECT * FROM employment_terms WHERE periodId=?', removed.id);
  const matchingMalformedDuplicate =
    anyReversed &&
    targetTerms.length > 0 &&
    targetTerms.length === sourceTerms.length &&
    targetTerms.every((targetTerm) => sourceTerms.some((sourceTerm) => sourceTerm.effectiveFrom === targetTerm.effectiveFrom && sameTerm(targetTerm, sourceTerm)));
  if (!sameStart && !periodsOverlap(retained, removed) && !matchingMalformedDuplicate)
    conflicts.push('Die ausgewählten Zeiträume sind getrennte gültige Abschnitte. Eine Auflösung würde einen echten Zeitraum entfernen.');
  const outsideCorrectedRange = (term: TermRow): boolean =>
    term.effectiveFrom < input.startDate || (input.endDate != null && term.effectiveFrom > input.endDate);
  targetTerms.forEach((targetTerm) => {
    if (outsideCorrectedRange(targetTerm)) conflicts.push(`Der Arbeitszeitstand vom ${formatDateDE(targetTerm.effectiveFrom)} läge außerhalb des korrigierten Zeitraums.`);
  });
  sourceTerms.forEach((sourceTerm) => {
    const targetTerm = targetTerms.find((term) => term.effectiveFrom === sourceTerm.effectiveFrom);
    if (targetTerm && !sameTerm(targetTerm, sourceTerm)) conflicts.push(`Arbeitszeitstände am ${formatDateDE(sourceTerm.effectiveFrom)} unterscheiden sich. Bitte einen Stand auswählen.`);
    if (!targetTerm && outsideCorrectedRange(sourceTerm)) conflicts.push(`Der Arbeitszeitstand vom ${formatDateDE(sourceTerm.effectiveFrom)} läge außerhalb des korrigierten Zeitraums.`);
  });
  return { retained, removed, sourceTerms, targetTerms, conflicts: [...new Set(conflicts)] };
};

export const previewReconcilePeriods = (input: {
  periodIds: [number, number];
  retainedPeriodId: number;
  startDate: string;
  endDate: string | null;
}): ReconcilePeriodsPreview => {
  const db = getDb();
  const validation = validate(db, input);
  return {
    kind: 'reconcile-periods',
    token: repairToken(db, 'reconcile-periods', input, PERIOD_TABLES),
    employee: { id: validation.retained.employeeId, name: validation.retained.employeeName! },
    retained: {
      id: validation.retained.id,
      before: { startDate: validation.retained.startDate, endDate: validation.retained.endDate },
      after: { startDate: input.startDate, endDate: input.endDate },
    },
    removed: { id: validation.removed.id, startDate: validation.removed.startDate, endDate: validation.removed.endDate },
    affectedRecords: [...periodRecordSummaries(db, validation.retained.id), ...periodRecordSummaries(db, validation.removed.id)],
    conflicts: validation.conflicts,
  };
};

export const applyReconcilePeriods = (input: {
  periodIds: [number, number];
  retainedPeriodId: number;
  startDate: string;
  endDate: string | null;
  previewToken: string;
}): void => {
  const db = getDb();
  const operation = {
    periodIds: input.periodIds,
    retainedPeriodId: input.retainedPeriodId,
    startDate: input.startDate,
    endDate: input.endDate,
  };
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'reconcile-periods', operation, PERIOD_TABLES);
    const validation = validate(db, operation);
    if (validation.conflicts.length) throw new Error(validation.conflicts.join(' '));
    const { retained, removed, sourceTerms, targetTerms } = validation;
    const duplicateCurrentTerms = sourceTerms.flatMap((sourceTerm) => {
      const targetTerm = targetTerms.find((term) => term.effectiveFrom === sourceTerm.effectiveFrom);
      return targetTerm && sameTerm(targetTerm, sourceTerm) ? [{ source: sourceTerm, target: targetTerm }] : [];
    });
    recordRepairEvent(
      retained.employeeId,
      'Abschnittsauflösung – ursprünglicher Abschnitt erhalten',
      'Der ausgewählte doppelte Beschäftigungsabschnitt wurde aufgelöst. Seine ursprünglichen Daten bleiben hier als Nachweis erhalten.',
      {
        kind: 'employment-period-reconciliation',
        retainedPeriod: retained,
        removedPeriod: removed,
        correctedRetainedDates: { startDate: input.startDate, endDate: input.endDate },
        duplicateCurrentTerms,
      },
    );
    sourceTerms.forEach((sourceTerm) => {
      const targetTerm = targetTerms.find((term) => term.effectiveFrom === sourceTerm.effectiveFrom);
      if (targetTerm) {
        // Both current values are equal. Keep the duplicate as an auditable
        // historical snapshot before removing the duplicate current row.
        db.prepare('INSERT INTO employment_term_history(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) VALUES (?,?,?,?,?,?,?)').run(nextDeviceId(db, 'employment_term_history'), retained.id, sourceTerm.effectiveFrom, sourceTerm.weeklyHours, sourceTerm.fte, sourceTerm.verified, sourceTerm.sourceRef);
        db.prepare('DELETE FROM employment_terms WHERE id=?').run(sourceTerm.id);
      } else {
        db.prepare('UPDATE employment_terms SET periodId=? WHERE id=?').run(retained.id, sourceTerm.id);
      }
    });
    db.prepare('UPDATE employment_term_history SET periodId=? WHERE periodId=?').run(retained.id, removed.id);
    const note = [retained.note, 'Ein doppelter Abschnitt wurde zusammengeführt.'].filter(Boolean).join('\n');
    db.prepare('UPDATE employment_periods SET startDate=?,endDate=?,note=? WHERE id=?').run(input.startDate, input.endDate, note || null, retained.id);
    db.prepare('DELETE FROM employment_periods WHERE id=?').run(removed.id);
    if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Die Abschnittsreparatur würde ungültige Datenverknüpfungen erzeugen.');
  })();
};
