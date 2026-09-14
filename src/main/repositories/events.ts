import { localDate, requireDate } from '../../utils/calendarDate';
/**
 * Events Repository
 *
 * Data access functions for employee events (join, leave, qualification changes, etc.)
 */

import type { EmployeeEvent, EmployeeEventType, UpcomingEvent } from '../../shared/types';

import { getDb } from '../database/connection';
import { nextDeviceId } from '../syncRecords';

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
    expiresAt: row.expiresAt ?? null,
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
      SELECT id, employeeId, eventDate, type, title, details, meta, previousValue, newValue, expiresAt
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
  expiresAt?: string | null;
}): EmployeeEvent[] => {
  const db = getDb();
  requireDate(input.eventDate);
  if (input.expiresAt) {
    requireDate(input.expiresAt);
    if (input.expiresAt < input.eventDate) throw new Error('Gültigkeitsende liegt vor dem Termin.');
  }
  if (input.type === 'join' || input.type === 'leave')
    throw new Error('Eintritt und Austritt bitte in der Beschäftigungsperiode bearbeiten.');
  const metaStr = input.meta ? JSON.stringify(input.meta) : null;

  if (input.id) {
    db.prepare(
      `UPDATE employee_events
       SET eventDate = @eventDate, type = @type, title = @title, details = @details, meta = @meta, previousValue = @previousValue, newValue = @newValue, expiresAt = @expiresAt
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
      expiresAt: input.expiresAt ?? null,
    });
  } else {
    db.prepare(
      `INSERT INTO employee_events (id, employeeId, eventDate, type, title, details, meta, previousValue, newValue, expiresAt)
       VALUES (@id, @employeeId, @eventDate, @type, @title, @details, @meta, @previousValue, @newValue, @expiresAt)`,
    ).run({
      id: nextDeviceId(db, 'employee_events'),
      employeeId: input.employeeId,
      eventDate: input.eventDate,
      type: input.type,
      title: input.title,
      details: input.details ?? null,
      meta: metaStr,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      expiresAt: input.expiresAt ?? null,
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
export const listUpcomingEvents = (fromDate?: string, limit = 10): UpcomingEvent[] => {
  const db = getDb();
  const today = fromDate ?? localDate();

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
        e.expiresAt,
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

/**
 * List all events within a date range (for calendar view)
 */
export const listEventsInRange = (startDate: string, endDate: string): UpcomingEvent[] => {
  const db = getDb();

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
        e.expiresAt,
        emp.name as employeeName
      FROM employee_events e
      INNER JOIN employees emp ON e.employeeId = emp.id
      WHERE date(e.eventDate) >= date(?)
        AND date(e.eventDate) <= date(?)
      ORDER BY date(e.eventDate) ASC, e.id ASC
    `,
    )
    .all(startDate, endDate);

  const events: UpcomingEvent[] = rows.map((row: any) => ({
    ...parseEventRow(row),
    employeeName: row.employeeName,
  }));
  const activeOn = (id: number, date: string) =>
    !!db
      .prepare(
        'SELECT 1 FROM employment_periods WHERE employeeId=? AND startDate<=? AND (endDate IS NULL OR endDate>=?)',
      )
      .get(id, date, date);
  const people = db
    .prepare('SELECT id,name,birthDate FROM employees WHERE birthDate IS NOT NULL')
    .all() as { id: number; name: string; birthDate: string }[];
  for (const person of people) {
    for (let year = Number(startDate.slice(0, 4)); year <= Number(endDate.slice(0, 4)); year++) {
      const date = `${year}-${person.birthDate.slice(5)}`;
      if (date < startDate || date > endDate || !activeOn(person.id, date)) continue;
      const parsed = new Date(`${date}T12:00:00`);
      if (localDate(parsed) !== date) continue;
      events.push({
        id: -person.id,
        employeeId: person.id,
        employeeName: person.name,
        type: 'birthday',
        eventDate: date,
        title: 'Geburtstag',
        details:
          Number(person.birthDate.slice(0, 4)) > 0
            ? `${year - Number(person.birthDate.slice(0, 4))}. Geburtstag`
            : undefined,
      });
    }
  }
  const due = db
    .prepare(
      `SELECT i.id,i.employeeId,e.name,d.topic,i.dueDate FROM employee_instructions i JOIN employees e ON e.id=i.employeeId JOIN instruction_definitions d ON d.id=i.instructionDefinitionId WHERE i.completedAt IS NULL AND i.dueDate BETWEEN ? AND ?`,
    )
    .all(startDate, endDate) as {
    id: number;
    employeeId: number;
    name: string;
    topic: string;
    dueDate: string;
  }[];
  for (const row of due)
    if (activeOn(row.employeeId, row.dueDate))
      events.push({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.name,
        type: 'instruction-due',
        eventDate: row.dueDate,
        title: row.topic,
        details: 'Unterweisung fällig',
      });
  const expiry = db
    .prepare(
      `SELECT ev.id,ev.employeeId,e.name,ev.title,ev.expiresAt FROM employee_events ev JOIN employees e ON e.id=ev.employeeId WHERE ev.expiresAt BETWEEN ? AND ?`,
    )
    .all(startDate, endDate) as {
    id: number;
    employeeId: number;
    name: string;
    title: string;
    expiresAt: string;
  }[];
  for (const row of expiry)
    if (activeOn(row.employeeId, row.expiresAt))
      events.push({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.name,
        type: 'certificate-expiry',
        eventDate: row.expiresAt,
        title: row.title,
        details: 'Gültigkeit endet',
      });
  return events.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
};
