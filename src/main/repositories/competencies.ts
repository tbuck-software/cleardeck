import type {
  BulkCompetencyChange,
  CompetencyDefinition,
  EmployeeCompetency,
} from '../../shared/types';

import { requireDate, localDate } from '../../utils/calendarDate';
import { getDb } from '../database/connection';
import { nextDeviceId } from '../syncRecords';

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
  const id = nextDeviceId(db, 'competency_definitions');
  db.prepare(
    `
    INSERT INTO competency_definitions (id, code, name, category, relevance, sortOrder, note)
    VALUES (@id, @code, @name, @category, @relevance, @sortOrder, @note)
  `,
  ).run({
    id,
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
  if (
    db
      .prepare('SELECT 1 FROM employee_competencies WHERE competencyDefinitionId=? LIMIT 1')
      .get(id) ||
    db.prepare('SELECT 1 FROM competency_history WHERE competencyDefinitionId=? LIMIT 1').get(id)
  )
    throw new Error('Zugeordnete Kompetenz mit Historie kann nicht gelöscht werden.');
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
        ec.level, ec.stageScheme,
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
    stageScheme: row.stageScheme,
    stageHistory: db
      .prepare(
        'SELECT stageScheme,changedAt,level,approvedAt,approvedBy,note FROM competency_history WHERE employeeId=? AND competencyDefinitionId=? ORDER BY changedAt DESC,id DESC',
      )
      .all(employeeId, row.competencyDefinitionId) as EmployeeCompetency['stageHistory'],
    approvedAt: row.approvedAt ?? null,
    approvedBy: row.approvedBy ?? null,
    note: row.note ?? null,
    definitionNote: row.definitionNote ?? null,
    sortOrder: row.sortOrder ?? null,
  }));
};

const writeEmployeeCompetency = (input: {
  stageScheme?: 'legacy' | 'practice-v1';
  id?: number;
  employeeId: number;
  competencyDefinitionId: number;
  level?: number | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  note?: string | null;
}): void => {
  const db = getDb();
  const normalizedNote = input.note ?? null;
  const normalizedApprovedAt = input.approvedAt ?? null;
  const normalizedApprovedBy = input.approvedBy ?? null;
  const normalizedLevel = input.level ?? null;

  const old = db
    .prepare('SELECT * FROM employee_competencies WHERE employeeId=? AND competencyDefinitionId=?')
    .get(input.employeeId, input.competencyDefinitionId) as
    | (EmployeeCompetency & { stageScheme: string })
    | undefined;
  const stageScheme = input.stageScheme ?? old?.stageScheme ?? 'practice-v1';
  if (
    !['legacy', 'practice-v1'].includes(stageScheme) ||
    (normalizedLevel != null &&
      (!Number.isInteger(normalizedLevel) ||
        normalizedLevel < 0 ||
        normalizedLevel > (stageScheme === 'legacy' ? 5 : 6)))
  )
    throw new Error('Ungültige Einarbeitungsstufe.');
  if (normalizedApprovedAt) {
    requireDate(normalizedApprovedAt);
    if (normalizedApprovedAt > localDate()) throw new Error('Bestätigung liegt in der Zukunft.');
  }
  if (
    stageScheme === 'practice-v1' &&
    normalizedLevel === 6 &&
    (!normalizedApprovedAt || !normalizedApprovedBy)
  )
    throw new Error('Abschluss braucht Bestätigungsdatum und verantwortliche Person.');
  db.transaction(() => {
    const snapshot = db.prepare(
      'INSERT INTO competency_history (id,employeeId,competencyDefinitionId,level,approvedAt,approvedBy,note,stageScheme) VALUES (?,?,?,?,?,?,?,?)',
    );
    if (
      old &&
      !db
        .prepare('SELECT 1 FROM competency_history WHERE employeeId=? AND competencyDefinitionId=?')
        .get(input.employeeId, input.competencyDefinitionId)
      )
      snapshot.run(
        nextDeviceId(db, 'competency_history'),
        input.employeeId,
        input.competencyDefinitionId,
        old.level ?? null,
        old.approvedAt ?? null,
        old.approvedBy ?? null,
        old.note ?? null,
        old.stageScheme,
      );
    const employeeCompetencyId = old?.id ?? nextDeviceId(db, 'employee_competencies');
    db.prepare(
      `INSERT INTO employee_competencies (id,employeeId,competencyDefinitionId,level,approvedAt,approvedBy,note,stageScheme)
      VALUES (@id,@employeeId,@competencyDefinitionId,@level,@approvedAt,@approvedBy,@note,@stageScheme)
      ON CONFLICT(employeeId,competencyDefinitionId) DO UPDATE SET level=excluded.level,approvedAt=excluded.approvedAt,approvedBy=excluded.approvedBy,note=excluded.note,stageScheme=excluded.stageScheme`,
    ).run({
      id: employeeCompetencyId,
      employeeId: input.employeeId,
      competencyDefinitionId: input.competencyDefinitionId,
      level: normalizedLevel,
      approvedAt: normalizedApprovedAt,
      approvedBy: normalizedApprovedBy,
      note: normalizedNote,
      stageScheme,
    });
    snapshot.run(
      nextDeviceId(db, 'competency_history'),
      input.employeeId,
      input.competencyDefinitionId,
      normalizedLevel,
      normalizedApprovedAt,
      normalizedApprovedBy,
      normalizedNote,
      stageScheme,
    );
  })();
};

