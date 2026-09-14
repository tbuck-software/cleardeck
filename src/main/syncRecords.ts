/**
 * SQLite change records used by the ClearDeck workspace synchronisation
 * protocol.
 *
 * The schema document is deliberately the only source of identifiers used to
 * build SQL below.  Table and column names arriving from the network are
 * validated against that document before a statement is prepared.
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import syncSchema from '../shared/syncSchema.json';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './database/migrations';

export type SyncValue = string | number | null;

/** A row in a local capture or in a change record. */
export type SyncRecord = {
  table: string;
  key: string;
  row: Record<string, SyncValue>;
};

/** A row transported by the server. A null row is a tombstone. */
export type SyncRow = {
  table: string;
  key: string;
  row: Record<string, SyncValue> | null;
  version: number;
};

export type SyncChange = {
  table: string;
  key: string;
  before: Record<string, SyncValue> | null;
  after: Record<string, SyncValue> | null;
};

type SchemaColumn = {
  name: string;
  type?: string;
  notNull?: boolean;
  default?: string | number | null;
};

type SchemaForeignKey = {
  columns: string[];
  table: string;
  referencedColumns: string[];
  onDelete?: string;
};

type SchemaIndex = {
  name: string;
  columns?: string[];
  unique?: boolean;
  sql?: string;
};

type SchemaTable = {
  name: string;
  columns: SchemaColumn[];
  primaryKey: string[];
  foreignKeys: SchemaForeignKey[];
  uniqueConstraints: string[][];
  indexes: SchemaIndex[];
  createSql?: string;
};

type SchemaDocument = {
  schemaVersion: number;
  tables: SchemaTable[];
  settings: {
    sharedKeys: string[];
    localKeys?: string[];
    localPrefixes?: string[];
  };
};

const document = syncSchema as SchemaDocument;
const tables = document.tables;
const tableByName = new Map<string, SchemaTable>(tables.map((table) => [table.name, table]));
const tableOrder = new Map<string, number>(tables.map((table, index) => [table.name, index]));
const sharedSettingKeys = new Set(document.settings.sharedKeys);
const localSettingKeys = new Set(document.settings.localKeys ?? []);
const localSettingPrefixes = document.settings.localPrefixes ?? [];

const ID_BLOCK_SIZE = 2 ** 32;
const MAX_DEVICE_SLOT = 1_000_000;
const MAX_COUNTER = ID_BLOCK_SIZE - 1;
const MAX_SAFE_SYNC_ID = Number.MAX_SAFE_INTEGER;
const MAX_KEY_LENGTH = 4096;
const ALLOCATOR_TABLE = '__cleardeck_sync_id_allocations';

const integerIdTables = tables.filter(
  (table) =>
    table.primaryKey.length === 1 &&
    table.columns.some(
      (column) => column.name === table.primaryKey[0] && /INT/i.test(column.type ?? ''),
    ),
);
const integerIdTableNames = new Set(integerIdTables.map((table) => table.name));

const own = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isSyncValue = (value: unknown): value is SyncValue =>
  value === null ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value));

const cloneRow = (row: Record<string, SyncValue>): Record<string, SyncValue> => ({ ...row });

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;

let savepointSequence = 0;

/**
 * Use an explicit savepoint so allocator calls compose with both
 * better-sqlite3 transactions and the small SQLite adapter used in tests.
 */
