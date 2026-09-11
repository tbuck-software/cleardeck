import { requireDate } from '../utils/calendarDate';
import { formatDateDE } from '../utils/dateFormat';
import type { ReconcilePeriodsPreview, RepairRecordSummary } from '../shared/types';
import { getDb } from './database/connection';
import {
  allRows,
  assertFresh,
  getPeriod,
  overlaps,
  recordRepairEvent,
  repairToken,
  type Db,
  type PeriodRow,
} from './employmentRepairShared';

type TermRow = {
  id: number;
  periodId: number;
  effectiveFrom: string;
  weeklyHours: number | null;
  fte: number;
  verified: number;
  sourceRef: string | null;
};

const periodRecords = (db: Db, periodId: number): RepairRecordSummary[] => {
  const terms = allRows<{ id: number }>(db, 'SELECT id FROM employment_terms WHERE periodId=?', periodId);
  const history = allRows<{ id: number }>(db, 'SELECT id FROM employment_term_history WHERE periodId=?', periodId);
  return [
    { table: 'employment_terms', ids: terms.map((row) => row.id), count: terms.length },
    { table: 'employment_term_history', ids: history.map((row) => row.id), count: history.length },
  ].filter((record) => record.count > 0);
};

const sameTerm = (left: TermRow, right: TermRow): boolean =>
  left.weeklyHours === right.weeklyHours &&
  left.fte === right.fte &&
  left.verified === right.verified &&
  (left.sourceRef ?? null) === (right.sourceRef ?? null);

const validate = (
  db: Db,
  input: {
    periodIds: [number, number];
    retainedPeriodId: number;
    startDate: string;
    endDate: string | null;
  },
) => {
  if (input.periodIds[0] === input.periodIds[1]) throw new Error('Bitte zwei verschiedene Abschnitte auswählen.');
  if (!input.periodIds.includes(input.retainedPeriodId)) throw new Error('Der beibehaltene Abschnitt gehört nicht zur Auswahl.');
  const removedPeriodId = input.periodIds.find((id) => id !== input.retainedPeriodId)!;
  const retained = getPeriod(input.retainedPeriodId);
  const removed = getPeriod(removedPeriodId);
  const conflicts: string[] = [];
  requireDate(input.startDate, 'Beginn');
  if (input.endDate) requireDate(input.endDate, 'Ende');
  if (input.endDate && input.endDate < input.startDate) conflicts.push('Das Ende liegt vor dem Beginn.');
  if (retained.employeeId !== removed.employeeId) conflicts.push('Abschnitte gehören zu verschiedenen Personen.');
  if (retained.qualification !== removed.qualification) conflicts.push('Die Qualifikationen unterscheiden sich. Bitte die richtige Zielperiode auswählen.');
  if (retained.employeeId === removed.employeeId) {
    const neighbors = allRows<PeriodRow>(db, 'SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE employeeId=? AND id NOT IN (?,?)', retained.employeeId, retained.id, removed.id);
    neighbors.forEach((neighbor) => {
      if (overlaps({ startDate: input.startDate, endDate: input.endDate }, neighbor)) conflicts.push(`Der korrigierte Zeitraum überschneidet sich mit einem weiteren Abschnitt. Bitte Zeitraum anhand des Belegs prüfen.`);
    });
  }
  const targetTerms = allRows<TermRow>(db, 'SELECT id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms WHERE periodId=?', retained.id);
  const sourceTerms = allRows<TermRow>(db, 'SELECT id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms WHERE periodId=?', removed.id);
  sourceTerms.forEach((sourceTerm) => {
    const targetTerm = targetTerms.find((term) => term.effectiveFrom === sourceTerm.effectiveFrom);
    if (targetTerm && !sameTerm(targetTerm, sourceTerm)) conflicts.push(`Arbeitszeitstände am ${formatDateDE(sourceTerm.effectiveFrom)} unterscheiden sich. Bitte einen Stand auswählen.`);
    if (!targetTerm && (sourceTerm.effectiveFrom < input.startDate || (input.endDate != null && sourceTerm.effectiveFrom > input.endDate))) conflicts.push(`Der Arbeitszeitstand vom ${formatDateDE(sourceTerm.effectiveFrom)} läge außerhalb des korrigierten Zeitraums.`);
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
    token: repairToken(db, 'reconcile-periods', input),
    employee: { id: validation.retained.employeeId, name: validation.retained.employeeName! },
    retained: {
      id: validation.retained.id,
      before: { startDate: validation.retained.startDate, endDate: validation.retained.endDate },
      after: { startDate: input.startDate, endDate: input.endDate },
    },
    removed: { id: validation.removed.id, startDate: validation.removed.startDate, endDate: validation.removed.endDate },
    affectedRecords: [...periodRecords(db, validation.retained.id), ...periodRecords(db, validation.removed.id)],
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
  assertFresh(db, input.previewToken, 'reconcile-periods', operation);
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'reconcile-periods', operation);
    const validation = validate(db, operation);
    if (validation.conflicts.length) throw new Error(validation.conflicts.join(' '));
    const { retained, removed, sourceTerms, targetTerms } = validation;
    recordRepairEvent(
      db,
      retained.employeeId,
      'Abschnittsauflösung – ursprünglicher Abschnitt erhalten',
      'Der ausgewählte doppelte Beschäftigungsabschnitt wurde aufgelöst. Seine ursprünglichen Daten bleiben hier als Nachweis erhalten.',
      {
        kind: 'employment-period-reconciliation',
        retainedPeriod: retained,
        removedPeriod: removed,
        correctedRetainedDates: { startDate: input.startDate, endDate: input.endDate },
      },
    );
    sourceTerms.forEach((sourceTerm) => {
      const targetTerm = targetTerms.find((term) => term.effectiveFrom === sourceTerm.effectiveFrom);
      if (targetTerm) {
        // Both current values are equal. Keep the duplicate as an auditable
        // historical snapshot before removing the duplicate current row.
        db.prepare('INSERT INTO employment_term_history(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) VALUES (?,?,?,?,?,?)').run(retained.id, sourceTerm.effectiveFrom, sourceTerm.weeklyHours, sourceTerm.fte, sourceTerm.verified, sourceTerm.sourceRef);
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
