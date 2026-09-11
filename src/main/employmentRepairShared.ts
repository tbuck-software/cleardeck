import { createHash } from 'node:crypto';

import { localDate } from '../utils/calendarDate';
import type { RepairRecordSummary } from '../shared/types';
import { getDb } from './database/connection';
import { saveEvent } from './repositories/events';

export type Db = ReturnType<typeof getDb>;

export interface PeriodRow {
  id: number;
  employeeId: number;
  employeeName?: string;
  startDate: string;
  endDate: string | null;
  qualification: string | null;
  note: string | null;
}

export interface EmployeeRow {
  id: number;
  name: string;
  note: string | null;
  birthDate: string | null;
  department?: string | null;
  fte: number | null;
  weeklyHours: number | null;
}

export const PERIOD_COLUMNS =
  'id,employeeId,startDate,endDate,qualification,note';

export const allRows = <T = any>(db: Db, sql: string, ...params: unknown[]): T[] =>
  db.prepare(sql).all(...params) as T[];

export const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

export const getEmployee = (id: number): EmployeeRow => {
  const row = getDb()
    .prepare('SELECT id,name,note,birthDate,department,fte,weeklyHours FROM employees WHERE id=?')
    .get(id) as EmployeeRow | undefined;
  if (!row) throw new Error('Person nicht gefunden.');
  return row;
};

export const getPeriod = (id: number): PeriodRow => {
  const row = getDb()
    .prepare(
      `SELECT p.id,p.employeeId,e.name AS employeeName,p.startDate,p.endDate,p.qualification,p.note
       FROM employment_periods p JOIN employees e ON e.id=p.employeeId WHERE p.id=?`,
    )
    .get(id) as PeriodRow | undefined;
  if (!row) throw new Error('Beschäftigungsperiode nicht gefunden.');
  return row;
};

/** Two rows describe the same fact when every field outside `ignored` matches. */
export const rowsEqual = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  ignored: string[],
): boolean =>
  [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => !ignored.includes(key))
    .every((key) => (left[key] ?? null) === (right[key] ?? null));

export const periodRecordSummaries = (db: Db, periodId: number): RepairRecordSummary[] => {
  const terms = allRows<{ id: number }>(db, 'SELECT id FROM employment_terms WHERE periodId=?', periodId);
  const history = allRows<{ id: number }>(db, 'SELECT id FROM employment_term_history WHERE periodId=?', periodId);
  return [
    { table: 'employment_terms', ids: terms.map((row) => row.id), count: terms.length },
    { table: 'employment_term_history', ids: history.map((row) => row.id), count: history.length },
  ].filter((record) => record.count > 0);
};

/** Tables a repair reads and rewrites; only these are fingerprinted for its preview. */
export const PERIOD_TABLES = ['employment_periods', 'employment_terms', 'employment_term_history'];

/**
 * Fingerprint the database state a repair preview was built from. Only the
 * tables the operation touches are hashed, so unrelated bookkeeping such as
 * backup timestamps cannot invalidate a preview.
 */
const snapshotToken = (db: Db, tables: string[]): string => {
  const contents = [...new Set(tables)].sort().map((name) => ({
    name,
    schema: (db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name) as { sql?: string } | undefined)?.sql ?? null,
    rows: allRows(db, `SELECT * FROM ${quoteIdentifier(name)}`),
  }));
  return createHash('sha256').update(JSON.stringify(contents)).digest('hex');
};

export const repairToken = (
  db: Db,
  operation: string,
  input: unknown,
  tables: string[],
): string =>
  createHash('sha256')
    .update(`${snapshotToken(db, tables)}:${operation}:${JSON.stringify(input)}`)
    .digest('hex');

export const assertFresh = (
  db: Db,
  token: string,
  operation: string,
  input: unknown,
  tables: string[],
): void => {
  if (repairToken(db, operation, input, tables) !== token)
    throw new Error('Die Vorschau ist veraltet. Bitte Daten neu prüfen.');
};

interface EmployeeRelation {
  table: string;
  column: string;
}

export const employeeRelations = (db: Db): EmployeeRelation[] => {
  const tables = allRows<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const relations: EmployeeRelation[] = [];
  tables.forEach(({ name }) => {
    const foreignKeys = allRows<{ table: string; from: string }>(
      db,
      `PRAGMA foreign_key_list(${quoteIdentifier(name)})`,
    );
    foreignKeys
      .filter((foreignKey) => foreignKey.table === 'employees')
      .forEach((foreignKey) => relations.push({ table: name, column: foreignKey.from }));
  });
  return relations;
};

export const linkedRecordSummaries = (db: Db, sourceId: number) =>
  employeeRelations(db)
    .map(({ table, column }) => {
      const rows = allRows<{ id?: number }>(
        db,
        `SELECT rowid AS id FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(column)}=?`,
        sourceId,
      );
      return {
        table,
        ids: rows.map((row) => Number(row.id)).filter(Number.isFinite),
        count: rows.length,
      };
    })
    .filter((record) => record.count > 0);

export const recordRepairEvent = (
  employeeId: number,
  title: string,
  details: string,
  meta: Record<string, unknown>,
  previousValue?: string | null,
  newValue?: string | null,
): void => {
  saveEvent({
    employeeId,
    eventDate: localDate(),
    type: 'custom',
    title,
    details,
    meta,
    previousValue: previousValue ?? null,
    newValue: newValue ?? null,
  });
};
