import type { EmployeeInstruction, InstructionDefinition } from '../../shared/types';
import { getDb } from '../database/connection';

const normalizeDefinitionRows = (rows: any[]): InstructionDefinition[] =>
  rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    legalBasis: row.legalBasis ?? null,
    note: row.note ?? null,
    sortOrder: row.sortOrder ?? null,
  }));

export const listInstructionDefinitions = (): InstructionDefinition[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, topic, legalBasis, note, sortOrder
      FROM instruction_definitions
      ORDER BY sortOrder ASC, id ASC
    `,
    )
    .all() as any[];
  return normalizeDefinitionRows(rows);
};

export const addInstructionDefinition = (input: {
  topic: string;
  legalBasis?: string | null;
  note?: string | null;
}): InstructionDefinition[] => {
  const db = getDb();
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('Einweisung darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM instruction_definitions').get() as {
    mx: number | null;
  };
  db.prepare(
    `
    INSERT INTO instruction_definitions (topic, legalBasis, note, sortOrder)
    VALUES (@topic, @legalBasis, @note, @sortOrder)
  `,
  ).run({
    topic,
    legalBasis: input.legalBasis?.trim() || null,
    note: input.note?.trim() || null,
    sortOrder: (maxSort.mx ?? 0) + 1,
  });
  return listInstructionDefinitions();
};

export const updateInstructionDefinition = (input: {
  id: number;
  topic: string;
  legalBasis?: string | null;
  note?: string | null;
}): InstructionDefinition[] => {
  const db = getDb();
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('Einweisung darf nicht leer sein.');
  }
  db.prepare(
    `
    UPDATE instruction_definitions
    SET topic = @topic,
        legalBasis = @legalBasis,
        note = @note
    WHERE id = @id
  `,
  ).run({
    id: input.id,
    topic,
    legalBasis: input.legalBasis?.trim() || null,
    note: input.note?.trim() || null,
  });
  return listInstructionDefinitions();
};

export const reorderInstructionDefinitions = (orderedIds: number[]): InstructionDefinition[] => {
  const db = getDb();
  const update = db.prepare('UPDATE instruction_definitions SET sortOrder = ? WHERE id = ?');
  orderedIds.forEach((id, idx) => update.run(idx, id));
  return listInstructionDefinitions();
};

export const deleteInstructionDefinition = (id: number): InstructionDefinition[] => {
  const db = getDb();
  db.prepare('DELETE FROM instruction_definitions WHERE id = ?').run(id);
  return listInstructionDefinitions();
};

export const listEmployeeInstructions = (employeeId: number): EmployeeInstruction[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        ei.id,
        ei.employeeId,
        idf.id as instructionDefinitionId,
        idf.topic as instructionName,
        idf.legalBasis,
        idf.sortOrder,
        ei.dueDate,
        ei.completedAt,
        ei.conductedBy,
        ei.note
      FROM employee_instructions ei
      INNER JOIN instruction_definitions idf
        ON idf.id = ei.instructionDefinitionId
      WHERE ei.employeeId = @employeeId
      ORDER BY idf.sortOrder ASC, idf.id ASC
    `,
    )
    .all({ employeeId }) as any[];

  return rows.map((row) => ({
    id: row.id ?? undefined,
    employeeId: row.employeeId ?? employeeId,
    instructionDefinitionId: row.instructionDefinitionId,
    instructionName: row.instructionName,
    legalBasis: row.legalBasis ?? null,
    dueDate: row.dueDate ?? null,
    completedAt: row.completedAt ?? null,
    conductedBy: row.conductedBy ?? null,
    note: row.note ?? null,
    sortOrder: row.sortOrder ?? null,
  }));
};

export const saveEmployeeInstruction = (input: {
  id?: number;
  employeeId: number;
  instructionDefinitionId: number;
  dueDate?: string | null;
  completedAt?: string | null;
  conductedBy?: string | null;
  note?: string | null;
}): EmployeeInstruction[] => {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO employee_instructions (
      employeeId,
      instructionDefinitionId,
      dueDate,
      completedAt,
      conductedBy,
      note
    )
    VALUES (
      @employeeId,
      @instructionDefinitionId,
      @dueDate,
      @completedAt,
      @conductedBy,
      @note
    )
    ON CONFLICT(employeeId, instructionDefinitionId) DO UPDATE SET
      dueDate = excluded.dueDate,
      completedAt = excluded.completedAt,
      conductedBy = excluded.conductedBy,
      note = excluded.note
  `,
  ).run({
    employeeId: input.employeeId,
    instructionDefinitionId: input.instructionDefinitionId,
    dueDate: input.dueDate ?? null,
    completedAt: input.completedAt ?? null,
    conductedBy: input.conductedBy?.trim() || null,
    note: input.note?.trim() || null,
  });
  return listEmployeeInstructions(input.employeeId);
};

export const deleteEmployeeInstruction = (
  employeeId: number,
  instructionDefinitionId: number,
): EmployeeInstruction[] => {
  const db = getDb();
  db.prepare(
    'DELETE FROM employee_instructions WHERE employeeId = ? AND instructionDefinitionId = ?',
  ).run(employeeId, instructionDefinitionId);
  return listEmployeeInstructions(employeeId);
};
