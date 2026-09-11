import { getDb } from './database/connection';
import { formatDateDE } from '../utils/dateFormat';
import { employmentMessages, hasReversedDates, periodsOverlap } from '../utils/employment';
import type { EmployeeMergePreview, RepairRecordSummary } from '../shared/types';
import { updateEmployeeCache } from './repositories/employmentCore';
import {
  PERIOD_COLUMNS,
  allRows,
  assertFresh,
  employeeRelations,
  getEmployee,
  linkedRecordSummaries,
  quoteIdentifier,
  recordRepairEvent,
  repairToken,
  rowsEqual,
  type Db,
  type EmployeeRow,
  type PeriodRow,
} from './employmentRepairShared';

type CompetencyRow = Record<string, unknown> & {
  id: number;
  employeeId: number;
  competencyDefinitionId: number;
};

/** A merge rewrites every table that points at an employee, so all of them are fingerprinted. */
const mergeTables = (db: Db): string[] => ['employees', ...employeeRelations(db).map((relation) => relation.table)];

const competencyRows = (db: Db, employeeId: number): CompetencyRow[] =>
  allRows<CompetencyRow>(db, 'SELECT * FROM employee_competencies WHERE employeeId=?', employeeId);

const sameCompetency = (left: CompetencyRow, right: CompetencyRow): boolean =>
  rowsEqual(left, right, ['id', 'employeeId', 'createdAt']);

const competencyLabel = (db: Db, definitionId: number): string => {
  const row = db.prepare('SELECT name FROM competency_definitions WHERE id=?').get(definitionId) as { name?: string } | undefined;
  return row?.name ?? 'dieselbe Qualifikation';
};

const mergeConflicts = (db: Db, target: EmployeeRow, source: EmployeeRow): string[] => {
  const conflicts: string[] = [];
  if (target.birthDate && source.birthDate && target.birthDate !== source.birthDate)
    conflicts.push(`Geburtsdaten unterscheiden sich (${formatDateDE(target.birthDate)} / ${formatDateDE(source.birthDate)}). Bitte vor der Zusammenführung klären.`);
  if (target.department && source.department && target.department !== source.department)
    conflicts.push(`Abteilungen unterscheiden sich (${target.department} / ${source.department}). Bitte vor der Zusammenführung klären.`);

  const allPeriods = [target.id, source.id].flatMap((employeeId) =>
    allRows<PeriodRow>(db, `SELECT ${PERIOD_COLUMNS} FROM employment_periods WHERE employeeId=?`, employeeId),
  );
  allPeriods.forEach((period, index) => {
    if (hasReversedDates(period)) conflicts.push(employmentMessages.reversedPeriod);
    for (let otherIndex = index + 1; otherIndex < allPeriods.length; otherIndex += 1) {
      if (periodsOverlap(period, allPeriods[otherIndex])) conflicts.push(employmentMessages.overlap);
    }
  });

  const targetCompetencies = competencyRows(db, target.id);
  competencyRows(db, source.id).forEach((sourceCompetency) => {
    const targetCompetency = targetCompetencies.find(
      (candidate) => candidate.competencyDefinitionId === sourceCompetency.competencyDefinitionId,
    );
    if (targetCompetency && !sameCompetency(targetCompetency, sourceCompetency)) {
      conflicts.push(`„${competencyLabel(db, sourceCompetency.competencyDefinitionId)}“ ist beiden Personen zugeordnet, aber die aktuellen Angaben unterscheiden sich. Bitte vor der Zusammenführung einen Stand auswählen; die Historie bleibt erhalten.`);
    }
  });
  return [...new Set(conflicts)];
};

export const previewEmployeeMerge = (input: {
  targetEmployeeId: number;
  sourceEmployeeId: number;
}): EmployeeMergePreview => {
  if (input.targetEmployeeId === input.sourceEmployeeId)
    throw new Error('Ziel und Quelle müssen verschiedene Personen sein.');
  const db = getDb();
  const target = getEmployee(input.targetEmployeeId);
  const source = getEmployee(input.sourceEmployeeId);
  return {
    kind: 'employee-merge',
    token: repairToken(db, 'employee-merge', input, mergeTables(db)),
    target: { id: target.id, name: target.name },
    source: { id: source.id, name: source.name },
    linkedRecords: linkedRecordSummaries(db, source.id) as RepairRecordSummary[],
    conflicts: mergeConflicts(db, target, source),
  };
};