const withSavepoint = <T>(db: DatabaseType, operation: () => T): T => {
  const name = `cleardeck_sync_${++savepointSequence}`;
  db.exec(`SAVEPOINT ${name}`);
  try {
    const value = operation();
    db.exec(`RELEASE ${name}`);
    return value;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO ${name}`);
    } finally {
      db.exec(`RELEASE ${name}`);
    }
    throw error;
  }
};

const tableFor = (name: unknown): SchemaTable => {
  if (typeof name !== 'string') throw new Error('Ungültige Sync-Tabelle.');
  const table = tableByName.get(name);
  if (!table) throw new Error(`Unbekannte Sync-Tabelle: ${name}.`);
  return table;
};

const tableExists = (db: DatabaseType, table: SchemaTable): boolean =>
  Boolean(
    db
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?")
      .get(table.name),
  );

const assertSafeKeyValue = (value: unknown, table: SchemaTable): void => {
  if (!isSyncValue(value) || value === null) {
    throw new Error(`Ungültiger Primärschlüssel für ${table.name}.`);
  }
};

const keyValues = (key: unknown, table: SchemaTable): SyncValue[] => {
  if (typeof key !== 'string' || key.length < 2 || key.length > MAX_KEY_LENGTH)
    throw new Error(`Ungültiger Primärschlüssel für ${table.name}.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(key);
  } catch {
    throw new Error(`Ungültiger Primärschlüssel für ${table.name}.`);
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== table.primaryKey.length ||
    parsed.some((value) => !isSyncValue(value))
  )
    throw new Error(`Ungültiger Primärschlüssel für ${table.name}.`);
  parsed.forEach((value) => assertSafeKeyValue(value, table));
  return parsed;
};

const validateRow = (
  table: SchemaTable,
  value: unknown,
  path: string,
): Record<string, SyncValue> => {
  if (!isPlainObject(value)) throw new Error(`${path} muss ein Objekt sein.`);
  const row = value as Record<string, unknown>;
  const columns = new Set(table.columns.map((column) => column.name));
  for (const name of Object.keys(row)) {
    if (!columns.has(name)) throw new Error(`Unbekannte Spalte ${path}.${name}.`);
    if (!isSyncValue(row[name])) throw new Error(`Ungültiger Wert ${path}.${name}.`);
  }
  for (const column of table.columns) {
    if (!own(row, column.name)) throw new Error(`Fehlende Spalte ${path}.${column.name}.`);
  }
  const normalized: Record<string, SyncValue> = {};
  table.columns.forEach((column) => {
    normalized[column.name] = row[column.name] as SyncValue;
  });
  return normalized;
};

const keyForRow = (table: SchemaTable, row: Record<string, SyncValue>): string => {
  const values = table.primaryKey.map((column) => row[column]);
  values.forEach((value) => assertSafeKeyValue(value, table));
  return JSON.stringify(values);
};

const isInternalSetting = (key: string): boolean =>
  key === 'schema_version' || localSettingPrefixes.some((prefix) => key.startsWith(prefix));

const isSharedSetting = (key: unknown): key is string =>
  typeof key === 'string' && sharedSettingKeys.has(key);

const isLocalPreference = (key: unknown): key is string =>
  typeof key === 'string' && !isSharedSetting(key) && !isInternalSetting(key);

const isSyncableTableRow = (table: SchemaTable, row: Record<string, SyncValue>): boolean =>
  table.name !== 'settings' || isSharedSetting(row.key);

const normalizeCapturedRecord = (record: SyncRecord, index: number): SyncRecord | null => {
  const table = tableFor(record?.table);
  const row = validateRow(table, record?.row, `records[${index}].row`);
  const key = keyForRow(table, row);
  if (record.key !== key) throw new Error(`Primärschlüssel und Datensatz von ${table.name} stimmen nicht überein.`);
  if (!isSyncableTableRow(table, row)) return null;
  return { table: table.name, key, row };
};

const normalizeRecordInput = (value: unknown, index: number): SyncRecord | null => {
  if (!isPlainObject(value)) throw new Error(`records[${index}] muss ein Objekt sein.`);
  const input = value as Partial<SyncRecord> & { version?: unknown; row?: unknown };
  if (input.row === null) {
    const table = tableFor(input.table);
    const key = keyValues(input.key, table);
    if (table.name === 'settings' && !isSharedSetting(key[0])) return null;
    return null;
  }
  return normalizeCapturedRecord(input as SyncRecord, index);
};

const recordsMap = (records: readonly SyncRecord[] | readonly SyncRow[]): Map<string, SyncRecord> => {
  const result = new Map<string, SyncRecord>();
  records.forEach((record, index) => {
    const normalized = normalizeRecordInput(record, index);
    if (!normalized) return;
    const identity = `${normalized.table}\u0000${normalized.key}`;
    if (result.has(identity)) throw new Error(`Datensatz ${normalized.table}/${normalized.key} kommt doppelt vor.`);
    result.set(identity, normalized);
  });
  return result;
};

