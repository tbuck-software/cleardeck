/**
 * Employee Repository
 *
 * Data access functions for employees and employment periods.
 */

import type {
  Aggregation,
  Employee,
  EmploymentPeriod,
  EmployeeWithPeriod,
  EmployeeEventType,
  YearDataset,
} from '../../shared/types';

import { getDb } from '../database/connection';
import { saveEvent } from './events';

/**
 * Compute employee status for a given year
 */
const computeStatus = (endDate: string | null, year: number): 'active' | 'left' => {
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  if (end && end >= yearStart && end <= yearEnd) {
    return 'left';
  }
  return 'active';
};

/**
 * Build aggregation data from employee list
 */
const buildAggregation = (employees: EmployeeWithPeriod[]): Aggregation => {
  let totalFte = 0;
  const categories = new Map<string, { headcount: number; fte: number }>();
  employees.forEach((emp) => {
    totalFte += emp.fte;
    const current = categories.get(emp.qualification) ?? { headcount: 0, fte: 0 };
    current.headcount += 1;
    current.fte += emp.fte;
    categories.set(emp.qualification, current);
  });

  return {
    totalHeadcount: employees.length,
    totalFte: Number(totalFte.toFixed(2)),
    categories: Array.from(categories.entries()).map(([qualification, value]) => ({
      qualification,
      headcount: value.headcount,
      fte: Number(value.fte.toFixed(2)),
    })),
  };
};

/**
 * Get all employees with their current period for a given year
 */
export const getYearDataset = (year: number): YearDataset => {
  const db = getDb();
  const startIso = `${year}-01-01`;
  const endIso = `${year}-12-31`;

  const baseHoursRow = db
    .prepare("SELECT value FROM settings WHERE key = 'baseHours'")
    .get() as { value?: string } | undefined;
  const fullTimeHours = baseHoursRow?.value ? Number(baseHoursRow.value) || 36 : 36;

  const eventRows = db
    .prepare(
      `
      SELECT employeeId, type, eventDate
      FROM employee_events
      WHERE type IN ('join', 'leave')
    `,
    )
    .all() as { employeeId: number; type: EmployeeEventType; eventDate: string }[];

  const joinEvents = new Map<number, string>();
  const leaveEvents = new Map<number, string>();
  eventRows.forEach((row) => {
    if (row.type === 'join') {
      const existing = joinEvents.get(row.employeeId);
      if (!existing || existing < row.eventDate) {
        joinEvents.set(row.employeeId, row.eventDate);
      }
    }
    if (row.type === 'leave') {
      const existing = leaveEvents.get(row.employeeId);
      if (!existing || existing < row.eventDate) {
        leaveEvents.set(row.employeeId, row.eventDate);
      }
    }
  });

  const rows = db
    .prepare(
      `
      SELECT e.id as employeeId,
             e.name,
             e.note,
             e.weeklyHours,
             e.fte,
             e.createdAt,
             p.id as periodId,
             p.startDate,
             p.endDate,
             p.qualification as qualification,
             p.note as periodNote
      FROM employees e
      INNER JOIN employment_periods p ON p.employeeId = e.id
      WHERE date(p.startDate) <= date(@endIso)
        AND (p.endDate IS NULL OR date(p.endDate) >= date(@startIso))
      ORDER BY e.id ASC, p.startDate DESC;
    `,
    )
    .all({ startIso, endIso }) as (Employee &
    EmploymentPeriod & {
      employeeId: number;
      periodId: number;
      periodNote?: string | null;
      createdAt?: string;
      fte: number;
    })[];

  const latest = new Map<number, EmployeeWithPeriod>();
  rows.forEach((row) => {
    const current = latest.get(row.employeeId);
    if (!current || new Date(row.startDate) > new Date(current.startDate)) {
      const joinDate = joinEvents.get(row.employeeId);
      const leaveDate = leaveEvents.get(row.employeeId);
      const effectiveStart = joinDate && joinDate > row.startDate ? joinDate : row.startDate;
      const effectiveEnd =
        leaveDate && (!row.endDate || leaveDate < row.endDate) ? leaveDate : row.endDate ?? null;

      latest.set(row.employeeId, {
        id: row.employeeId,
        name: row.name,
        qualification: row.qualification,
        weeklyHours: row.weeklyHours ?? null,
        createdAt: row.createdAt,
        startDate: effectiveStart,
        endDate: effectiveEnd ?? null,
        fte: row.fte,
        status: computeStatus(effectiveEnd ?? null, year),
        periodId: row.periodId,
        note: row.periodNote ?? row.note ?? null,
      });
    }
  });

  const employees = Array.from(latest.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return {
    employees,
    aggregation: buildAggregation(employees),
    baseHours: fullTimeHours,
  };
};

/**
 * List all periods for an employee
 */
export const listPeriods = (employeeId: number): EmploymentPeriod[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, startDate, endDate, qualification, note
      FROM employment_periods
      WHERE employeeId = ?
      ORDER BY startDate DESC;
    `,
    )
    .all(employeeId) as EmploymentPeriod[];
  return rows;
};

/**
 * Save (create or update) an employee and their period
 */
export const saveEmployee = (input: {
  id?: number;
  periodId?: number;
  name: string;
  fte: number;
  weeklyHours?: number | null;
  startDate: string;
  endDate?: string | null;
  note?: string | null;
  year: number;
  qualification: string;
}): YearDataset => {
  const db = getDb();

  const employeePayload = {
    name: input.name,
    note: input.note ?? null,
    weeklyHours: input.weeklyHours ?? null,
    fte: input.fte,
  };

  const periodPayload = {
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    qualification: input.qualification,
    note: input.note ?? null,
  };

  if (input.id) {
    db.prepare(
      `UPDATE employees
       SET name = @name, note = @note, weeklyHours = @weeklyHours, fte = @fte
       WHERE id = @id`,
    ).run({ ...employeePayload, id: input.id });

    if (input.periodId) {
      db.prepare(
        `UPDATE employment_periods
         SET startDate = @startDate, endDate = @endDate, qualification = @qualification, note = @note
         WHERE id = @periodId`,
      ).run({ ...periodPayload, periodId: input.periodId });
    } else {
      db.prepare(
        `INSERT INTO employment_periods (employeeId, startDate, endDate, qualification, note)
         VALUES (@employeeId, @startDate, @endDate, @qualification, @note)`,
      ).run({ ...periodPayload, employeeId: input.id });
    }
  } else {
    const empResult = db
      .prepare(
        `INSERT INTO employees (name, note, weeklyHours, fte)
         VALUES (@name, @note, @weeklyHours, @fte)`,
      )
      .run(employeePayload);
    const newId = empResult.lastInsertRowid as number;

    db.prepare(
      `INSERT INTO employment_periods (employeeId, startDate, endDate, qualification, note)
       VALUES (@employeeId, @startDate, @endDate, @qualification, @note)`,
    ).run({ ...periodPayload, employeeId: newId });

    // Create join event for new employee
    saveEvent({
      employeeId: newId,
      eventDate: input.startDate,
      type: 'join',
      title: 'Eintritt',
    });
  }

  return getYearDataset(input.year);
};

/**
 * Delete an employee
 */
export const deleteEmployee = (id: number, year: number): YearDataset => {
  const db = getDb();
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  return getYearDataset(year);
};

/**
 * Delete an employment period
 */
export const deletePeriod = (periodId: number, year: number): YearDataset => {
  const db = getDb();
  db.prepare('DELETE FROM employment_periods WHERE id = ?').run(periodId);
  return getYearDataset(year);
};
