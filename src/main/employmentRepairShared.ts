import { createHash } from 'node:crypto';

import { getDb } from './database/connection';

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

export const overlaps = (
  left: Pick<PeriodRow, 'startDate' | 'endDate'>,
  right: Pick<PeriodRow, 'startDate' | 'endDate'>,
): boolean => {
  if ((left.endDate && left.startDate > left.endDate) || (right.endDate && right.startDate > right.endDate)) return false;
  return left.startDate <= (right.endDate ?? '9999-12-31') && right.startDate <= (left.endDate ?? '9999-12-31');
};

/**
 * Fingerprint the database state used by a repair preview. Backup bookkeeping
 * is deliberately omitted because a required backup updates its timestamp
 * immediately before the destructive operation; all schema and data rows
 * remain part of the fingerprint.
 */
export const snapshotToken = (db: Db): string => {
  const schema = allRows<{ type: string; name: string; sql: string | null }>(
    db,
    "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",
  );
  const contents = schema
    .filter((entry) => entry.type === 'table')
    .map((entry) => ({
      name: entry.name,
      rows:
        entry.name === 'settings'
          ? allRows(db, "SELECT key,value FROM settings WHERE key NOT IN ('backupLastAt','backupLastError') ORDER BY key")
          : allRows(db, `SELECT * FROM ${quoteIdentifier(entry.name)}`),
    }));
  return createHash('sha256').update(JSON.stringify({ schema, contents })).digest('hex');
};

export const repairToken = (db: Db, operation: string, input: unknown): string =>
  createHash('sha256')
    .update(`${snapshotToken(db)}:${operation}:${JSON.stringify(input)}`)
    .digest('hex');

export const assertFresh = (db: Db, token: string, operation: string, input: unknown): void => {
  if (repairToken(db, operation, input) !== token)
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
  db: Db,
  employeeId: number,
  title: string,
  details: string,
  meta: Record<string, unknown>,
  previousValue?: string | null,
  newValue?: string | null,
): void => {
  db.prepare(`INSERT INTO employee_events
    (employeeId,eventDate,type,title,details,meta,previousValue,newValue)
    VALUES (?,date('now','localtime'),'custom',?,?,?,?,?)`).run(
    employeeId,
    title,
    details,
    JSON.stringify(meta),
    previousValue ?? null,
    newValue ?? null,
  );
};