export const saveEmployeeCompetency = (
  input: Parameters<typeof writeEmployeeCompetency>[0],
): EmployeeCompetency[] => {
  writeEmployeeCompetency({
    ...input,
    note: input.note?.trim() || null,
    approvedBy: input.approvedBy?.trim() || null,
  });
  return listEmployeeCompetencies(input.employeeId);
};

export const bulkChangeCompetencies = (input: BulkCompetencyChange): EmployeeCompetency[] => {
  const db = getDb();
  if (!Number.isInteger(input.employeeId) || !Array.isArray(input.changes) || !input.changes.length)
    throw new Error('Bitte Kompetenzen auswählen.');
  const ids = new Set(input.changes.map((change) => change.competencyDefinitionId));
  if (ids.size !== input.changes.length) throw new Error('Kompetenzen wurden mehrfach ausgewählt.');
  db.transaction(() => {
    const assigned = listEmployeeCompetencies(input.employeeId);
    for (const change of input.changes) {
      if (!Number.isInteger(change.competencyDefinitionId) || !Number.isInteger(change.level))
        throw new Error('Ungültige Kompetenz oder Stufe.');
      const old = assigned.find(
        (entry) => entry.competencyDefinitionId === change.competencyDefinitionId,
      );
      if (!old)
        throw new Error('Eine ausgewählte Kompetenz ist dieser Person nicht mehr zugeordnet.');
      if (old.stageScheme !== change.stageScheme)
        throw new Error(
          `${old.competencyName}: Das Stufenmodell hat sich geändert. Bitte die Auswahl neu öffnen.`,
        );
      const completion = change.stageScheme === 'practice-v1' && change.level === 6;
      if (completion && (!input.completion?.approvedAt || !input.completion.approvedBy.trim()))
        throw new Error('Abschluss braucht Bestätigungsdatum und verantwortliche Person.');
      const approvedAt = completion ? input.completion!.approvedAt : old.approvedAt;
      const approvedBy = completion ? input.completion!.approvedBy.trim() : old.approvedBy;
      if (
        old.level === change.level &&
        old.approvedAt === approvedAt &&
        old.approvedBy === approvedBy
      )
        continue;
      try {
        writeEmployeeCompetency({
          ...old,
          ...change,
          employeeId: input.employeeId,
          approvedAt,
          approvedBy,
        });
      } catch (error) {
        throw new Error(
          `${old.competencyName}: ${error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'}`,
        );
      }
    }
  })();
  return listEmployeeCompetencies(input.employeeId);
};

export const deleteEmployeeCompetency = (
  employeeId: number,
  competencyDefinitionId: number,
): EmployeeCompetency[] => {
  const db = getDb();
  const existing = db
    .prepare(
      'SELECT level,approvedAt FROM employee_competencies WHERE employeeId=? AND competencyDefinitionId=?',
    )
    .get(employeeId, competencyDefinitionId) as
    | { level: number | null; approvedAt: string | null }
    | undefined;
  if (existing?.approvedAt || existing?.level)
    throw new Error(
      'Begonnene Einarbeitung bleibt als Historie erhalten. Den Stand bei Bedarf mit Begründung korrigieren.',
    );
  db.prepare(
    'DELETE FROM employee_competencies WHERE employeeId = ? AND competencyDefinitionId = ?',
  ).run(employeeId, competencyDefinitionId);
  return listEmployeeCompetencies(employeeId);
};