export const applyEmployeeMerge = (input: {
  targetEmployeeId: number;
  sourceEmployeeId: number;
  previewToken: string;
}): void => {
  if (input.targetEmployeeId === input.sourceEmployeeId)
    throw new Error('Ziel und Quelle müssen verschiedene Personen sein.');
  const db = getDb();
  const operation = {
    targetEmployeeId: input.targetEmployeeId,
    sourceEmployeeId: input.sourceEmployeeId,
  };
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'employee-merge', operation, mergeTables(db));
    const target = getEmployee(input.targetEmployeeId);
    const source = getEmployee(input.sourceEmployeeId);
    const sourceCompetencies = competencyRows(db, source.id);
    const targetCompetencies = competencyRows(db, target.id);
    const sourceSnapshot = {
      ...(db.prepare('SELECT * FROM employees WHERE id=?').get(source.id) as Record<string, unknown>),
      currentCompetencies: sourceCompetencies,
    };
    const conflicts = mergeConflicts(db, target, source);
    if (conflicts.length) throw new Error(conflicts.join(' '));

    if ((!target.birthDate && source.birthDate) || (!target.department && source.department))
      db.prepare('UPDATE employees SET birthDate=COALESCE(birthDate,?),department=COALESCE(department,?) WHERE id=?').run(source.birthDate, source.department ?? null, target.id);
    if (source.note && source.note !== target.note) {
      const note = [target.note, `Zusammengeführt aus einer weiteren Person: ${source.note}`].filter(Boolean).join('\n');
      db.prepare('UPDATE employees SET note=? WHERE id=?').run(note, target.id);
    }

    // A duplicate current competency may be removed only when every meaningful
    // field matches. Both original rows are retained in the merge audit event.
    const equivalentCompetencies: Array<{ source: CompetencyRow; target: CompetencyRow }> = [];
    sourceCompetencies.forEach((row) => {
      const targetRow = targetCompetencies.find((candidate) => candidate.competencyDefinitionId === row.competencyDefinitionId);
      if (targetRow && sameCompetency(targetRow, row)) {
        equivalentCompetencies.push({ source: row, target: targetRow });
        db.prepare('DELETE FROM employee_competencies WHERE id=?').run(row.id);
      } else {
        db.prepare('UPDATE employee_competencies SET employeeId=? WHERE id=?').run(target.id, row.id);
      }
    });

    // Update every direct employee foreign key discovered from SQLite
    // metadata, including tables added after this feature. Instruction
    // previousInstructionId is a self-link and stays unchanged.
    employeeRelations(db).forEach(({ table, column }) => {
      if (table === 'employee_competencies') return;
      db.prepare(`UPDATE ${quoteIdentifier(table)} SET ${quoteIdentifier(column)}=? WHERE ${quoteIdentifier(column)}=?`).run(target.id, source.id);
    });
    recordRepairEvent(
      target.id,
      'Zusammenführung – Quelldaten erhalten',
      'Die ausgewählte Quellperson wurde zusammengeführt. Ihre ursprünglichen Personendaten bleiben hier als Nachweis erhalten.',
      {
        kind: 'employee-merge-source',
        sourceEmployeeId: source.id,
        targetEmployeeId: target.id,
        sourceEmployee: sourceSnapshot,
        equivalentCompetencies,
      },
      source.name,
      target.name,
    );
    updateEmployeeCache(target.id);
    db.prepare('DELETE FROM employees WHERE id=?').run(source.id);
    if ((db.pragma('foreign_key_check') as unknown[]).length)
      throw new Error('Zusammenführung würde ungültige Datenverknüpfungen erzeugen.');
  })();
};