const rowsEqual = (
  table: SchemaTable,
  left: Record<string, SyncValue> | null,
  right: Record<string, SyncValue> | null,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return table.columns.every((column) => left[column.name] === right[column.name]);
};

/**
 * Capture the syncable rows from a migrated database.  `settings` is an
 * allow-list: unknown and local installation settings never enter the wire
 * protocol.
 */
export const captureRecords = (db: DatabaseType): SyncRecord[] => {
  const result: SyncRecord[] = [];
  for (const table of tables) {
    if (!tableExists(db, table)) continue;
    const rows = db.prepare(`SELECT * FROM ${quoteIdentifier(table.name)}`).all() as Array<
      Record<string, unknown>
    >;
    for (const raw of rows) {
      const row = validateRow(table, raw, `${table.name}.row`);
      if (!isSyncableTableRow(table, row)) continue;
      result.push({ table: table.name, key: keyForRow(table, row), row });
    }
  }
  result.sort((left, right) => {
    const tableDifference = (tableOrder.get(left.table) ?? 0) - (tableOrder.get(right.table) ?? 0);
    return tableDifference || left.key.localeCompare(right.key);
  });
  return result;
};

/**
 * Compare two complete captures and return one change per changed primary key.
 */
export const diffRecords = (
  before: readonly SyncRecord[],
  after: readonly SyncRecord[],
): SyncChange[] => {
  const previous = recordsMap(before);
  const next = recordsMap(after);
  const identities = new Set([...previous.keys(), ...next.keys()]);
  const changes: SyncChange[] = [];
  for (const identity of identities) {
    const oldRecord = previous.get(identity);
    const newRecord = next.get(identity);
    const table = tableFor(oldRecord?.table ?? newRecord?.table);
    const beforeRow = oldRecord?.row ?? null;
    const afterRow = newRecord?.row ?? null;
    if (rowsEqual(table, beforeRow, afterRow)) continue;
    changes.push({
      table: table.name,
      key: oldRecord?.key ?? newRecord!.key,
      before: beforeRow ? cloneRow(beforeRow) : null,
      after: afterRow ? cloneRow(afterRow) : null,
    });
  }
  changes.sort((left, right) => {
    const tableDifference = (tableOrder.get(left.table) ?? 0) - (tableOrder.get(right.table) ?? 0);
    return tableDifference || left.key.localeCompare(right.key);
  });
  return changes;
};

const normalizeChange = (change: unknown, index: number): SyncChange | null => {
  if (!isPlainObject(change)) throw new Error(`changes[${index}] muss ein Objekt sein.`);
  const input = change as Partial<SyncChange>;
  const table = tableFor(input.table);
  if (typeof input.key !== 'string') throw new Error(`Ungültiger Primärschlüssel für ${table.name}.`);
  const before = input.before === null ? null : validateRow(table, input.before, `changes[${index}].before`);
  const after = input.after === null ? null : validateRow(table, input.after, `changes[${index}].after`);
  keyValues(input.key, table);
  if (before && keyForRow(table, before) !== input.key)
    throw new Error(`Primärschlüssel und before-Datensatz von ${table.name} stimmen nicht überein.`);
  if (after && keyForRow(table, after) !== input.key)
    throw new Error(`Primärschlüssel und after-Datensatz von ${table.name} stimmen nicht überein.`);
  if (!before && !after) throw new Error(`Änderung ${index} ist leer.`);
  // Local settings are intentionally ignored at this boundary. They are
  // retained by createSyncDatabase's localSettings argument instead.
  if ((before && !isSyncableTableRow(table, before)) || (after && !isSyncableTableRow(table, after))) return null;
  return {
    table: table.name,
    key: input.key,
    before: before ? cloneRow(before) : null,
    after: after ? cloneRow(after) : null,
  };
};

