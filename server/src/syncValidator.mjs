import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The generated SQLite schema is the protocol's allow-list. */

export class SyncValidationError extends Error {
  constructor(message, details = undefined, status = 400) {
    super(message);
    this.name = 'SyncValidationError';
    this.status = status;
    this.details = details;
  }
}

const fail = (message, details, status = 400) => { throw new SyncValidationError(message, details, status); };
const stateFail = (message, details = undefined) => fail(message, details, 422);
const clone = (value) => JSON.parse(JSON.stringify(value));
const isPlainObject = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function digestTransaction(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export const isUuid = (value) => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const parseDefault = (raw) => {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') return raw;
  const value = raw.trim();
  if (/^null$/i.test(value)) return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?(?:\d+\.\d*|\d*\.\d+)$/.test(value)) return Number(value);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return undefined;
};

const typeAffinity = (value) => {
  const type = String(value ?? '').toUpperCase();
  if (type.includes('INT')) return 'INTEGER';
  if (type.includes('CHAR') || type.includes('CLOB') || type.includes('TEXT')) return 'TEXT';
  if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB')) return 'REAL';
  if (type.includes('BLOB')) return 'BLOB';
  return type || 'TEXT';
};

function loadSchema() {
  const candidates = [
    fileURLToPath(new URL('../../src/shared/syncSchema.json', import.meta.url)),
    fileURLToPath(new URL('./syncSchema.json', import.meta.url)),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error('src/shared/syncSchema.json fehlt; der Server wird nicht gestartet.');
  let document;
  try { document = JSON.parse(readFileSync(path, 'utf8')); } catch (error) {
    throw new Error(`syncSchema.json ist ungültig: ${error.message}`);
  }
  if (document?.schemaVersion !== 23 || !Array.isArray(document.tables) ||
      !document.settings || !Array.isArray(document.settings.sharedKeys)) {
    throw new Error('syncSchema.json hat nicht das erwartete Schemaformat.');
  }
  const tables = new Map();
  for (const raw of document.tables) {
    if (!isPlainObject(raw) || typeof raw.name !== 'string' || tables.has(raw.name) ||
        !Array.isArray(raw.columns) || !Array.isArray(raw.primaryKey) || raw.primaryKey.length < 1 ||
        !Array.isArray(raw.foreignKeys) || !Array.isArray(raw.uniqueConstraints) || !Array.isArray(raw.indexes)) {
      throw new Error('syncSchema.json enthält eine ungültige Tabellendefinition.');
    }
    const columns = raw.columns.map((column) => {
      if (!isPlainObject(column) || typeof column.name !== 'string' || typeof column.type !== 'string') {
        throw new Error(`syncSchema.json enthält eine ungültige Spaltendefinition in ${raw.name}.`);
      }
      return {
        name: column.name,
        type: typeAffinity(column.type),
        notNull: Boolean(column.notNull),
        defaultValue: parseDefault(column.default),
      };
    });
    const names = new Set(columns.map((column) => column.name));
    if (columns.length !== names.size || raw.primaryKey.some((key) => !names.has(key))) {
      throw new Error(`syncSchema.json enthält ungültige Schlüssel in ${raw.name}.`);
    }
    const unique = raw.uniqueConstraints.map((constraint) => {
      if (!Array.isArray(constraint) || !constraint.length || constraint.some((column) => !names.has(column))) {
        throw new Error(`syncSchema.json enthält eine ungültige Eindeutigkeitsbedingung in ${raw.name}.`);
      }
      return { columns: constraint, caseInsensitive: false };
    });
    for (const index of raw.indexes) if (index.unique) {
      if (!isPlainObject(index) || !Array.isArray(index.columns) || !index.columns.length || index.columns.some((column) => !names.has(column))) {
        throw new Error(`syncSchema.json enthält einen ungültigen eindeutigen Index in ${raw.name}.`);
      }
      unique.push({ columns: index.columns, caseInsensitive: /COLLATE\s+NOCASE/i.test(index.sql ?? '') });
    }
    const foreignKeys = raw.foreignKeys.map((foreignKey) => {
      if (!isPlainObject(foreignKey) || !Array.isArray(foreignKey.columns) || !foreignKey.columns.length ||
          typeof foreignKey.table !== 'string' || !Array.isArray(foreignKey.referencedColumns) ||
          foreignKey.columns.length !== foreignKey.referencedColumns.length || foreignKey.columns.some((column) => !names.has(column))) {
        throw new Error(`syncSchema.json enthält einen ungültigen Fremdschlüssel in ${raw.name}.`);
      }
      return {
        columns: foreignKey.columns,
        table: foreignKey.table,
        referencedColumns: foreignKey.referencedColumns,
        onDelete: String(foreignKey.onDelete ?? '').toUpperCase(),
      };
    });
    tables.set(raw.name, {
      name: raw.name,
      columns,
      byName: new Map(columns.map((column) => [column.name, column])),
      primaryKey: raw.primaryKey,
      foreignKeys,
      unique,
    });
  }
  for (const table of tables.values()) {
    for (const foreignKey of table.foreignKeys) {
      const target = tables.get(foreignKey.table);
      if (!target || foreignKey.referencedColumns.some((column) => !target.byName.has(column))) {
        throw new Error(`syncSchema.json enthält einen Verweis auf eine unbekannte Tabelle oder Spalte: ${table.name}.`);
      }
    }
  }
  if (!tables.has('settings') || document.settings.sharedKeys.some((key) => typeof key !== 'string')) {
    throw new Error('syncSchema.json enthält keine gültige settings-Definition.');
  }
  return { version: document.schemaVersion, settings: document.settings, tables };
}

export const schema = loadSchema();

const ensureJsonValue = (value, path) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`Ungültiger Zahlenwert in ${path}.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => ensureJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, item]) => ensureJsonValue(item, `${path}.${key}`));
    return;
  }
  fail(`Ungültiger JSON-Wert in ${path}.`);
};

const validateType = (value, column, path) => {
  if (value === null) {
    if (column.notNull) fail(`${path} darf nicht leer sein.`);
    return;
  }
  if (column.type === 'INTEGER' && (typeof value !== 'number' || !Number.isSafeInteger(value))) fail(`${path} muss eine ganze Zahl sein.`);
  else if (column.type === 'REAL' && (typeof value !== 'number' || !Number.isFinite(value))) fail(`${path} muss eine Zahl sein.`);
  else if (column.type === 'BLOB') fail(`${path} darf nicht als JSON-Datensatz synchronisiert werden.`);
  else if (column.type === 'TEXT' && typeof value !== 'string') fail(`${path} muss Text sein.`);
};

const validateRow = (table, row, path) => {
  if (!isPlainObject(row)) fail(`${path} muss ein Objekt sein.`);
  for (const key of Object.keys(row)) if (!table.byName.has(key)) fail(`Unbekannte Spalte ${path}.${key}.`);
  const normalized = {};
  for (const column of table.columns) {
    if (Object.prototype.hasOwnProperty.call(row, column.name)) {
      validateType(row[column.name], column, `${path}.${column.name}`);
      ensureJsonValue(row[column.name], `${path}.${column.name}`);
      normalized[column.name] = clone(row[column.name]);
    } else {
      fail(`Fehlende Spalte ${path}.${column.name}.`);
    }
  }
  if (table.name === 'settings' && !schema.settings.sharedKeys.includes(normalized.key)) {
    fail('Dieser Einstellungswert darf nicht synchronisiert werden.');
  }
  return normalized;
};

const keyForRow = (table, row) => JSON.stringify(table.primaryKey.map((column) => row[column]));

export function validateKey(tableName, key, row = null) {
  const table = schema.tables.get(tableName);
  if (!table) fail(`Unbekannte Tabelle ${tableName}.`);
  if (typeof key !== 'string' || key.length < 2 || key.length > 4096) fail('Ungültiger Primärschlüssel.');
  let parsed;
  try { parsed = JSON.parse(key); } catch { fail('Ungültiger Primärschlüssel.'); }
  if (!Array.isArray(parsed) || parsed.length !== table.primaryKey.length || parsed.some((value) => value === undefined)) {
    fail(`Primärschlüssel für ${tableName} hat die falsche Form.`);
  }
  if (parsed.some((value) => value === null || typeof value === 'object' || typeof value === 'boolean')) fail('Primärschlüssel darf keine leeren oder zusammengesetzten Werte enthalten.');
  if (JSON.stringify(parsed) !== key) fail('Primärschlüssel muss kanonisches JSON sein.');
  table.primaryKey.forEach((columnName, index) => {
    const column = table.byName.get(columnName);
    const value = parsed[index];
    if (column.type === 'INTEGER' && (typeof value !== 'number' || !Number.isSafeInteger(value))) {
      fail(`Primärschlüssel ${tableName}.${columnName} muss eine ganze Zahl sein.`);
    }
    if (column.type === 'REAL' && (typeof value !== 'number' || !Number.isFinite(value))) {
      fail(`Primärschlüssel ${tableName}.${columnName} muss eine Zahl sein.`);
    }
    if (column.type === 'TEXT' && typeof value !== 'string') {
      fail(`Primärschlüssel ${tableName}.${columnName} muss Text sein.`);
    }
  });
  if (row && key !== keyForRow(table, row)) fail(`Primärschlüssel und Datensatz von ${tableName} stimmen nicht überein.`);
  return parsed;
}

export function validateTransactionPayload(payload, limits = {}) {
  if (!isPlainObject(payload)) fail('Die Transaktion muss ein Objekt sein.');
  const expected = new Set(['id', 'instanceId', 'initialize', 'changes']);
  for (const key of Object.keys(payload)) if (!expected.has(key)) fail(`Unbekanntes Transaktionsfeld ${key}.`);
  if (!isUuid(payload.id) || !isUuid(payload.instanceId)) fail('Transaktions- oder Instanz-ID ist ungültig.');
  if (typeof payload.initialize !== 'boolean') fail('initialize muss boolesch sein.');
  if (!Array.isArray(payload.changes) || payload.changes.length < 1) fail('Eine Transaktion braucht mindestens eine Änderung.');
  const maxChanges = limits.maxChanges ?? 10000;
  if (payload.changes.length > maxChanges) fail('Zu viele Änderungen in einer Transaktion.');
  const changes = [];
  const seen = new Set();
  payload.changes.forEach((change, index) => {
    if (!isPlainObject(change)) fail(`Änderung ${index} muss ein Objekt sein.`);
    const keys = Object.keys(change);
    if (keys.length !== 4 || !['table', 'key', 'before', 'after'].every((key) => keys.includes(key))) fail(`Ungültige Felder in Änderung ${index}.`);
    if (typeof change.table !== 'string' || change.table.length < 1 || change.table.length > 128) fail(`Ungültige Tabelle in Änderung ${index}.`);
    const table = schema.tables.get(change.table);
    if (!table) fail(`Unbekannte Tabelle ${change.table}.`);
    if (typeof change.key !== 'string') fail(`Ungültiger Schlüssel in Änderung ${index}.`);
    const identity = `${change.table}\u0000${change.key}`;
    if (seen.has(identity)) fail(`Datensatz ${change.table}/${change.key} kommt doppelt vor.`);
    seen.add(identity);
    let before = null;
    let after = null;
    if (change.before !== null) {
      before = validateRow(table, change.before, `changes[${index}].before`);
      validateKey(change.table, change.key, before);
    } else validateKey(change.table, change.key);
    if (change.after !== null) {
      after = validateRow(table, change.after, `changes[${index}].after`);
      validateKey(change.table, change.key, after);
    } else validateKey(change.table, change.key);
    if (before === null && after === null) fail(`Leere Änderung ${index}.`);
    changes.push({ table: change.table, key: change.key, before, after });
  });
  return { id: payload.id, instanceId: payload.instanceId, initialize: payload.initialize, changes };
}

export function createState(rows = []) {
  const state = new Map([...schema.tables.keys()].map((name) => [name, new Map()]));
  for (const record of rows) {
    if (record.rowData == null) continue;
    const table = schema.tables.get(record.tableName);
    if (!table) fail(`Unbekannte Tabelle ${record.tableName}.`);
    const row = validateRow(table, record.rowData, `${record.tableName}/${record.key}`);
    validateKey(record.tableName, record.key, row);
    state.get(record.tableName).set(record.key, row);
  }
  return state;
}

const valueEqual = (left, right) => canonicalJson(left) === canonicalJson(right);
const isoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function validateDomains(state) {
  const dateFields = new Map([
    ['employees', ['birthDate']],
    ['employment_periods', ['startDate', 'endDate']],
    ['employment_terms', ['effectiveFrom']],
    ['employment_term_history', ['effectiveFrom']],
    ['employee_events', ['eventDate', 'expiresAt']],
    ['employee_instructions', ['dueDate', 'completedAt']],
    ['patients', ['birthDate', 'admissionDate', 'serviceEndDate', 'assessmentDate', 'phkpStartDate']],
    ['patient_visits', ['visitDate', 'resolvedAt', 'actionDueDate']],
    ['audits', ['auditDate']],
  ]);
  for (const [tableName, fields] of dateFields) {
    for (const row of state.get(tableName)?.values() ?? []) {
      for (const field of fields) {
        if (row[field] !== null && row[field] !== undefined && !isoDate(row[field])) {
          stateFail(`${tableName}.${field} enthält kein gültiges Datum.`);
        }
      }
    }
  }

  for (const row of state.get('employees')?.values() ?? []) {
    if (row.fte !== null && (row.fte < 0 || row.fte > 1)) stateFail('Der Beschäftigungsumfang muss zwischen 0 und 1 liegen.');
    if (row.weeklyHours !== null && row.weeklyHours < 0) stateFail('Wochenstunden dürfen nicht negativ sein.');
  }
  for (const row of state.get('employment_periods')?.values() ?? []) {
    if (row.endDate !== null && row.startDate > row.endDate) stateFail('Ein Beschäftigungszeitraum endet vor seinem Beginn.');
  }

  // Existing workbooks can contain overlapping periods; those rows are kept
  // intact during migration, but a new resulting state may not introduce one.
  const periodsByEmployee = new Map();
  for (const row of state.get('employment_periods')?.values() ?? []) {
    const periods = periodsByEmployee.get(row.employeeId) ?? [];
    periods.push(row);
    periodsByEmployee.set(row.employeeId, periods);
  }
  for (const periods of periodsByEmployee.values()) {
    periods.sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id - right.id);
    for (let index = 1; index < periods.length; index += 1) {
      const previous = periods[index - 1];
      if (previous.endDate === null || previous.endDate >= periods[index].startDate) {
        stateFail('Beschäftigungszeiträume dürfen sich nicht überschneiden.');
      }
    }
  }

  // Current terms must fit their period. History records are immutable
  // evidence and may legitimately outlive a later period correction.
  for (const row of state.get('employment_terms')?.values() ?? []) {
    if (row.fte !== null && row.fte !== undefined && (row.fte < 0 || row.fte > 1)) stateFail('Der Beschäftigungsumfang muss zwischen 0 und 1 liegen.');
    if (row.weeklyHours !== null && row.weeklyHours !== undefined && row.weeklyHours < 0) stateFail('Wochenstunden dürfen nicht negativ sein.');
    const period = state.get('employment_periods')?.get(JSON.stringify([row.periodId]));
    if (period && (row.effectiveFrom < period.startDate || (period.endDate !== null && row.effectiveFrom > period.endDate))) {
      stateFail('Arbeitszeitstände müssen innerhalb des Beschäftigungszeitraums liegen.');
    }
  }
  for (const row of state.get('employment_term_history')?.values() ?? []) {
    if (row.fte !== null && row.fte !== undefined && (row.fte < 0 || row.fte > 1)) stateFail('Der Beschäftigungsumfang muss zwischen 0 und 1 liegen.');
    if (row.weeklyHours !== null && row.weeklyHours !== undefined && row.weeklyHours < 0) stateFail('Wochenstunden dürfen nicht negativ sein.');
  }

  for (const row of state.get('patient_visits')?.values() ?? []) {
    if (![0, 1].includes(row.actionNeeded)) stateFail('actionNeeded muss 0 oder 1 sein.');
    if (!['planned', 'completed'].includes(row.status)) stateFail('Ungültiger Visitenstatus.');
    if (row.resolvedAt !== null && row.resolvedAt < row.visitDate) stateFail('Eine Visite kann nicht vor ihrem Besuchsdatum erledigt sein.');
  }
  for (const row of state.get('instruction_definitions')?.values() ?? []) {
    if (row.intervalSource !== null && !['norm', 'betrieblich'].includes(row.intervalSource)) stateFail('Ungültige Quelle des Unterweisungsintervalls.');
    if (![0, 1].includes(row.minorHazardInstruction)) stateFail('minorHazardInstruction muss 0 oder 1 sein.');
  }
  for (const row of state.get('employee_instructions')?.values() ?? []) {
    if (![0, 1].includes(row.scheduleReviewRequired)) stateFail('scheduleReviewRequired muss 0 oder 1 sein.');
  }
  for (const row of state.get('employee_competencies')?.values() ?? []) {
    if (!['open', 'in-progress', 'completed'].includes(row.status)) stateFail('Ungültiger Kompetenzstatus.');
    if (row.stageScheme !== null && !['legacy', 'practice-v1'].includes(row.stageScheme)) stateFail('Ungültiges Kompetenzmodell.');
    const maxLevel = row.stageScheme === 'practice-v1' ? 6 : 5;
    if (row.level !== null && (!Number.isSafeInteger(row.level) || row.level < 0 || row.level > maxLevel)) stateFail('Ungültige Kompetenzstufe.');
    if (row.stageScheme === 'practice-v1' && row.level === 6 && (row.approvedAt === null || row.approvedBy === null || row.approvedBy.trim() === '')) {
      stateFail('Abschluss braucht Bestätigungsdatum und verantwortliche Person.');
    }
  }
  for (const row of state.get('competency_history')?.values() ?? []) {
    if (row.stageScheme !== null && !['legacy', 'practice-v1'].includes(row.stageScheme)) stateFail('Ungültiges Kompetenzmodell.');
    const maxLevel = row.stageScheme === 'practice-v1' ? 6 : 5;
    if (row.level !== null && (!Number.isSafeInteger(row.level) || row.level < 0 || row.level > maxLevel)) stateFail('Ungültige Kompetenzstufe.');
  }
  for (const row of state.get('service_definitions')?.values() ?? []) {
    if (![0, 1].includes(row.active)) stateFail('active muss 0 oder 1 sein.');
    if (!['s36-care', 's36-support', 's39-prevention', 's37-hkp', 's37c-aki', 'household', 'relief', 's37-consultation'].includes(row.serviceType)) stateFail('Ungültiger Versorgungstyp.');
  }
  for (const row of state.get('audits')?.values() ?? []) {
    if (row.kind !== null && !['regel', 'anlass'].includes(row.kind)) stateFail('Ungültige Prüfungsart.');
    if (![0, 1].includes(row.confirmed)) stateFail('confirmed muss 0 oder 1 sein.');
  }
  for (const row of state.get('audit_results')?.values() ?? []) {
    if (!['A', 'B', 'C', 'D', 'text', 'ok', 'no'].includes(row.result)) stateFail('Ungültiges Prüfergebnis.');
  }
  for (const row of state.get('patients')?.values() ?? []) {
    if (row.qprStatus !== null && !['A', 'B', 'C', 'D'].includes(row.qprStatus)) stateFail('Ungültige QPR-Teilgruppe.');
    if (row.legacyQprStatus !== null && !['A', 'B', 'C', 'D'].includes(row.legacyQprStatus)) stateFail('Ungültiger historischer QPR-Status.');
    if (row.serviceStatus !== null && !['active', 'ended'].includes(row.serviceStatus)) stateFail('Ungültiger Versorgungsstatus.');
    if (row.serviceScope !== null && !['eligible', 'excluded', 'unknown'].includes(row.serviceScope)) stateFail('Ungültiger Versorgungsscope.');
    if (row.serviceScopeSource !== null && !['services', 'legacy'].includes(row.serviceScopeSource)) stateFail('Ungültige Quelle des Versorgungsscope.');
    if (row.representativeStatus !== null && !['present', 'none', 'unknown'].includes(row.representativeStatus)) stateFail('Ungültiger Vertreterstatus.');
    if (row.assessmentSource !== null && !['report', 'own', 'unknown'].includes(row.assessmentSource)) stateFail('Ungültige Assessmentquelle.');
    if (row.akiSetting !== null && !['EV', 'MV'].includes(row.akiSetting)) stateFail('Ungültige AKI-Einstellung.');
    if (row.hkpCode !== null && !['6', '8', '29', '31a'].includes(row.hkpCode)) stateFail('Ungültiger HKP-Code.');
    if (row.intensiveCare !== null && !['AKI', 'AKI-B', 'pHKP', 'pHKP-EV'].includes(row.intensiveCare)) stateFail('Ungültige Intensivversorgung.');
    for (const field of ['cognitionImpaired', 'mobilityImpaired', 'phkpFirst']) {
      if (row[field] !== null && ![0, 1].includes(row[field])) stateFail(`${field} muss 0 oder 1 sein.`);
    }
    if (row.careLevel !== null && (!Number.isSafeInteger(row.careLevel) || row.careLevel < 0 || row.careLevel > 5)) stateFail('Ungültiger Pflegegrad.');
    if (row.hkpCodes !== null) {
      let parsed;
      try { parsed = JSON.parse(row.hkpCodes); } catch { stateFail('hkpCodes muss ein JSON-Array sein.'); }
      if (!Array.isArray(parsed)) stateFail('hkpCodes muss ein JSON-Array sein.');
      if (parsed.some((code) => !['6', '8', '29', '31a'].includes(code))) stateFail('hkpCodes enthält einen ungültigen HKP-Code.');
    }
  }
}

function validateReferencesAndUniques(state) {
  for (const [tableName, records] of state) {
    const table = schema.tables.get(tableName);
    for (const [key, row] of records) {
      validateKey(tableName, key, row);
      for (const foreignKey of table.foreignKeys) {
        const values = foreignKey.columns.map((column) => row[column]);
        if (values.every((value) => value === null || value === undefined)) continue;
        if (values.some((value) => value === null || value === undefined)) stateFail(`Unvollständiger Fremdschlüssel in ${tableName}.`);
        const targetRecords = state.get(foreignKey.table);
        const targetTable = schema.tables.get(foreignKey.table);
        const target = [...(targetRecords?.values() ?? [])].find((candidate) => foreignKey.referencedColumns.every((column, index) => valueEqual(candidate[column], values[index])));
        if (!target || !targetTable) stateFail(`Fremdschlüssel in ${tableName} verweist auf keinen Datensatz.`);
      }
    }
    for (const unique of table.unique) {
      const seen = new Set();
      for (const row of records.values()) {
        if (unique.columns.some((column) => row[column] === null || row[column] === undefined)) continue;
        const values = unique.columns.map((column) => row[column]);
        const normalized = unique.caseInsensitive ? values.map((value) => typeof value === 'string' ? value.toLocaleLowerCase('und') : value) : values;
        const identity = canonicalJson(normalized);
        if (seen.has(identity)) stateFail(`Doppelte eindeutige Werte in ${tableName}.`);
        seen.add(identity);
      }
    }
  }
  validateDomains(state);
}

export function applyChanges(state, changes) {
  const next = new Map([...state].map(([tableName, records]) => [tableName, new Map([...records].map(([key, row]) => [key, clone(row)]))]));
  const applied = [];
  for (const change of changes) {
    const records = next.get(change.table);
    const current = records?.get(change.key) ?? null;
    if (!valueEqual(current, change.before)) fail(`Datensatz ${change.table}/${change.key} wurde inzwischen geändert.`, { conflict: { table: change.table, key: change.key } });
    if (change.after === null) records.delete(change.key);
    else records.set(change.key, clone(change.after));
    applied.push({ ...change, before: current, after: change.after === null ? null : clone(change.after) });
  }
  validateReferencesAndUniques(next);
  return { state: next, applied };
}

export function rowKey(tableName, row) {
  const table = schema.tables.get(tableName);
  if (!table) fail(`Unbekannte Tabelle ${tableName}.`);
  return keyForRow(table, row);
}
