/**
 * Events Repository
 *
 * Data access functions for employee events (join, leave, qualification changes, etc.)
 */

import type { EmployeeEvent, EmployeeEventType, UpcomingEvent } from '../../shared/types';

import { getDb } from '../database/connection';

/**
 * Parse a raw event row from the database
 */
const parseEventRow = (row: any): EmployeeEvent => {
  let meta: Record<string, unknown> | null = null;
  if (row.meta) {
    try {
      meta = JSON.parse(row.meta);
    } catch {
      meta = null;
    }
  }
  return {
    id: row.id,
    employeeId: row.employeeId,
    eventDate: row.eventDate,
    type: row.type as EmployeeEventType,
    title: row.title,
    details: row.details ?? null,
    meta,
    previousValue: row.previousValue ?? null,
    newValue: row.newValue ?? null,
  };
};

/**
 * List all events for an employee
 */
export const listEvents = (employeeId: number): EmployeeEvent[] => {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, employeeId, eventDate, type, title, details, meta, previousValue, newValue
      FROM employee_events
      WHERE employeeId = ?
      ORDER BY date(eventDate) DESC, id DESC;
    `,
    )
    .all(employeeId);
  return rows.map(parseEventRow);
};

/**
 * Save (create or update) an event
 */
export const saveEvent = (input: {
  id?: number;
  employeeId: number;
  eventDate: string;
  type: EmployeeEventType;
  title: string;
  details?: string | null;
  meta?: Record<string, unknown> | null;
  previousValue?: string | null;
  newValue?: string | null;
}): EmployeeEvent[] => {
  const db = getDb();
  const metaStr = input.meta ? JSON.stringify(input.meta) : null;

  if (input.id) {
    db.prepare(
      `UPDATE employee_events
       SET eventDate = @eventDate, type = @type, title = @title, details = @details, meta = @meta, previousValue = @previousValue, newValue = @newValue
       WHERE id = @id`,
    ).run({
      id: input.id,
      eventDate: input.eventDate,
      type: input.type,
      title: input.title,
      details: input.details ?? null,
      meta: metaStr,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
    });
  } else {
    db.prepare(
      `INSERT INTO employee_events (employeeId, eventDate, type, title, details, meta, previousValue, newValue)
       VALUES (@employeeId, @eventDate, @type, @title, @details, @meta, @previousValue, @newValue)`,
    ).run({
      employeeId: input.employeeId,
      eventDate: input.eventDate,
      type: input.type,
      title: input.title,
      details: input.details ?? null,
      meta: metaStr,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
    });
  }

  return listEvents(input.employeeId);
};

/**
 * Delete an event
 */
export const deleteEvent = (id: number, employeeId: number): EmployeeEvent[] => {
  const db = getDb();
  db.prepare('DELETE FROM employee_events WHERE id = ?').run(id);
  return listEvents(employeeId);
};

/**
 * List upcoming events for all employees
 */
export const listUpcomingEvents = (fromDate?: string, limit: number = 10): UpcomingEvent[] => {
  const db = getDb();
  const today = fromDate ?? new Date().toISOString().slice(0, 10);

  const rows = db
    .prepare(
      `
      SELECT
        e.id,
        e.employeeId,
        e.eventDate,
        e.type,
        e.title,
        e.details,
        e.meta,
        e.previousValue,
        e.newValue,
        emp.name as employeeName
      FROM employee_events e
      INNER JOIN employees emp ON e.employeeId = emp.id
      WHERE date(e.eventDate) >= date(?)
      ORDER BY date(e.eventDate) ASC, e.id ASC
      LIMIT ?
    `,
    )
    .all(today, limit);

  return rows.map((row: any) => ({
    ...parseEventRow(row),
    employeeName: row.employeeName,
  }));
};