const normalizeChanges = (changes: readonly SyncChange[]): SyncChange[] => {
  const result: SyncChange[] = [];
  const seen = new Set<string>();
  changes.forEach((change, index) => {
    const normalized = normalizeChange(change, index);
    if (!normalized) return;
    const identity = `${normalized.table}\u0000${normalized.key}`;
    if (seen.has(identity)) throw new Error(`Datensatz ${normalized.table}/${normalized.key} kommt doppelt vor.`);
    seen.add(identity);
    result.push(normalized);
  });
  return result;
};

const sortChanges = (changes: SyncChange[], deletes: boolean): SyncChange[] =>
  [...changes].sort((left, right) => {
    const leftOrder = tableOrder.get(left.table) ?? 0;
    const rightOrder = tableOrder.get(right.table) ?? 0;
    const tableDifference = (deletes ? rightOrder - leftOrder : leftOrder - rightOrder);
    return tableDifference || left.key.localeCompare(right.key);
  });

const rowValues = (table: SchemaTable, row: Record<string, SyncValue>): SyncValue[] =>
  table.columns.map((column) => row[column.name]);

const changeStatements = (table: SchemaTable) => {
  const tableName = quoteIdentifier(table.name);
  const columns = table.columns.map((column) => quoteIdentifier(column.name));
  const placeholders = table.columns.map(() => '?').join(', ');
  const primaryKey = table.primaryKey.map(quoteIdentifier).join(', ');
  const mutableColumns = table.columns.filter((column) => !table.primaryKey.includes(column.name));
  const insert = mutableColumns.length
    ? `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${primaryKey}) DO UPDATE SET ${mutableColumns
        .map((column) => `${quoteIdentifier(column.name)}=excluded.${quoteIdentifier(column.name)}`)
        .join(', ')}`
    : `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  const where = table.primaryKey.map((column) => `${quoteIdentifier(column)}=?`).join(' AND ');
  return {
    insert: (db: DatabaseType) => db.prepare(insert),
    delete: (db: DatabaseType) => db.prepare(`DELETE FROM ${tableName} WHERE ${where}`),
  };
};

/**
 * Apply a batch as one SQLite transaction. Foreign keys are deferred for the
 * batch, which permits a parent and its children to arrive in either order;
 * SQLite still checks the final graph before commit. Untouched keys are never
 * read-modify-written or deleted.
 */
export const applyChanges = (db: DatabaseType, changes: readonly SyncChange[]): void => {
  const normalized = normalizeChanges(changes);
  if (!normalized.length) return;
  for (const change of normalized) {
    const table = tableFor(change.table);
    if (!tableExists(db, table)) throw new Error(`Sync-Tabelle fehlt in der Datenbank: ${table.name}.`);
  }

  db.pragma('foreign_keys = ON');
  const apply = db.transaction(() => {
    db.pragma('defer_foreign_keys = ON');
    const deletions = sortChanges(normalized.filter((change) => change.after === null), true);
    const upserts = sortChanges(normalized.filter((change) => change.after !== null), false);
    for (const change of deletions) {
      const table = tableFor(change.table);
      changeStatements(table).delete(db).run(...keyValues(change.key, table));
    }
    for (const change of upserts) {
      const table = tableFor(change.table);
      const row = change.after!;
      changeStatements(table).insert(db).run(...rowValues(table, row));
    }
    const violations = db.pragma('foreign_key_check') as unknown;
    if (Array.isArray(violations) && violations.length)
      throw new Error('Die Synchronisationsänderung erzeugt ungültige Verknüpfungen.');
  });
  apply();
};

const clearSyncRows = (db: DatabaseType): void => {
  const clear = db.transaction(() => {
    db.pragma('defer_foreign_keys = ON');
    // Children first keeps this valid even on databases whose FK actions were
    // tightened by a later migration. The schema table order is parent-first.
    for (const table of [...tables].reverse()) {
      if (!tableExists(db, table)) continue;
      if (table.name === 'settings') {
        if (!document.settings.sharedKeys.length) continue;
        const placeholders = document.settings.sharedKeys.map(() => '?').join(',');
        db.prepare(
          `DELETE FROM ${quoteIdentifier(table.name)} WHERE ${quoteIdentifier('key')} IN (${placeholders})`,
        ).run(...document.settings.sharedKeys);
      } else {
        db.prepare(`DELETE FROM ${quoteIdentifier(table.name)}`).run();
      }
    }
    // Fresh migrations create sqlite_sequence for AUTOINCREMENT tables. It is
    // metadata rather than a user row and must not bias the first local ID.
    if (tableExists(db, { name: 'sqlite_sequence' } as SchemaTable)) {
      db.prepare('DELETE FROM "sqlite_sequence"').run();
    }
  });
  clear();
};

const localSettingsObject = (value: unknown): Record<string, string | null> => {
  if (value === undefined) return {};
  if (!isPlainObject(value)) throw new Error('Lokale Einstellungen müssen ein Objekt sein.');
  const result: Record<string, string | null> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (!isLocalPreference(key)) continue;
    if (setting !== null && typeof setting !== 'string')
      throw new Error(`Ungültiger Wert für lokale Einstellung ${key}.`);
    result[key] = setting as string | null;
  }
  return result;
};

/**
 * Build a migrated SQLite database from the server's complete row set. Local
 * view and backup preferences are restored from the optional second argument;
 * schema_version and migration markers are always owned by the migrations.
 */
export const createSyncDatabase = (
  records: readonly SyncRow[] | readonly SyncRecord[],
  localSettings?: Record<string, string | null>,
  deviceCounters?: DeviceIdCounterState,
): Buffer => {
  const candidate = new Database(':memory:');
  try {
    candidate.pragma('foreign_keys = ON');
    runMigrations(candidate);
    if (CURRENT_SCHEMA_VERSION !== document.schemaVersion)
      throw new Error('Sync-Schema und Datenbankschema haben unterschiedliche Versionen.');
    clearSyncRows(candidate);
    const changes: SyncChange[] = [];
    const seen = new Set<string>();
    records.forEach((record, index) => {
      const normalized = normalizeRecordInput(record, index);
      if (!normalized) return;
      const identity = `${normalized.table}\u0000${normalized.key}`;
      if (seen.has(identity)) throw new Error(`Datensatz ${normalized.table}/${normalized.key} kommt doppelt vor.`);
      seen.add(identity);
      changes.push({ table: normalized.table, key: normalized.key, before: null, after: normalized.row });
    });
    applyChanges(candidate, changes);
    if (deviceCounters) allocateDeviceIds(candidate, deviceCounters.deviceSlot, deviceCounters);
    restoreLocalSettings(candidate, localSettingsObject(localSettings));
    return Buffer.from(candidate.serialize());
  } finally {
    candidate.close();
  }
};

/** Capture only settings that belong to this installation's local UI/storage. */
export const captureLocalSettings = (db: DatabaseType): Record<string, string | null> => {
  const table = tableFor('settings');
  if (!tableExists(db, table)) return {};
  const result: Record<string, string | null> = {};
  const rows = db.prepare('SELECT "key", "value" FROM "settings"').all() as Array<{
    key: unknown;
    value: unknown;
  }>;
  for (const row of rows) {
    if (!isLocalPreference(row.key)) continue;
    if (row.value !== null && typeof row.value !== 'string') continue;
    result[row.key] = row.value as string | null;
  }
  return result;
};

const restoreLocalSettings = (
  db: DatabaseType,
  settings: Record<string, string | null>,
): void => {
  const table = tableFor('settings');
  if (!Object.keys(settings).length || !tableExists(db, table)) return;
  const restore = db.transaction(() => {
    const statement = db.prepare(
      'INSERT OR REPLACE INTO "settings" ("key", "value") VALUES (?, ?)',
    );
    for (const [key, value] of Object.entries(settings)) {
      if (isLocalPreference(key)) statement.run(key, value);
    }
  });
  restore();
};

const ensureAllocatorTable = (db: DatabaseType): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${ALLOCATOR_TABLE}" (
      tableName TEXT PRIMARY KEY,
      deviceSlot INTEGER NOT NULL,
      counter INTEGER NOT NULL CHECK(counter >= 0 AND counter <= ${MAX_COUNTER})
    )
  `);
};

