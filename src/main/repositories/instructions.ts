import { localDate, requireDate } from '../../utils/calendarDate';
import type {
  EmployeeInstruction,
  InstructionDefinition,
  IntervalSource,
} from '../../shared/types';
import { getDb } from '../database/connection';
import { nextDueDate } from '../../utils/instructionSchedule';

const normalizeDefinitionRows = (rows: any[]): InstructionDefinition[] =>
  rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    legalBasis: row.legalBasis ?? null,
    note: row.note ?? null,
    sortOrder: row.sortOrder ?? null,
    minorHazardInstruction: row.minorHazardInstruction === 1,
    intervalMonths: row.intervalMonths ?? null,
    intervalSource: (row.intervalSource ?? null) as IntervalSource | null,
  }));

export const listInstructionDefinitions = (): InstructionDefinition[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, topic, legalBasis, note, sortOrder, intervalMonths, intervalSource, minorHazardInstruction
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
  minorHazardInstruction?: boolean;
}): InstructionDefinition[] => {
  const db = getDb();
  if (
    input.intervalMonths != null &&
    (!Number.isInteger(input.intervalMonths) ||
      input.intervalMonths <= 0 ||
      input.intervalMonths > 120)
  )
    throw new Error('Intervall muss 1 bis 120 Monate betragen.');
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('Einweisung darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM instruction_definitions').get() as {
    mx: number | null;
  };
  db.prepare(
    `
    INSERT INTO instruction_definitions (topic, legalBasis, note, sortOrder, intervalMonths, intervalSource, minorHazardInstruction)
    VALUES (@topic, @legalBasis, @note, @sortOrder, @intervalMonths, @intervalSource, @minorHazardInstruction)
  `,
  ).run({
    topic,
    legalBasis: input.legalBasis?.trim() || null,
    note: input.note?.trim() || null,
    sortOrder: (maxSort.mx ?? 0) + 1,
    minorHazardInstruction: input.minorHazardInstruction ? 1 : 0,
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
  minorHazardInstruction?: boolean;
}): InstructionDefinition[] => {
  const db = getDb();
  if (
    input.intervalMonths != null &&
    (!Number.isInteger(input.intervalMonths) ||
      input.intervalMonths <= 0 ||
      input.intervalMonths > 120)
  )
    throw new Error('Intervall muss 1 bis 120 Monate betragen.');
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('Einweisung darf nicht leer sein.');
  }
  const existing = db.prepare('SELECT * FROM instruction_definitions WHERE id=?').get(input.id) as
    | InstructionDefinition
    | undefined;
  if (!existing) throw new Error('Definition nicht gefunden.');
  const months =
    input.intervalMonths === undefined ? existing.intervalMonths : input.intervalMonths;
  db.prepare(
    `
    UPDATE instruction_definitions
    SET topic = @topic,
        legalBasis = @legalBasis,
        note = @note,
        intervalMonths = @intervalMonths,
        intervalSource = @intervalSource,
        minorHazardInstruction = @minorHazardInstruction
    WHERE id = @id
  `,
  ).run({
    id: input.id,
    topic,
    legalBasis: input.legalBasis?.trim() || null,
    note: input.note?.trim() || null,
    minorHazardInstruction:
      input.minorHazardInstruction === undefined
        ? Number(existing.minorHazardInstruction ?? 0)
        : Number(input.minorHazardInstruction),
    intervalMonths: months ?? null,
    intervalSource:
      months == null ? null : (input.intervalSource ?? existing.intervalSource ?? 'betrieblich'),
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
  if (
    db
      .prepare('SELECT id FROM employee_instructions WHERE instructionDefinitionId=? LIMIT 1')
      .get(id)
  )
    throw new Error('Das Thema besitzt Nachweise oder Zuordnungen und kann nicht gelöscht werden.');
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
        idf.minorHazardInstruction,
        ei.evidenceRef, ei.content, ei.scheduleReviewRequired,
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
    minorHazardInstruction: row.minorHazardInstruction === 1,
    intervalMonths: row.intervalMonths ?? null,
    intervalSource: (row.intervalSource ?? null) as IntervalSource | null,
    evidenceRef: row.evidenceRef ?? null,
    content: row.content ?? null,
    scheduleReviewRequired: row.scheduleReviewRequired === 1,
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
  scheduleFollowUp?: boolean;
  evidenceRef?: string | null;
  content?: string | null;
  scheduleReviewRequired?: boolean;
}): EmployeeInstruction[] => {
  const db = getDb();
  if (input.dueDate) requireDate(input.dueDate, 'Fälligkeit');
  if (input.completedAt) {
    requireDate(input.completedAt, 'Durchführung');
    if (input.completedAt > localDate())
      throw new Error('Eine Durchführung kann nicht in der Zukunft liegen.');
  }
  db.transaction(() => {
    let id = input.id;
    const old = id
      ? (db
          .prepare('SELECT * FROM employee_instructions WHERE id=? AND employeeId=?')
          .get(id, input.employeeId) as EmployeeInstruction | undefined)
      : undefined;
    if (id && (!old || old.instructionDefinitionId !== input.instructionDefinitionId))
      throw new Error('Nachweis nicht gefunden oder falsches Thema.');
    if (id && old && input.dueDate !== undefined && input.dueDate !== old.dueDate)
      db.prepare('UPDATE employee_instructions SET previousInstructionId=NULL WHERE id=?').run(id);
    const evidence =
      input.evidenceRef === undefined
        ? (old?.evidenceRef ?? null)
        : input.evidenceRef?.trim() || null;
    const content =
      input.content === undefined ? (old?.content ?? null) : input.content?.trim() || null;
    const review =
      input.scheduleReviewRequired === undefined
        ? Number(old?.scheduleReviewRequired ?? 0)
        : Number(input.scheduleReviewRequired);
    if (id)
      db.prepare(
        'UPDATE employee_instructions SET dueDate=?,completedAt=?,conductedBy=?,note=?,evidenceRef=?,content=?,scheduleReviewRequired=? WHERE id=? AND employeeId=?',
      ).run(
        input.dueDate ?? null,
        input.completedAt ?? null,
        input.conductedBy ?? null,
        input.note ?? null,
        evidence,
        content,
        review,
        id,
        input.employeeId,
      );
    else
      id = Number(
        db
          .prepare(
            'INSERT INTO employee_instructions(employeeId,instructionDefinitionId,dueDate,completedAt,conductedBy,note,evidenceRef,content) VALUES (?,?,?,?,?,?,?,?)',
          )
          .run(
            input.employeeId,
            input.instructionDefinitionId,
            input.dueDate ?? null,
            input.completedAt ?? null,
            input.conductedBy ?? null,
            input.note ?? null,
            evidence,
            content,
          ).lastInsertRowid,
      );
    if (!input.scheduleFollowUp || !input.completedAt) return;
    const definition = db
      .prepare(
        'SELECT intervalMonths,minorHazardInstruction FROM instruction_definitions WHERE id=?',
      )
      .get(input.instructionDefinitionId) as {
      intervalMonths: number | null;
      minorHazardInstruction: number;
    };
    const employee = db
      .prepare('SELECT birthDate FROM employees WHERE id=?')
      .get(input.employeeId) as { birthDate: string | null };
    const due = nextDueDate(
      definition.intervalMonths,
      employee.birthDate,
      input.completedAt,
      definition.minorHazardInstruction === 1,
    );
    if (!due) return;
    const linked = db
      .prepare(
        'SELECT id FROM employee_instructions WHERE previousInstructionId=? AND completedAt IS NULL',
      )
      .get(id) as { id: number } | undefined;
    if (linked) {
      db.prepare('UPDATE employee_instructions SET dueDate=? WHERE id=?').run(due, linked.id);
      return;
    }
    if (
      db
        .prepare(
          'SELECT id FROM employee_instructions WHERE employeeId=? AND instructionDefinitionId=? AND completedAt IS NULL',
        )
        .get(input.employeeId, input.instructionDefinitionId)
    )
      return;
    db.prepare(
      'INSERT INTO employee_instructions(employeeId,instructionDefinitionId,dueDate,previousInstructionId) VALUES (?,?,?,?)',
    ).run(input.employeeId, input.instructionDefinitionId, due, id);
  })();
  return listEmployeeInstructions(input.employeeId);
};

/** Ids of people who already hold an open entry for this topic. */
export const listEmployeesWithOpenInstruction = (instructionDefinitionId: number): number[] => {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT DISTINCT employeeId FROM employee_instructions WHERE instructionDefinitionId = ? AND completedAt IS NULL',
    )
    .all(instructionDefinitionId) as Array<{ employeeId: number }>;
  return rows.map((row) => row.employeeId);
};

