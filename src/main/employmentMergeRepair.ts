import { getDb } from './database/connection';
import { formatDateDE } from '../utils/dateFormat';
import type { EmployeeMergePreview, RepairRecordSummary } from '../shared/types';
import {
  allRows,
  assertFresh,
  employeeRelations,
  getEmployee,
  linkedRecordSummaries,
  overlaps,
  quoteIdentifier,
  recordRepairEvent,
  repairToken,
  type Db,
  type EmployeeRow,
  type PeriodRow,
} from './employmentRepairShared';

type CompetencyRow = Record<string, unknown> & {
  id: number;
  employeeId: number;
  competencyDefinitionId: number;
};

const competencyRows = (db: Db, employeeId: number): CompetencyRow[] =>
  allRows<CompetencyRow>(db, 'SELECT * FROM employee_competencies WHERE employeeId=?', employeeId);

const comparableCompetencyKeys = (row: CompetencyRow): string[] =>
  Object.keys(row).filter((key) => !['id', 'employeeId', 'createdAt'].includes(key)).sort();

const sameCompetency = (left: CompetencyRow, right: CompetencyRow): boolean => {
  const keys = [...new Set([...comparableCompetencyKeys(left), ...comparableCompetencyKeys(right)])];
  return keys.every((key) => (left[key] ?? null) === (right[key] ?? null));
};

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

  const targetPeriods = allRows<PeriodRow>(db, 'SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE employeeId=?', target.id);
  const sourcePeriods = allRows<PeriodRow>(db, 'SELECT id,employeeId,startDate,endDate,qualification,note FROM employment_periods WHERE employeeId=?', source.id);
  const allPeriods = [...targetPeriods, ...sourcePeriods];
  allPeriods.forEach((period, index) => {
    if (period.endDate && period.startDate > period.endDate)
      conflicts.push('Ein Beschäftigungszeitraum hat umgekehrte Daten. Bitte zuerst Beginn und Ende prüfen.');
    for (let otherIndex = index + 1; otherIndex < allPeriods.length; otherIndex += 1) {
      const other = allPeriods[otherIndex];
      if (overlaps(period, other))
        conflicts.push('Beschäftigungszeiträume überschneiden sich. Bitte die Zeiträume zuerst korrigieren.');
    }
  });

  const targetCompetencies = competencyRows(db, target.id);
  const sourceCompetencies = competencyRows(db, source.id);
  sourceCompetencies.forEach((sourceCompetency) => {
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
  const sourceSnapshot = {
    ...(db.prepare('SELECT * FROM employees WHERE id=?').get(source.id) as Record<string, unknown>),
    currentCompetencies: competencyRows(db, source.id),
  };
  return {
    kind: 'employee-merge',
    token: repairToken(db, 'employee-merge', input),
    target: { id: target.id, name: target.name },
    source: { id: source.id, name: source.name },
    sourceSnapshot,
    periods: {
      target: Number((db.prepare('SELECT COUNT(*) AS count FROM employment_periods WHERE employeeId=?').get(target.id) as { count?: number } | undefined)?.count ?? 0),
      source: Number((db.prepare('SELECT COUNT(*) AS count FROM employment_periods WHERE employeeId=?').get(source.id) as { count?: number } | undefined)?.count ?? 0),
    },
    linkedRecords: linkedRecordSummaries(db, source.id) as RepairRecordSummary[],
    conflicts: mergeConflicts(db, target, source),
  };
};

const refreshEmployeeCache = (db: Db, employeeId: number): void => {
  const current = db.prepare(`SELECT t.fte,t.weeklyHours FROM employment_terms t JOIN employment_periods p ON p.id=t.periodId
    WHERE p.employeeId=? AND t.effectiveFrom<=date('now','localtime') ORDER BY t.effectiveFrom DESC,t.id DESC LIMIT 1`).get(employeeId) as { fte: number; weeklyHours: number | null } | undefined;
  if (current) db.prepare('UPDATE employees SET fte=?,weeklyHours=? WHERE id=?').run(current.fte, current.weeklyHours, employeeId);
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
  assertFresh(db, input.previewToken, 'employee-merge', operation);
  db.transaction(() => {
    assertFresh(db, input.previewToken, 'employee-merge', operation);
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
      db,
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
    refreshEmployeeCache(db, target.id);
    db.prepare('DELETE FROM employees WHERE id=?').run(source.id);
    if ((db.pragma('foreign_key_check') as unknown[]).length)
      throw new Error('Zusammenführung würde ungültige Datenverknüpfungen erzeugen.');
  })();
};