const validateDeviceSlot = (deviceSlot: number): void => {
  if (!Number.isSafeInteger(deviceSlot) || deviceSlot < 0 || deviceSlot > MAX_DEVICE_SLOT)
    throw new Error(`Ungültiger Geräteslot: ${deviceSlot}.`);
};

const observedCounter = (db: DatabaseType, table: SchemaTable, deviceSlot: number): number => {
  if (!tableExists(db, table)) return 0;
  const base = deviceSlot * ID_BLOCK_SIZE;
  const rows = db.prepare(`SELECT ${quoteIdentifier(table.primaryKey[0])} AS id FROM ${quoteIdentifier(table.name)}`).all() as Array<{ id: unknown }>;
  let highest = 0;
  for (const row of rows) {
    if (typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id < 0)
      throw new Error(`Ungültige ID in ${table.name}.`);
    if (row.id >= base && row.id <= base + MAX_COUNTER) highest = Math.max(highest, row.id - base);
  }
  return highest;
};

const allocatorRow = (db: DatabaseType, table: SchemaTable) =>
  db
    .prepare(`SELECT tableName, deviceSlot, counter FROM "${ALLOCATOR_TABLE}" WHERE tableName=?`)
    .get(table.name) as { tableName: string; deviceSlot: number; counter: number } | undefined;

