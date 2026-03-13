import type {
  CompetencyDefinition,
  EmployeeCompetency,
} from '../../shared/types';

import { getDb } from '../database/connection';

const normalizeDefinitionRows = (rows: any[]): CompetencyDefinition[] =>
  rows.map((row) => ({
    id: row.id,
    code: row.code ?? null,
    name: row.name,
    category: row.category ?? 'Allgemein',
    relevance: row.relevance ?? 'Alle',
    note: row.note ?? null,
    sortOrder: row.sortOrder ?? null,
  }));

export const listCompetencyDefinitions = (): CompetencyDefinition[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, code, name, category, relevance, sortOrder, note
      FROM competency_definitions
      ORDER BY sortOrder ASC, id ASC
    `,
    )
    .all() as any[];
  return normalizeDefinitionRows(rows);
};

export const addCompetencyDefinition = (input: {
  code?: string | null;
  name: string;
  category?: string | null;
  relevance?: string | null;
  note?: string | null;
}): CompetencyDefinition[] => {
  const db = getDb();
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error('Kompetenz darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM competency_definitions').get() as {
    mx: number | null;
  };
  const nextSort = (maxSort.mx ?? 0) + 1;
  db.prepare(
    `
    INSERT INTO competency_definitions (code, name, category, relevance, sortOrder, note)
    VALUES (@code, @name, @category, @relevance, @sortOrder, @note)
  `,
  ).run({
    code: input.code?.trim() || null,
    name: trimmed,
    category: input.category?.trim() || 'Allgemein',
    relevance: input.relevance?.trim() || 'Alle',
    sortOrder: nextSort,
    note: input.note ?? null,
  });
  return listCompetencyDefinitions();
};

export const updateCompetencyDefinition = (input: {
  id: number;
  code?: string | null;
  name: string;
  category?: string | null;
  relevance?: string | null;
  note?: string | null;
}): CompetencyDefinition[] => {
  const db = getDb();
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error('Kompetenz darf nicht leer sein.');
  }
  db.prepare(
    `
    UPDATE competency_definitions
    SET code = @code,
        name = @name,
        category = @category,
        relevance = @relevance,
        note = @note
    WHERE id = @id
  `,
  ).run({
    id: input.id,
    code: input.code?.trim() || null,
    name: trimmed,
    category: input.category?.trim() || 'Allgemein',
    relevance: input.relevance?.trim() || 'Alle',
    note: input.note ?? null,
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
        cd.code as competencyCode,
        cd.name as competencyName,
        cd.category,
        cd.relevance,
        cd.note as definitionNote,
        cd.sortOrder,
        ec.level,
        ec.approvedAt,
        ec.approvedBy,
        ec.note
      FROM employee_competencies ec
      INNER JOIN competency_definitions cd
        ON cd.id = ec.competencyDefinitionId
      WHERE ec.employeeId = @employeeId
      ORDER BY cd.sortOrder ASC, cd.id ASC
    `,
    )
    .all({ employeeId }) as any[];

  return rows.map((row) => ({
    id: row.id ?? undefined,
    employeeId: row.employeeId ?? employeeId,
    competencyDefinitionId: row.competencyDefinitionId,
    competencyCode: row.competencyCode ?? null,
    competencyName: row.competencyName,
    category: row.category ?? 'Allgemein',
    relevance: row.relevance ?? 'Alle',
    level: row.level ?? null,
    approvedAt: row.approvedAt ?? null,
    approvedBy: row.approvedBy ?? null,
    note: row.note ?? null,
    definitionNote: row.definitionNote ?? null,
    sortOrder: row.sortOrder ?? null,
  }));
};

export const saveEmployeeCompetency = (input: {
  id?: number;
  employeeId: number;
  competencyDefinitionId: number;
  level?: number | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  note?: string | null;
}): EmployeeCompetency[] => {
  const db = getDb();
  const normalizedNote = input.note?.trim() ? input.note.trim() : null;
  const normalizedApprovedAt = input.approvedAt ?? null;
  const normalizedApprovedBy = input.approvedBy?.trim() ? input.approvedBy.trim() : null;
  const normalizedLevel = input.level ?? null;

  db.prepare(
    `
    INSERT INTO employee_competencies (
      employeeId,
      competencyDefinitionId,
      level,
      approvedAt,
      approvedBy,
      note
    )
    VALUES (
      @employeeId,
      @competencyDefinitionId,
      @level,
      @approvedAt,
      @approvedBy,
      @note
    )
    ON CONFLICT(employeeId, competencyDefinitionId) DO UPDATE SET
      level = excluded.level,
      approvedAt = excluded.approvedAt,
      approvedBy = excluded.approvedBy,
      note = excluded.note
  `,
  ).run({
    employeeId: input.employeeId,
    competencyDefinitionId: input.competencyDefinitionId,
    level: normalizedLevel,
    approvedAt: normalizedApprovedAt,
    approvedBy: normalizedApprovedBy,
    note: normalizedNote,
  });

  return listEmployeeCompetencies(input.employeeId);
};

export const deleteEmployeeCompetency = (
  employeeId: number,
  competencyDefinitionId: number,
): EmployeeCompetency[] => {
  const db = getDb();
  db.prepare(
    'DELETE FROM employee_competencies WHERE employeeId = ? AND competencyDefinitionId = ?',
  ).run(employeeId, competencyDefinitionId);
  return listEmployeeCompetencies(employeeId);
};
