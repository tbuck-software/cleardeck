import type {
  CompetencyDefinition,
  EmployeeCompetency,
  EmployeeCompetencyStatus,
} from '../../shared/types';

import { getDb } from '../database/connection';

const normalizeDefinitionRows = (rows: any[]): CompetencyDefinition[] =>
  rows.map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note ?? null,
    sortOrder: row.sortOrder ?? null,
  }));

export const listCompetencyDefinitions = (): CompetencyDefinition[] => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, sortOrder, note FROM competency_definitions ORDER BY sortOrder ASC, id ASC')
    .all() as any[];
  return normalizeDefinitionRows(rows);
};

export const addCompetencyDefinition = (name: string, note?: string | null): CompetencyDefinition[] => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Kompetenz darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM competency_definitions').get() as {
    mx: number | null;
  };
  const nextSort = (maxSort.mx ?? 0) + 1;
  db.prepare(
    'INSERT INTO competency_definitions (name, sortOrder, note) VALUES (@name, @sortOrder, @note)',
  ).run({ name: trimmed, sortOrder: nextSort, note: note ?? null });
  return listCompetencyDefinitions();
};

export const updateCompetencyDefinition = (
  id: number,
  name: string,
  note?: string | null,
): CompetencyDefinition[] => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Kompetenz darf nicht leer sein.');
  }
  db.prepare('UPDATE competency_definitions SET name = @name, note = @note WHERE id = @id').run({
    id,
    name: trimmed,
    note: note ?? null,
  });
  return listCompetencyDefinitions();
};

export const reorderCompetencyDefinitions = (orderedIds: number[]): CompetencyDefinition[] => {
  const db = getDb();
  const update = db.prepare('UPDATE competency_definitions SET sortOrder = ? WHERE id = ?');
  orderedIds.forEach((id, idx) => update.run(idx, id));
  return listCompetencyDefinitions();
};

export const deleteCompetencyDefinition = (id: number): CompetencyDefinition[] => {
  const db = getDb();
  db.prepare('DELETE FROM competency_definitions WHERE id = ?').run(id);
  return listCompetencyDefinitions();
};

export const listEmployeeCompetencies = (employeeId: number): EmployeeCompetency[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        ec.id,
        ec.employeeId,
        cd.id as competencyDefinitionId,
        cd.name as competencyName,
        cd.note as definitionNote,
        cd.sortOrder,
        COALESCE(ec.status, 'open') as status,
        ec.startedAt,
        ec.completedAt,
        ec.note
      FROM competency_definitions cd
      LEFT JOIN employee_competencies ec
        ON ec.competencyDefinitionId = cd.id
       AND ec.employeeId = @employeeId
      ORDER BY cd.sortOrder ASC, cd.id ASC
    `,
    )
    .all({ employeeId }) as any[];

  return rows.map((row) => ({
    id: row.id ?? undefined,
    employeeId: row.employeeId ?? employeeId,
    competencyDefinitionId: row.competencyDefinitionId,
    competencyName: row.competencyName,
    status: row.status as EmployeeCompetencyStatus,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    note: row.note ?? null,
    definitionNote: row.definitionNote ?? null,
    sortOrder: row.sortOrder ?? null,
  }));
};

export const saveEmployeeCompetency = (input: {
  id?: number;
  employeeId: number;
  competencyDefinitionId: number;
  status: EmployeeCompetencyStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  note?: string | null;
}): EmployeeCompetency[] => {
  const db = getDb();
  const normalizedNote = input.note?.trim() ? input.note.trim() : null;
  const normalizedStartedAt = input.startedAt ?? null;
  const normalizedCompletedAt = input.completedAt ?? null;

  if (
    input.status === 'open' &&
    !normalizedStartedAt &&
    !normalizedCompletedAt &&
    !normalizedNote
  ) {
    db.prepare(
      'DELETE FROM employee_competencies WHERE employeeId = ? AND competencyDefinitionId = ?',
    ).run(input.employeeId, input.competencyDefinitionId);
    return listEmployeeCompetencies(input.employeeId);
  }

  db.prepare(
    `
    INSERT INTO employee_competencies (
      employeeId,
      competencyDefinitionId,
      status,
      startedAt,
      completedAt,
      note
    )
    VALUES (
      @employeeId,
      @competencyDefinitionId,
      @status,
      @startedAt,
      @completedAt,
      @note
    )
    ON CONFLICT(employeeId, competencyDefinitionId) DO UPDATE SET
      status = excluded.status,
      startedAt = excluded.startedAt,
      completedAt = excluded.completedAt,
      note = excluded.note
  `,
  ).run({
    employeeId: input.employeeId,
    competencyDefinitionId: input.competencyDefinitionId,
    status: input.status,
    startedAt: normalizedStartedAt,
    completedAt: normalizedCompletedAt,
    note: normalizedNote,
  });

  return listEmployeeCompetencies(input.employeeId);
};