/**
 * Initialise the per-device ID allocator. The returned function can be used
 * by repository INSERT paths; calling this function alone never changes an
 * existing row or renumbers a legacy database.
 */
export type DeviceIdAllocator = {
  deviceSlot: number;
  next: (table: string) => number;
};

/** Durable allocator state that must survive a full server-state rebuild. */
export type DeviceIdCounterState = {
  deviceSlot: number;
  counters: Record<string, number>;
};

const allocatorTableExists = (db: DatabaseType): boolean =>
  Boolean(
    db
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?")
      .get(ALLOCATOR_TABLE),
  );

const validateCounter = (value: unknown, tableName: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > MAX_COUNTER)
    throw new Error(`Ungültiger ID-Zähler für ${tableName}.`);
  return value as number;
};

/**
 * Read allocator metadata without creating or changing anything in the DB.
 * A missing table means this is an old/local database that has never allocated
 * a device ID yet; its existing IDs are still observed when setup happens.
 */
export const captureDeviceCounters = (db: DatabaseType): DeviceIdCounterState | null => {
  if (!allocatorTableExists(db)) return null;
  const rows = db
    .prepare(`SELECT tableName, deviceSlot, counter FROM "${ALLOCATOR_TABLE}"`)
    .all() as Array<{ tableName: unknown; deviceSlot: unknown; counter: unknown }>;
  if (!rows.length) return null;
  let deviceSlot: number | undefined;
  const counters: Record<string, number> = {};
  for (const row of rows) {
    const table = tableFor(row.tableName);
    validateDeviceSlot(row.deviceSlot as number);
    if (deviceSlot === undefined) deviceSlot = row.deviceSlot as number;
    if (deviceSlot !== row.deviceSlot)
      throw new Error('Die Datenbank enthält mehrere Geräteslots.');
    counters[table.name] = validateCounter(row.counter, table.name);
  }
  return deviceSlot === undefined ? null : { deviceSlot, counters };
};

type PreservedDeviceCounters = DeviceIdCounterState | Readonly<Record<string, number>>;

const isCounterState = (value: PreservedDeviceCounters): value is DeviceIdCounterState =>
  own(value, 'counters') &&
  isPlainObject((value as { counters?: unknown }).counters);

const preservedCounterFor = (
  preserved: PreservedDeviceCounters | undefined,
  table: SchemaTable,
): number => {
  if (!preserved) return 0;
  const counters = isCounterState(preserved) ? preserved.counters : preserved;
  const value = counters[table.name];
  return value === undefined ? 0 : validateCounter(value, table.name);
};

