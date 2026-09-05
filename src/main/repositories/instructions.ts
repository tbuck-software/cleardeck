import type { EmployeeInstruction, InstructionDefinition, IntervalSource } from '../../shared/types';
import { getDb } from '../database/connection';
import { nextDueDate } from '../../utils/instructionSchedule';

const normalizeDefinitionRows = (rows: any[]): InstructionDefinition[] =>
  rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    legalBasis: row.legalBasis ?? null,
    note: row.note ?? null,
    sortOrder: row.sortOrder ?? null,
    intervalMonths: row.intervalMonths ?? null,
    intervalSource: (row.intervalSource ?? null) as IntervalSource | null,
  }));

export const listInstructionDefinitions = (): InstructionDefinition[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, topic, legalBasis, note, sortOrder, intervalMonths, intervalSource
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
  intervalMonths?: number | null;
  intervalSource?: IntervalSource | null;
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
    INSERT INTO instruction_definitions (topic, legalBasis, note, sortOrder, intervalMonths, intervalSource)
    VALUES (@topic, @legalBasis, @note, @sortOrder, @intervalMonths, @intervalSource)
  `,
  ).run({
    topic,
    legalBasis: input.legalBasis?.trim() || null,
    note: input.note?.trim() || null,
    sortOrder: (maxSort.mx ?? 0) + 1,
    intervalMonths: input.intervalMonths ?? null,
    intervalSource: input.intervalMonths == null ? null : (input.intervalSource ?? 'betrieblich'),
  });
  return listInstructionDefinitions();
};

export const updateInstructionDefinition = (input: {
  id: number;
  topic: string;
  legalBasis?: string | null;
  note?: string | null;
  intervalMonths?: number | null;
  intervalSource?: IntervalSource | null;
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
        note = @note,
        intervalMonths = @intervalMonths,
        intervalSource = @intervalSource
    WHERE id = @id
  `,
  ).run({
    id: input.id,
    topic,
    legalBasis: input.legalBasis?.trim() || null,
    note: input.note?.trim() || null,
    intervalMonths: input.intervalMonths ?? null,
    intervalSource: input.intervalMonths == null ? null : (input.intervalSource ?? 'betrieblich'),
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
        idf.intervalMonths,
        idf.intervalSource,
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
    intervalMonths: row.intervalMonths ?? null,
    intervalSource: (row.intervalSource ?? null) as IntervalSource | null,
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
  /** Whether finishing this one should schedule the next; see docs/adr/0002. */
  scheduleFollowUp?: boolean;
}): EmployeeInstruction[] => {
  const db = getDb();
  const values = {
    employeeId: input.employeeId,
    instructionDefinitionId: input.instructionDefinitionId,
    dueDate: input.dueDate ?? null,
    completedAt: input.completedAt ?? null,
    conductedBy: input.conductedBy?.trim() || null,
    note: input.note?.trim() || null,
  };

  const write = db.transaction(() => {
    if (input.id) {
      db.prepare(
        `
        UPDATE employee_instructions
        SET dueDate = @dueDate,
            completedAt = @completedAt,
            conductedBy = @conductedBy,
            note = @note
        WHERE id = @id
      `,
      ).run({ ...values, id: input.id });
    } else {
      db.prepare(
        `
        INSERT INTO employee_instructions
          (employeeId, instructionDefinitionId, dueDate, completedAt, conductedBy, note)
        VALUES (@employeeId, @instructionDefinitionId, @dueDate, @completedAt, @conductedBy, @note)
      `,
      ).run(values);
    }

    if (!input.scheduleFollowUp || !values.completedAt) return;

    const definition = db
      .prepare('SELECT intervalMonths FROM instruction_definitions WHERE id = ?')
      .get(input.instructionDefinitionId) as { intervalMonths: number | null } | undefined;
    const employee = db
      .prepare('SELECT birthDate FROM employees WHERE id = ?')
      .get(input.employeeId) as { birthDate: string | null } | undefined;

    const due = nextDueDate(definition?.intervalMonths, employee?.birthDate, values.completedAt);
    if (!due) return;

    // The finished row stays as the record; the follow-up is a new open one.
    const alreadyOpen = db
      .prepare(
        'SELECT id FROM employee_instructions WHERE employeeId = ? AND instructionDefinitionId = ? AND completedAt IS NULL',
      )
      .get(input.employeeId, input.instructionDefinitionId) as { id: number } | undefined;
    if (alreadyOpen) return;

    db.prepare(
      `
      INSERT INTO employee_instructions (employeeId, instructionDefinitionId, dueDate)
      VALUES (?, ?, ?)
    `,
    ).run(input.employeeId, input.instructionDefinitionId, due);
  });

  write();
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