/**
 * Assign one instruction to many people at once.
 *
 * Adding a topic to the catalogue is cheap, assigning it to everyone by hand is
 * not — five new mandatory instructions across a small service are well over a
 * hundred dialogs, which is how a complete catalogue turns into a list nobody
 * follows.
 *
 * People who already hold an open entry for the topic are skipped rather than
 * given a second one; a completed entry does not block a new assignment, since
 * that is exactly the follow-up case.
 */
export const assignInstructionToEmployees = (input: {
  instructionDefinitionId: number;
  employeeIds: number[];
  dueDate?: string | null;
}): number => {
  const db = getDb();
  const dueDate = input.dueDate || null;
  if (dueDate) requireDate(dueDate, 'Fälligkeit');

  const openEntry = db.prepare(
    'SELECT id FROM employee_instructions WHERE employeeId = ? AND instructionDefinitionId = ? AND completedAt IS NULL',
  );
  const insert = db.prepare(
    'INSERT INTO employee_instructions (employeeId, instructionDefinitionId, dueDate) VALUES (?, ?, ?)',
  );

  let assigned = 0;
  const write = db.transaction(() => {
    input.employeeIds.forEach((employeeId) => {
      if (openEntry.get(employeeId, input.instructionDefinitionId)) return;
      insert.run(employeeId, input.instructionDefinitionId, dueDate);
      assigned += 1;
    });
  });
  write();

  return assigned;
};

export const deleteEmployeeInstruction = (
  employeeId: number,
  recordId: number,
): EmployeeInstruction[] => {
  const db = getDb();
  db.prepare('DELETE FROM employee_instructions WHERE employeeId = ? AND id = ?').run(
    employeeId,
    recordId,
  );
  return listEmployeeInstructions(employeeId);
};