export const allocateDeviceIds = (
  db: DatabaseType,
  deviceSlot: number,
  preserved?: PreservedDeviceCounters,
): DeviceIdAllocator => {
  validateDeviceSlot(deviceSlot);
  if (preserved && isCounterState(preserved)) validateDeviceSlot(preserved.deviceSlot);
  const setup = () => withSavepoint(db, () => {
    ensureAllocatorTable(db);
    for (const table of integerIdTables) {
      const existing = allocatorRow(db, table);
      if (existing && existing.deviceSlot !== deviceSlot && existing.deviceSlot !== 0)
        throw new Error(`Die Datenbank ist bereits dem Geräteslot ${existing.deviceSlot} zugeordnet.`);
      const counter = Math.max(
        existing?.counter ?? 0,
        preservedCounterFor(preserved, table),
        observedCounter(db, table, deviceSlot),
      );
      if (!Number.isSafeInteger(counter) || counter > MAX_COUNTER)
        throw new Error(`Keine freien IDs mehr für ${table.name}.`);
      if (existing) {
        db.prepare(`UPDATE "${ALLOCATOR_TABLE}" SET deviceSlot=?,counter=? WHERE tableName=?`).run(
          deviceSlot,
          counter,
          table.name,
        );
      } else {
        db.prepare(`INSERT INTO "${ALLOCATOR_TABLE}" (tableName,deviceSlot,counter) VALUES (?,?,?)`).run(table.name, deviceSlot, counter);
      }
    }
  });
  setup();
  return { deviceSlot, next: (table: string): number => nextDeviceId(db, table, deviceSlot) };
};

/** Allocate one collision-free ID for an integer-primary-key table. */
export const nextDeviceId = (
  db: DatabaseType,
  tableName: string,
  expectedDeviceSlot?: number,
): number => {
  const table = tableFor(tableName);
  if (!integerIdTableNames.has(table.name))
    throw new Error(`Tabelle ${table.name} besitzt keine einfache Integer-ID.`);
  if (expectedDeviceSlot !== undefined) validateDeviceSlot(expectedDeviceSlot);
  // A normal local database may predate server sync and therefore have no
  // allocator metadata yet. Slot zero is the reserved local-only slot; once
  // the server assigns a device slot, allocateDeviceIds rebinds this metadata
  // without touching any legacy rows.
  if (!allocatorTableExists(db)) allocateDeviceIds(db, 0);
  else ensureAllocatorTable(db);
  const row = allocatorRow(db, table);
  if (!row) throw new Error('Die Geräte-ID-Vergabe wurde noch nicht eingerichtet.');
  if (expectedDeviceSlot !== undefined && row.deviceSlot !== expectedDeviceSlot)
    throw new Error(`Die Datenbank ist dem Geräteslot ${row.deviceSlot} zugeordnet.`);
  const slot = row.deviceSlot;
  const base = slot * ID_BLOCK_SIZE;
  const allocate = () => withSavepoint(db, () => {
    const current = allocatorRow(db, table);
    if (!current) throw new Error('Die Geräte-ID-Vergabe wurde noch nicht eingerichtet.');
    const counter = Math.max(current.counter, observedCounter(db, table, slot)) + 1;
    if (!Number.isSafeInteger(counter) || counter > MAX_COUNTER)
      throw new Error(`Keine freien IDs mehr für ${table.name}.`);
    db.prepare(`UPDATE "${ALLOCATOR_TABLE}" SET counter=? WHERE tableName=?`).run(counter, table.name);
    const id = base + counter;
    if (!Number.isSafeInteger(id) || id > MAX_SAFE_SYNC_ID)
      throw new Error(`Die Geräte-ID für ${table.name} ist außerhalb des sicheren Zahlenbereichs.`);
    return id;
  });
  return allocate();
};

export const SYNC_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
export const SYNC_TABLES = tables.map((table) => table.name);
export const SYNC_SHARED_SETTINGS_KEYS = [...sharedSettingKeys];
export const SYNC_LOCAL_SETTINGS_KEYS = [...localSettingKeys];
