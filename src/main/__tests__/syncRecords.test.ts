/// <reference types="vitest/globals" />
// @vitest-environment node

import SqliteAdapter from './sqliteAdapter';
import { runMigrations, CURRENT_SCHEMA_VERSION } from '../database/migrations';
import syncSchema from '../../shared/syncSchema.json';
vi.mock('better-sqlite3', async () => ({ default: (await import('./sqliteAdapter')).default }));
import {
  allocateDeviceIds,
  captureDeviceCounters,
  captureLocalSettings,
  captureRecords,
  createSyncDatabase,
  diffRecords,
  nextDeviceId,
  applyChanges,
  type SyncChange,
} from '../syncRecords';

const database = (): SqliteAdapter => {
  const db = new SqliteAdapter(':memory:');
  runMigrations(db as never);
  return db;
};

const employee = (db: SqliteAdapter, name: string, id?: number): void => {
  if (id === undefined) {
    db.prepare('INSERT INTO employees(name, fte) VALUES (?, ?)').run(name, 1);
  } else {
    db.prepare('INSERT INTO employees(id, name, fte) VALUES (?, ?, ?)').run(id, name, 1);
  }
};

describe('syncRecords', () => {
  it('keeps the trusted schema artifact in lockstep with migrated SQLite', () => {
    const db = database();
    const schema = syncSchema as {
      tables: Array<{
        name: string;
        columns: Array<{ name: string; type: string; notNull: boolean; default: string | number | null }>;
        primaryKey: string[];
        foreignKeys: Array<{ columns: string[]; table: string; referencedColumns: string[]; onDelete?: string }>;
        uniqueConstraints: string[][];
        indexes: Array<{ name: string; columns: string[]; unique?: boolean; sql?: string }>;
      }>;
    };
    const actualTables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
    expect(actualTables).toEqual(schema.tables.map((table) => table.name).sort());

    for (const table of schema.tables) {
      const escaped = table.name.replaceAll('"', '""');
      const columns = db.prepare(`PRAGMA table_info("${escaped}")`).all() as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | number | null;
        pk: number;
      }>;
      expect(columns.map((column) => ({
        name: column.name,
        type: column.type,
        notNull: column.notnull === 1,
        default: column.dflt_value,
      }))).toEqual(table.columns);
      expect(columns.filter((column) => column.pk > 0).sort((left, right) => left.pk - right.pk).map((column) => column.name)).toEqual(table.primaryKey);

      const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${escaped}")`).all() as Array<{
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      const actualForeignKeys = [...new Set(foreignKeys.map((key) => key.id))].map((id) => {
        const group = foreignKeys.filter((key) => key.id === id).sort((left, right) => left.seq - right.seq);
        return {
          columns: group.map((key) => key.from),
          table: group[0].table,
          referencedColumns: group.map((key) => key.to),
          onDelete: group[0].on_delete,
        };
      });
      const byForeignKey = (left: { table: string; columns: string[] }, right: { table: string; columns: string[] }) =>
        JSON.stringify([left.table, left.columns]).localeCompare(JSON.stringify([right.table, right.columns]));
      expect(actualForeignKeys.sort(byForeignKey)).toEqual([...table.foreignKeys].sort(byForeignKey));

      const indexRows = db.prepare(`PRAGMA index_list("${escaped}")`).all() as Array<{
        name: string;
        unique: number;
        origin: string;
      }>;
      const actualUniqueConstraints = indexRows
        .filter((index) => index.origin === 'u')
        .map((index) => (db.prepare(`PRAGMA index_info("${index.name.replaceAll('"', '""')}")`).all() as Array<{ seqno: number; name: string }>).sort((left, right) => left.seqno - right.seqno).map((column) => column.name));
      expect(actualUniqueConstraints).toEqual(table.uniqueConstraints);
      const normalizeSql = (sql: string | null | undefined): string | null =>
        sql ? sql.replace(/\s+/g, ' ').trim().toLowerCase() : null;
      const actualIndexes = indexRows.filter((index) => index.origin === 'c').map((index) => ({
        name: index.name,
        columns: (db.prepare(`PRAGMA index_info("${index.name.replaceAll('"', '""')}")`).all() as Array<{ seqno: number; name: string }>).sort((left, right) => left.seqno - right.seqno).map((column) => column.name),
        unique: index.unique === 1,
        sql: normalizeSql((db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(index.name) as { sql?: string | null } | undefined)?.sql),
      })).sort((left, right) => left.name.localeCompare(right.name));
      const expectedIndexes = [...table.indexes].map((index) => ({
        ...index,
        sql: normalizeSql(index.sql),
      })).sort((left, right) => left.name.localeCompare(right.name));
      expect(actualIndexes).toEqual(expectedIndexes);
    }
    db.close();
  });

  it('captures rows with canonical keys and excludes local settings', () => {
    const db = database();
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('baseHours','40')").run();
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('annualFteMethod','year-average')").run();
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('hiddenEventTypes','[\"leave\"]')").run();
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('backupFolder','/private')").run();
    employee(db, 'Alice', 41);

    const records = captureRecords(db as never);
    expect(records.some((record) => record.table === 'settings' && record.key === '["baseHours"]')).toBe(true);
    expect(records.some((record) => record.table === 'settings' && record.key === '["annualFteMethod"]')).toBe(true);
    expect(records.some((record) => record.row.key === 'hiddenEventTypes')).toBe(false);
    expect(records.some((record) => record.row.key === 'backupFolder')).toBe(false);
    expect(records.find((record) => record.table === 'employees' && record.key === '[41]')).toMatchObject({
      row: { id: 41, name: 'Alice' },
    });

    db.close();
  });

  it('diffs composite keys without conflating rows', () => {
    const db = database();
    employee(db, 'Alice', 41);
    db.prepare("INSERT INTO patients(id,name) VALUES (7,'Client')").run();
    db.prepare("INSERT INTO audits(id,auditDate) VALUES (3,'2026-01-01')").run();
    db.prepare('INSERT INTO audit_clients(auditId,patientId) VALUES (3,7)').run();
    db.prepare("INSERT INTO patients(id,name) VALUES (8,'Other client')").run();
    const before = captureRecords(db as never);
    db.prepare('UPDATE audit_clients SET patientId=8 WHERE auditId=3 AND patientId=7').run();
    const after = captureRecords(db as never);
    const changes = diffRecords(before, after);

    expect(changes).toEqual([
      expect.objectContaining({ table: 'audit_clients', key: '[3,7]', before: expect.any(Object), after: null }),
      expect.objectContaining({ table: 'audit_clients', key: '[3,8]', before: null, after: expect.objectContaining({ auditId: 3, patientId: 8 }) }),
    ]);
    db.close();
  });

  it('applies parent and child records atomically while preserving untouched rows', () => {
    const db = database();
    employee(db, 'Untouched', 1);
    const changes: SyncChange[] = [
      {
        table: 'employment_periods',
        key: '[2]',
        before: null,
        after: { id: 2, employeeId: 2, startDate: '2026-01-01', endDate: null, qualification: 'PFK', note: null },
      },
      {
        table: 'employees',
        key: '[2]',
        before: null,
        after: { id: 2, name: 'Parent', note: null, weeklyHours: null, fte: 1, createdAt: null, birthDate: null, department: null },
      },
    ] as const;

    applyChanges(db as never, changes);
    expect(db.prepare('SELECT name FROM employees WHERE id=1').get()).toMatchObject({ name: 'Untouched' });
    expect(db.prepare('SELECT employeeId FROM employment_periods WHERE id=2').get()).toMatchObject({ employeeId: 2 });
    db.close();
  });

  it('rolls back the complete batch when deferred foreign keys fail', () => {
    const db = database();
    employee(db, 'Existing', 1);
    const before = db.serialize();
    expect(() =>
      applyChanges(db as never, [
        {
          table: 'employment_periods',
          key: '[99]',
          before: null,
          after: { id: 99, employeeId: 999, startDate: '2026-01-01', endDate: null, qualification: 'PFK', note: null },
        },
      ]),
    ).toThrow();
    expect(db.serialize()).toEqual(before);
    expect(db.prepare('SELECT COUNT(*) AS count FROM employment_periods').get()).toMatchObject({ count: 0 });
    db.close();
  });

  it('rebuilds server rows and restores local preferences', () => {
    const db = database();
    employee(db, 'Server employee', 71);
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('baseHours','42')").run();
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('hiddenEventTypes','[\"leave\"]')").run();
    const serverRecords = captureRecords(db as never).filter((record) => record.table === 'employees' || record.table === 'settings' && record.row.key === 'baseHours');
    const bytes = createSyncDatabase(serverRecords, captureLocalSettings(db as never));
    const rebuilt = new SqliteAdapter(bytes);

    expect(rebuilt.prepare('SELECT name FROM employees').all()).toEqual([
      expect.objectContaining({ name: 'Server employee' }),
    ]);
    expect(rebuilt.prepare('SELECT COUNT(*) AS count FROM qualification_types').get()).toMatchObject({ count: 0 });
    expect(rebuilt.prepare("SELECT value FROM settings WHERE key='baseHours'").get()).toMatchObject({ value: '42' });
    expect(rebuilt.prepare("SELECT value FROM settings WHERE key='hiddenEventTypes'").get()).toMatchObject({ value: '["leave"]' });
    expect(rebuilt.prepare("SELECT value FROM settings WHERE key='schema_version'").get()).toMatchObject({ value: String(CURRENT_SCHEMA_VERSION) });
    db.close();
    rebuilt.close();
  });

  it('preserves template origin and business review when rebuilding synced competencies', () => {
    const db = database();
    db.prepare(`INSERT INTO competency_definitions (name, templateKey, reviewStatus)
      VALUES (?, ?, ?)`).run('Örtliche Bezeichnung', 'hkp-nrw:032265', 'reviewed');
    const rebuilt = new SqliteAdapter(createSyncDatabase(captureRecords(db as never), {}));
    expect(rebuilt.prepare('SELECT name, templateKey, reviewStatus FROM competency_definitions WHERE templateKey = ?')
      .get('hkp-nrw:032265')).toEqual({
      name: 'Örtliche Bezeichnung', templateKey: 'hkp-nrw:032265', reviewStatus: 'reviewed',
    });
    db.close();
    rebuilt.close();
  });

  it('allocates disjoint device blocks for ordinary and history integer primary keys', () => {
    const first = database();
    const second = database();
    allocateDeviceIds(first as never, 11);
    allocateDeviceIds(second as never, 12);
    const firstEmployee = nextDeviceId(first as never, 'employees');
    const secondEmployee = nextDeviceId(second as never, 'employees');
    const firstHistory = nextDeviceId(first as never, 'employment_term_history');
    const secondHistory = nextDeviceId(second as never, 'employment_term_history');

    expect(firstEmployee).toBe(11 * 2 ** 32 + 1);
    expect(secondEmployee).toBe(12 * 2 ** 32 + 1);
    expect(firstHistory).toBe(11 * 2 ** 32 + 1);
    expect(secondHistory).toBe(12 * 2 ** 32 + 1);
    expect(new Set([firstEmployee, secondEmployee]).size).toBe(2);
    expect(new Set([firstHistory, secondHistory]).size).toBe(2);

    first.close();
    second.close();
  });

  it('keeps an existing legacy id and starts the device counter after it', () => {
    const db = database();
    employee(db, 'Legacy', 7);
    allocateDeviceIds(db as never, 0);
    expect(nextDeviceId(db as never, 'employees')).toBe(8);
    db.close();
  });

  it('restores consumed counters when a deleted maximum id is absent from a rebuild', () => {
    const db = database();
    allocateDeviceIds(db as never, 23);
    const first = nextDeviceId(db as never, 'employees');
    const deleted = nextDeviceId(db as never, 'employees');
    db.prepare('INSERT INTO employees(id,name,fte) VALUES (?,?,?)').run(first, 'Kept', 1);
    db.prepare('INSERT INTO employees(id,name,fte) VALUES (?,?,?)').run(deleted, 'Deleted', 1);
    db.prepare('DELETE FROM employees WHERE id=?').run(deleted);

    const counters = captureDeviceCounters(db as never);
    const rebuilt = new SqliteAdapter(createSyncDatabase(captureRecords(db as never), undefined, counters ?? undefined));
    allocateDeviceIds(rebuilt as never, 23);
    expect(nextDeviceId(rebuilt as never, 'employees')).toBe(23 * 2 ** 32 + 3);
    db.close();
    rebuilt.close();
  });

  it('rolls an allocated counter back with the surrounding write transaction', () => {
    const db = database();
    allocateDeviceIds(db as never, 24);
    expect(() =>
      db.transaction(() => {
        const id = nextDeviceId(db as never, 'employees');
        db.prepare('INSERT INTO employees(id,name,fte) VALUES (?,?,?)').run(id, 'Rolled back', 1);
        throw new Error('abort');
      })(),
    ).toThrow('abort');

    expect(nextDeviceId(db as never, 'employees')).toBe(24 * 2 ** 32 + 1);
    expect(db.prepare("SELECT 1 FROM employees WHERE name='Rolled back'").get()).toBeUndefined();
    db.close();
  });
});
