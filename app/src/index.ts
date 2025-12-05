import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import * as XLSX from 'xlsx';
import type {
  Aggregation,
  AppState,
  Employee,
  EmploymentPeriod,
  EmployeeWithPeriod,
  EmployeeEvent,
  EmployeeEventType,
  QualificationType,
  YearDataset,
  UpdateStatus,
} from './shared/types';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require('electron-squirrel-startup')) {
  app.quit();
}

type AppConfig = {
  salt: string;
  passwordHash: string;
  encryptedKey: string;
  keyIv: string;
  keyTag: string;
  keyFingerprint?: string;
  configVersion: number;
};

const dataDir = path.join(app.getPath('userData'), 'data');
const encryptedDbPath = path.join(dataDir, 'employee.db.enc');
const workingDbPath = path.join(dataDir, 'employee.db');
const configPath = path.join(dataDir, 'config.json');

let mainWindow: BrowserWindow | null = null;
let db: DatabaseType | null = null;
let encryptionKey: Buffer | null = null;
let unlocked = false;
let updaterInitialized = false;
let updateFeedConfigured = false;
let latestUpdateVersion: string | undefined;

const ensureDataDir = (): void => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const deriveKey = (password: string, salt: string): Buffer =>
  crypto.pbkdf2Sync(password, salt, 200_000, 32, 'sha512');

const hashPassword = (password: string, salt: string): string =>
  crypto.pbkdf2Sync(password, salt, 220_000, 64, 'sha512').toString('hex');

const fingerprintKey = (key: Buffer): string =>
  crypto.createHash('sha256').update(key).digest('hex');

const parseRecoveryKey = (input: string): Buffer => {
  const trimmed = input.trim();
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) {
      return buf;
    }
  } catch (err) {
    // ignore
  }
  try {
    const buf = Buffer.from(trimmed, 'hex');
    if (buf.length === 32) {
      return buf;
    }
  } catch (err) {
    // ignore
  }
  throw new Error('Recovery Key hat ein ungültiges Format (erwartet Base64 oder Hex, 32 Byte).');
};

const encryptBuffer = (data: Buffer, key: Buffer): { iv: Buffer; tag: Buffer; content: Buffer } => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, content };
};

const decryptBuffer = (
  payload: { iv: Buffer; tag: Buffer; content: Buffer },
  key: Buffer,
): Buffer => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.iv);
  decipher.setAuthTag(payload.tag);
  return Buffer.concat([decipher.update(payload.content), decipher.final()]);
};

const encryptFile = (inputPath: string, outputPath: string, key: Buffer): void => {
  const data = fs.readFileSync(inputPath);
  const payload = encryptBuffer(data, key);
  const combined = Buffer.concat([payload.iv, payload.tag, payload.content]);
  fs.writeFileSync(outputPath, combined);
};

const decryptFile = (inputPath: string, outputPath: string, key: Buffer): void => {
  const payload = fs.readFileSync(inputPath);
  if (payload.length < 28) {
    throw new Error('Verschlüsseltes Datenpaket ist ungültig.');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const content = payload.subarray(28);
  const data = decryptBuffer({ iv, tag, content }, key);
  fs.writeFileSync(outputPath, data);
};

const readConfig = (): AppConfig | null => {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content) as AppConfig;
  } catch (error) {
    return null;
  }
};

const writeConfig = (config: AppConfig): void => {
  ensureDataDir();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

const isConfigured = (): boolean => fs.existsSync(configPath);

const ensureWorkingDb = (): void => {
  ensureDataDir();
  if (fs.existsSync(workingDbPath)) {
    return;
  }

  if (fs.existsSync(encryptedDbPath) && encryptionKey) {
    decryptFile(encryptedDbPath, workingDbPath, encryptionKey);
  } else if (!fs.existsSync(workingDbPath)) {
    fs.writeFileSync(workingDbPath, '');
  }
};

// =============================================================================
// VERSIONED MIGRATIONS
// =============================================================================
// Each migration runs exactly once. Add new migrations at the end with incrementing version.
// Migrations are run in order from the current schema version to the latest.

type Migration = {
  version: number;
  description: string;
  up: () => void;
};

const getSchemaVersion = (): number => {
  if (!db) return 0;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as { value?: string } | undefined;
    return row?.value ? Number(row.value) : 0;
  } catch {
    return 0; // settings table doesn't exist yet
  }
};

const setSchemaVersion = (version: number): void => {
  if (!db) return;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").run(String(version));
};

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema with all tables',
    up: () => {
      db!.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS qualification_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          sortOrder INTEGER,
          note TEXT
        );
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          qualification TEXT NOT NULL,
          dataSource TEXT,
          note TEXT,
          weeklyHours REAL,
          documentPath TEXT,
          createdAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS employment_periods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT,
          fte REAL NOT NULL,
          qualification TEXT,
          note TEXT,
          weeklyHours REAL,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_periods_employee ON employment_periods(employeeId);
        CREATE INDEX IF NOT EXISTS idx_periods_dates ON employment_periods(startDate, endDate);
        CREATE TABLE IF NOT EXISTS employee_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          eventDate TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          details TEXT,
          meta TEXT,
          previousValue TEXT,
          newValue TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_events_employee ON employee_events(employeeId);
        CREATE INDEX IF NOT EXISTS idx_events_date ON employee_events(eventDate);
      `);

      // Seed default qualifications
      const defaults = ['3-jährig examiniert', '1-jährig examiniert', 'Pflegekraft/-helfer', 'Sonstige'];
      const seedQuali = db!.prepare('INSERT OR IGNORE INTO qualification_types (name) VALUES (?)');
      defaults.forEach((q) => seedQuali.run(q));

      // Set default baseHours
      db!.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('baseHours', '36')").run();

      // Initialize sortOrder
      db!.prepare('UPDATE qualification_types SET sortOrder = id WHERE sortOrder IS NULL').run();
      db!.prepare('CREATE INDEX IF NOT EXISTS idx_qualification_sort ON qualification_types(sortOrder)').run();
    },
  },
  {
    version: 2,
    description: 'Add missing columns for legacy databases (sortOrder, notes, weeklyHours, event history)',
    up: () => {
      // These use try/catch for backwards compatibility with existing databases
      const addColumnIfMissing = (table: string, column: string, type: string) => {
        try {
          db!.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
        } catch {
          // Column already exists
        }
      };

      addColumnIfMissing('qualification_types', 'sortOrder', 'INTEGER');
      addColumnIfMissing('qualification_types', 'note', 'TEXT');
      addColumnIfMissing('employees', 'weeklyHours', 'REAL');
      addColumnIfMissing('employment_periods', 'note', 'TEXT');
      addColumnIfMissing('employment_periods', 'weeklyHours', 'REAL');
      addColumnIfMissing('employee_events', 'previousValue', 'TEXT');
      addColumnIfMissing('employee_events', 'newValue', 'TEXT');

      // Ensure sortOrder and index
      db!.prepare('UPDATE qualification_types SET sortOrder = id WHERE sortOrder IS NULL').run();
      db!.prepare('CREATE INDEX IF NOT EXISTS idx_qualification_sort ON qualification_types(sortOrder)').run();
    },
  },
  {
    version: 3,
    description: 'Migrate weeklyHours to periods and recalculate FTE with 36h threshold',
    up: () => {
      const baseHoursRow = db!.prepare("SELECT value FROM settings WHERE key = 'baseHours'").get() as { value?: string } | undefined;
      const baseHours = baseHoursRow?.value ? Number(baseHoursRow.value) || 36 : 36;
      const FULL_TIME_THRESHOLD = 36;

      // 1. Copy weeklyHours from employees to periods where missing
      db!.prepare(`
        UPDATE employment_periods
        SET weeklyHours = (SELECT e.weeklyHours FROM employees e WHERE e.id = employment_periods.employeeId)
        WHERE weeklyHours IS NULL
      `).run();

      // 2. If weeklyHours is still NULL but FTE exists, calculate weeklyHours from FTE
      db!.prepare(`
        UPDATE employment_periods
        SET weeklyHours = CASE
          WHEN fte >= 1.0 THEN ?
          ELSE ROUND(fte * ?, 1)
        END
        WHERE weeklyHours IS NULL AND fte IS NOT NULL
      `).run(baseHours, baseHours);

      // 3. Recalculate FTE for all periods where weeklyHours is set (using 36h threshold)
      db!.prepare(`
        UPDATE employment_periods
        SET fte = CASE
          WHEN weeklyHours >= ? THEN 1.0
          ELSE MIN(1.0, ROUND(weeklyHours / ?, 2))
        END
        WHERE weeklyHours IS NOT NULL
      `).run(FULL_TIME_THRESHOLD, baseHours);
    },
  },
];

const CURRENT_SCHEMA_VERSION = migrations.length;

const detectLegacyDatabaseVersion = (): number => {
  if (!db) return 0;
  try {
    // Check if this is a v1.2.0 database (has tables but no schema_version)
    const hasEmployees = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'").get();
    if (!hasEmployees) return 0; // Fresh database

    // Check for migration markers from old system
    const hasFteMigration = db.prepare("SELECT value FROM settings WHERE key = 'migration_fte_recalc_v1'").get();
    if (hasFteMigration) return 3; // Already ran the FTE migration

    // Has the weeklyHours column in employment_periods? (added in later versions)
    try {
      db.prepare('SELECT weeklyHours FROM employment_periods LIMIT 1').get();
      return 2; // Has the column, so migrations 1-2 are done
    } catch {
      return 1; // Basic schema exists
    }
  } catch {
    return 0;
  }
};

const runMigrations = (): void => {
  if (!db) return;
  db.pragma('foreign_keys = ON');

  let currentVersion = getSchemaVersion();

  // For legacy databases without schema_version, detect their actual state
  if (currentVersion === 0) {
    const legacyVersion = detectLegacyDatabaseVersion();
    if (legacyVersion > 0) {
      console.log(`Detected legacy database at version ${legacyVersion}, updating schema_version`);
      currentVersion = legacyVersion;
      setSchemaVersion(legacyVersion);
    }
  }

  // Run all migrations that haven't been applied yet
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration v${migration.version}: ${migration.description}`);
      migration.up();
      setSchemaVersion(migration.version);
    }
  }

  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM employees')
    .get() as { cnt: number };
  if (row.cnt === 0) {
    const seed = db.transaction(() => {
      const emp = db.prepare(
        'INSERT INTO employees (name, qualification, dataSource, note, documentPath) VALUES (@name, @qualification, @dataSource, @note, @documentPath)',
      );
      const period = db.prepare(
        'INSERT INTO employment_periods (employeeId, startDate, endDate, fte, weeklyHours, qualification) VALUES (?, ?, ?, ?, ?, ?)',
      );

      const anna = emp.run({
        name: 'Anna Beispiel',
        qualification: '3-jährig examiniert',
        dataSource: 'Verwaltungssoftware',
        note: 'Teamleitung 1',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(anna, '2021-05-01', null, 1.0, 36, '3-jährig examiniert');

      const max = emp.run({
        name: 'Max Mustermann',
        qualification: 'Pflegekraft/-helfer',
        dataSource: 'NAS',
        note: 'Teilzeit',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(max, '2020-03-15', '2024-03-31', 0.6, 21.6, 'Pflegekraft/-helfer');

      const lisa = emp.run({
        name: 'Lisa Referenz',
        qualification: '1-jährig examiniert',
        dataSource: 'Verwaltungssoftware',
        note: 'Fortbildung Wundmanagement',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(lisa, '2023-11-01', null, 0.8, 28.8, '1-jährig examiniert');
    });

    seed();
  }
};

const openDatabase = (): void => {
  if (!encryptionKey) {
    throw new Error('Datenbank ist gesperrt.');
  }
  ensureWorkingDb();
  db = new Database(workingDbPath);
  runMigrations();
};

const persistEncryptedDb = (): void => {
  if (!encryptionKey) return;
  if (db) {
    db.close();
    db = null;
  }
  if (fs.existsSync(workingDbPath)) {
    encryptFile(workingDbPath, encryptedDbPath, encryptionKey);
    fs.rmSync(workingDbPath, { force: true });
  }
};

const ensureDbReady = (): void => {
  if (!unlocked || !encryptionKey) {
    throw new Error('Bitte zuerst anmelden.');
  }
  if (!db) {
    openDatabase();
  }
};

const backupDatabase = (): string => {
  ensureDataDir();
  ensureWorkingDb();
  const backupsDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const source = fs.existsSync(encryptedDbPath) ? encryptedDbPath : workingDbPath;
  const ext = path.extname(source) || '.db';
  const filename = `employee-backup-${Date.now()}${ext}`;
  const target = path.join(backupsDir, filename);
  fs.copyFileSync(source, target);
  return target;
};

const computeStatus = (endDate: string | null, year: number): 'active' | 'left' => {
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  if (end && end >= yearStart && end <= yearEnd) {
    return 'left';
  }
  return 'active';
};

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

const getYearDataset = (year: number): YearDataset => {
  ensureDbReady();
  const startIso = `${year}-01-01`;
  const endIso = `${year}-12-31`;

  const baseHoursRow = db
    ?.prepare("SELECT value FROM settings WHERE key = 'baseHours'")
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
             e.qualification as baseQualification,
             e.dataSource,
             e.note,
             p.weeklyHours,
             e.createdAt,
             e.documentPath,
             p.id as periodId,
             p.startDate,
             p.endDate,
             p.fte,
             COALESCE(p.qualification, e.qualification) as qualification,
             p.note as periodNote
      FROM employees e
      INNER JOIN employment_periods p ON p.employeeId = e.id
      WHERE date(p.startDate) <= date(@endIso)
        AND (p.endDate IS NULL OR date(p.endDate) >= date(@startIso))
      ORDER BY e.id ASC, p.startDate DESC;
    `,
    )
    .all({ startIso, endIso }) as (Employee &
      EmploymentPeriod & { employeeId: number; periodId: number; periodNote?: string | null; createdAt?: string })[];

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
        dataSource: row.dataSource ?? undefined,
        weeklyHours: row.weeklyHours ?? null,
        documentPath: row.documentPath ?? undefined,
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

  const employees = Array.from(latest.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'de'),
  );
  return {
    employees,
    aggregation: buildAggregation(employees),
    baseHours: fullTimeHours,
  };
};

const listPeriods = (employeeId: number): EmploymentPeriod[] => {
  ensureDbReady();
  const rows = db
    .prepare(
      `
      SELECT id, startDate, endDate, fte, weeklyHours, qualification, note
      FROM employment_periods
      WHERE employeeId = ?
      ORDER BY startDate DESC;
    `,
    )
    .all(employeeId) as EmploymentPeriod[];
  return rows;
};

const parseEventRow = (row: any): EmployeeEvent => {
  let meta: Record<string, unknown> | null = null;
  if (row.meta) {
    try {
      meta = JSON.parse(row.meta);
    } catch (err) {
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

const listEvents = (employeeId: number): EmployeeEvent[] => {
  ensureDbReady();
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

const saveEmployee = (input: {
  id?: number;
  periodId?: number;
  name: string;
  qualification: string;
  dataSource?: string;
  note?: string;
  weeklyHours?: number | null;
  documentPath?: string;
  startDate: string;
  endDate?: string | null;
  fte: number;
  year: number;
  periodNote?: string | null;
  linked?: boolean;
}): YearDataset => {
  ensureDbReady();
  const fullTimeHours = getBaseHours();
  const useLinked = input.linked ?? true;
  const derivedFte =
    useLinked && input.weeklyHours !== undefined && input.weeklyHours !== null
      ? Math.min(1, Number((input.weeklyHours / fullTimeHours).toFixed(2)))
      : input.fte;

  const mutation = db.transaction(() => {
    const existing = input.id
      ? (db
          .prepare('SELECT name, note FROM employees WHERE id = ?')
          .get(input.id) as { name: string; note: string | null } | undefined)
      : undefined;

    const employeePayload = {
      name: input.name,
      qualification: input.qualification,
      dataSource: input.dataSource ?? null,
      note: input.note ?? null,
      documentPath: input.documentPath ?? null,
    };

    let employeeId = input.id;
    if (employeeId) {
      db.prepare(
        'UPDATE employees SET name = @name, qualification = @qualification, dataSource = @dataSource, note = @note, documentPath = @documentPath WHERE id = @id',
      ).run({ ...employeePayload, id: employeeId });
    } else {
      const result = db
        .prepare(
          'INSERT INTO employees (name, qualification, dataSource, note, documentPath) VALUES (@name, @qualification, @dataSource, @note, @documentPath)',
        )
        .run(employeePayload);
      employeeId = Number(result.lastInsertRowid);
    }

    if (input.periodId) {
      db.prepare(
        'UPDATE employment_periods SET startDate = ?, endDate = ?, fte = ?, weeklyHours = ?, qualification = ?, note = ? WHERE id = ? AND employeeId = ?',
      ).run(
        input.startDate,
        input.endDate ?? null,
        derivedFte,
        input.weeklyHours ?? null,
        input.qualification,
        input.periodNote ?? null,
        input.periodId,
        employeeId,
      );
    } else {
      const openPeriod = db
        .prepare(
          `
          SELECT id, startDate
          FROM employment_periods
          WHERE employeeId = ?
            AND (endDate IS NULL OR endDate = '')
            AND date(startDate) <= date(?)
          ORDER BY date(startDate) DESC
          LIMIT 1;
        `,
        )
        .get(employeeId, input.startDate) as { id: number; startDate: string } | undefined;

      if (openPeriod?.id) {
        const prevEnd = new Date(`${input.startDate}T00:00:00`);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevEndIso = prevEnd.toISOString().slice(0, 10);
        db.prepare('UPDATE employment_periods SET endDate = ? WHERE id = ?').run(prevEndIso, openPeriod.id);
      }

      db.prepare(
        'INSERT INTO employment_periods (employeeId, startDate, endDate, fte, weeklyHours, qualification, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        employeeId,
        input.startDate,
        input.endDate ?? null,
        derivedFte,
        input.weeklyHours ?? null,
        input.qualification,
        input.periodNote ?? null,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!existing && employeeId) {
      db.prepare(
        'INSERT INTO employee_events (employeeId, eventDate, type, title, details) VALUES (?, ?, ?, ?, ?)',
      ).run(employeeId, input.startDate || today, 'join', 'Eintritt', `Startdatum: ${input.startDate}`);
    }

    if (existing && employeeId) {
      if (existing.name !== input.name) {
        db.prepare(
          'INSERT INTO employee_events (employeeId, eventDate, type, title, details, meta, previousValue, newValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          employeeId,
          today,
          'name-change',
          'Name geändert',
          `${existing.name} → ${input.name}`,
          JSON.stringify({ from: existing.name, to: input.name }),
          existing.name,
          input.name,
        );
      }
      if ((existing.note ?? '') !== (input.note ?? '')) {
        const from = existing.note ?? '';
        const to = input.note ?? '';
        db.prepare(
          'INSERT INTO employee_events (employeeId, eventDate, type, title, details, meta, previousValue, newValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          employeeId,
          today,
          'note-change',
          'Notiz geändert',
          'Notiz aktualisiert',
          JSON.stringify({ from, to }),
          from,
          to,
        );
      }
    }
  });

  mutation();
  return getYearDataset(input.year);
};

const deleteEmployee = (id: number, year: number): YearDataset => {
  ensureDbReady();
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  return getYearDataset(year);
};

const deletePeriod = (periodId: number, year: number): YearDataset => {
  ensureDbReady();
  db.prepare('DELETE FROM employment_periods WHERE id = ?').run(periodId);
  return getYearDataset(year);
};

const deleteDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
  }
  fs.rmSync(workingDbPath, { force: true });
  fs.rmSync(encryptedDbPath, { force: true });
  ensureDataDir();
};

const resetApplication = (): AppState => {
  if (db) {
    db.close();
    db = null;
  }
  encryptionKey = null;
  unlocked = false;
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  return { configured: false, unlocked: false };
};

const saveEvent = (input: {
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
  ensureDbReady();
  const payload = {
    employeeId: input.employeeId,
    eventDate: input.eventDate,
    type: input.type,
    title: input.title,
    details: input.details ?? null,
    meta: input.meta ? JSON.stringify(input.meta) : null,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
  };

  if (input.id) {
    db.prepare(
      'UPDATE employee_events SET eventDate = @eventDate, type = @type, title = @title, details = @details, meta = @meta, previousValue = @previousValue, newValue = @newValue WHERE id = @id AND employeeId = @employeeId',
    ).run({ ...payload, id: input.id });
  } else {
    db.prepare(
      'INSERT INTO employee_events (employeeId, eventDate, type, title, details, meta, previousValue, newValue) VALUES (@employeeId, @eventDate, @type, @title, @details, @meta, @previousValue, @newValue)',
    ).run(payload);
  }

  return listEvents(input.employeeId);
};

const deleteEvent = (id: number, employeeId: number): EmployeeEvent[] => {
  ensureDbReady();
  db.prepare('DELETE FROM employee_events WHERE id = ?').run(id);
  return listEvents(employeeId);
};

const getBaseHours = (): number => {
  ensureDbReady();
  const row = db?.prepare("SELECT value FROM settings WHERE key = 'baseHours'").get() as { value?: string } | undefined;
  return row?.value ? Number(row.value) || 36 : 36;
};

const setBaseHours = (hours: number): number => {
  ensureDbReady();
  db?.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'baseHours',
    String(hours),
  );
  return getBaseHours();
};

const listQualifications = (): QualificationType[] => {
  ensureDbReady();
  const rows = db
    ?.prepare('SELECT id, name, note FROM qualification_types ORDER BY sortOrder ASC, name ASC')
    .all() as QualificationType[];
  return rows ?? [];
};

const addQualification = (name: string, note?: string | null): QualificationType[] => {
  ensureDbReady();
  const trimmed = name.trim();
  if (!trimmed) return listQualifications();
  const nextOrder = db
    ?.prepare('SELECT COALESCE(MAX(sortOrder), 0) + 1 as nextOrder FROM qualification_types')
    .get() as { nextOrder: number };
  db?.prepare('INSERT OR IGNORE INTO qualification_types (name, sortOrder) VALUES (?, ?)').run(
    trimmed,
    nextOrder?.nextOrder ?? 1,
  );
  if (note && note.trim()) {
    db?.prepare('UPDATE qualification_types SET note = ? WHERE name = ?').run(note.trim(), trimmed);
  }
  return listQualifications();
};

const updateQualification = (id: number, name: string, note?: string | null): QualificationType[] => {
  ensureDbReady();
  const trimmed = name.trim();
  if (!trimmed) return listQualifications();
  try {
    db?.prepare('UPDATE qualification_types SET name = ?, note = ? WHERE id = ?').run(
      trimmed,
      note?.trim() ?? null,
      id,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Aktualisierung fehlgeschlagen (möglicher Konflikt mit vorhandenem Namen).';
    throw new Error(message);
  }
  return listQualifications();
};

const reorderQualifications = (orderedIds: number[]): QualificationType[] => {
  ensureDbReady();
  const tx = db?.transaction(() => {
    orderedIds.forEach((id, idx) => {
      db?.prepare('UPDATE qualification_types SET sortOrder = ? WHERE id = ?').run(idx + 1, id);
    });
  });
  tx?.();
  return listQualifications();
};

const deleteQualification = (id: number): QualificationType[] => {
  ensureDbReady();
  db?.prepare('DELETE FROM qualification_types WHERE id = ?').run(id);
  return listQualifications();
};

const exportDatabase = async (
  mode: 'encrypted' | 'plain',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  ensureDbReady();
  ensureWorkingDb();
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: mode === 'encrypted' ? 'Datenbank exportieren (verschlüsselt)' : 'Datenbank exportieren (unverschlüsselt)',
    defaultPath: mode === 'encrypted' ? 'employee.db.enc' : 'employee.db',
    filters: [
      mode === 'encrypted'
        ? { name: 'Verschlüsselte DB', extensions: ['enc'] }
        : { name: 'SQLite DB', extensions: ['db', 'sqlite'] },
    ],
  });
  if (canceled || !filePath) return { saved: false };

  try {
    if (mode === 'encrypted') {
      if (!encryptionKey) throw new Error('Kein Schlüssel geladen.');
      encryptFile(workingDbPath, filePath, encryptionKey);
    } else {
      fs.copyFileSync(workingDbPath, filePath);
    }
    return { saved: true, filePath };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Export fehlgeschlagen. Bitte Pfad/Schreibrechte prüfen.';
    dialog.showErrorBox('Export fehlgeschlagen', message);
    return { saved: false, error: message };
  }
};

const closeDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};

const importDatabase = async (
  mode: 'encrypted' | 'plain',
): Promise<{ imported: boolean; error?: string; backupPath?: string }> => {
  ensureDbReady();
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: mode === 'encrypted' ? 'Datenbank importieren (verschlüsselt)' : 'Datenbank importieren (unverschlüsselt)',
    properties: ['openFile'],
    filters: [
      mode === 'encrypted'
        ? { name: 'Verschlüsselte DB', extensions: ['enc'] }
        : { name: 'SQLite DB', extensions: ['db', 'sqlite'] },
    ],
  });
  if (canceled || filePaths.length === 0) return { imported: false };

  const source = filePaths[0];

  try {
    const backupPath = backupDatabase();
    ensureDataDir();
    closeDb();
    if (mode === 'encrypted') {
      if (!encryptionKey) throw new Error('Kein Schlüssel geladen.');
      fs.copyFileSync(source, encryptedDbPath);
      decryptFile(source, workingDbPath, encryptionKey);
    } else {
      fs.copyFileSync(source, workingDbPath);
      if (fs.existsSync(encryptedDbPath)) {
        fs.rmSync(encryptedDbPath);
      }
    }
    openDatabase();
    return { imported: true, backupPath };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Import fehlgeschlagen. Datei/Schlüssel prüfen.';
    dialog.showErrorBox('Import fehlgeschlagen', message);
    return { imported: false, error: message };
  }
};

const exportData = async (
  year: number,
  format: 'csv' | 'xlsx',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  ensureDbReady();
  const dataset = getYearDataset(year);
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: `Export ${year}`,
    defaultPath: `mitarbeitende-${year}.${format === 'csv' ? 'csv' : 'xlsx'}`,
    filters: [
      format === 'csv'
        ? { name: 'CSV', extensions: ['csv'] }
        : { name: 'Excel', extensions: ['xlsx'] },
    ],
  });

  if (canceled || !filePath) {
    return { saved: false };
  }

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ordner konnte nicht erstellt werden.';
    dialog.showErrorBox('Export fehlgeschlagen', message);
    return { saved: false, error: message };
  }

  const writeToPath = (targetPath: string): void => {
    if (format === 'csv') {
      const header = 'Name;Qualifikation;Eintritt;Austritt;FTE/VZÄ;Status;Quelle;Dokument\n';
      const lines = dataset.employees
        .map(
          (row) =>
            `${row.name};${row.qualification};${row.startDate};${row.endDate ?? ''};${row.fte};${row.status};${row.dataSource ?? ''};${row.documentPath ?? ''}`,
        )
        .join('\n');
      fs.writeFileSync(targetPath, `${header}${lines}`);
    } else {
      const workbook = XLSX.utils.book_new();
      const dataSheet = XLSX.utils.json_to_sheet(
        dataset.employees.map((row) => ({
          Name: row.name,
          Qualifikation: row.qualification,
          Eintritt: row.startDate,
          Austritt: row.endDate ?? '',
          'FTE/VZÄ': row.fte,
          Status: row.status,
          Quelle: row.dataSource ?? '',
          Dokument: row.documentPath ?? '',
        })),
      );
      XLSX.utils.book_append_sheet(workbook, dataSheet, `Mitarbeitende ${year}`);

      const aggSheet = XLSX.utils.json_to_sheet(
        dataset.aggregation.categories.map((cat) => ({
          Qualifikation: cat.qualification,
          Kopfanzahl: cat.headcount,
        'FTE/VZÄ': cat.fte,
        })),
      );
      XLSX.utils.book_append_sheet(workbook, aggSheet, 'Aggregationen');
      // Use type: 'array' to avoid XLSX's browser download path (write_dl) in webpack-bundled Electron
      const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
    }
  };

  try {
    writeToPath(filePath);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Export konnte nicht gespeichert werden. Bitte Pfad/Schreibrechte prüfen.';
    const fallbackPath = path.join(app.getPath('downloads'), path.basename(filePath));
    try {
      writeToPath(fallbackPath);
      dialog.showMessageBox({
        type: 'info',
        title: 'Export umgeleitet',
        message: `Export konnte nicht unter ${filePath} gespeichert werden.\n\nStattdessen gespeichert unter:\n${fallbackPath}`,
      });
      return { saved: true, filePath: fallbackPath };
    } catch (secondErr) {
      const secondMessage =
        secondErr instanceof Error ? secondErr.message : `${message} (Fallback fehlgeschlagen)`;
      dialog.showErrorBox('Export fehlgeschlagen', secondMessage);
      return { saved: false, error: secondMessage };
    }
  }

  return { saved: true, filePath };
};

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    minHeight: 720,
    minWidth: 1200,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

const sendUpdateStatus = (status: UpdateStatus): void => {
  if (mainWindow) {
    mainWindow.webContents.send('updates:status', status);
  }
};

const initAutoUpdater = (): void => {
  if (updaterInitialized || !app.isPackaged) {
    return;
  }
  updaterInitialized = true;
  const feedUrl = process.env.UPDATE_FEED_URL;
  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl, channel: 'latest' });
    updateFeedConfigured = true;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    latestUpdateVersion = info.version;
    sendUpdateStatus({ state: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) =>
    sendUpdateStatus({
      state: 'downloading',
      version: latestUpdateVersion,
      progress: Math.round(progress.percent),
    }),
  );
  autoUpdater.on('update-downloaded', (info) => {
    latestUpdateVersion = info.version;
    sendUpdateStatus({ state: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (err) => sendUpdateStatus({ state: 'error', message: err.message }));
  sendUpdateStatus({ state: 'idle' });
};

app.on('ready', () => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  persistEncryptedDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  persistEncryptedDb();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('app:state', (): AppState => ({
  configured: isConfigured(),
  unlocked,
}));

ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) {
    if (process.env.MOCK_UPDATE_BANNER === '1') {
      sendUpdateStatus({ state: 'available', version: 'dev-demo' });
      setTimeout(() => sendUpdateStatus({ state: 'downloading', version: 'dev-demo', progress: 42 }), 300);
      setTimeout(() => sendUpdateStatus({ state: 'downloaded', version: 'dev-demo' }), 1200);
      return true;
    }
    sendUpdateStatus({ state: 'not-available' });
    return false;
  }
  if (!updaterInitialized) {
    initAutoUpdater();
  }
  if (!updateFeedConfigured) {
    const feedUrl = process.env.UPDATE_FEED_URL;
    if (!feedUrl) {
      sendUpdateStatus({ state: 'error', message: 'UPDATE_FEED_URL ist nicht konfiguriert.' });
      return false;
    }
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl, channel: 'latest' });
    updateFeedConfigured = true;
  }
  await autoUpdater.checkForUpdates();
  return true;
});

ipcMain.handle('updates:install', async () => {
  if (!app.isPackaged) return false;
  if (!updaterInitialized) return false;
  autoUpdater.quitAndInstall();
  return true;
});

ipcMain.handle('auth:register', (_event, password: string): AppState => {
  if (isConfigured()) {
    throw new Error('Die App ist bereits eingerichtet.');
  }
  ensureDataDir();

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const passwordKey = deriveKey(password, salt);
  const keyBytes = crypto.randomBytes(32);
  const encrypted = encryptBuffer(keyBytes, passwordKey);
  const keyFingerprint = fingerprintKey(keyBytes);

  const config: AppConfig = {
    salt,
    passwordHash,
    encryptedKey: encrypted.content.toString('base64'),
    keyIv: encrypted.iv.toString('base64'),
    keyTag: encrypted.tag.toString('base64'),
    keyFingerprint,
    configVersion: 2,
  };
  writeConfig(config);

  encryptionKey = keyBytes;
  unlocked = true;
  openDatabase();
  persistEncryptedDb();
  return { configured: true, unlocked: true };
});

ipcMain.handle('auth:login', (_event, password: string): AppState => {
  const config = readConfig();
  if (!config) {
    throw new Error('Noch nicht eingerichtet.');
  }
  const derived = deriveKey(password, config.salt);
  const hashed = hashPassword(password, config.salt);
  if (hashed !== config.passwordHash) {
    throw new Error('Passwort ist falsch.');
  }

  const keyBytes = decryptBuffer(
    {
      content: Buffer.from(config.encryptedKey, 'base64'),
      iv: Buffer.from(config.keyIv, 'base64'),
      tag: Buffer.from(config.keyTag, 'base64'),
    },
    derived,
  );

  const keyFingerprint = fingerprintKey(keyBytes);
  if (!config.keyFingerprint || (config.configVersion ?? 1) < 2) {
    const upgraded: AppConfig = {
      ...config,
      keyFingerprint,
      configVersion: 2,
    };
    writeConfig(upgraded);
  }

  encryptionKey = keyBytes;
  unlocked = true;
  openDatabase();
  return { configured: true, unlocked: true };
});

ipcMain.handle('auth:recoveryKey', (): { recoveryKey: string; fingerprint: string } => {
  if (!unlocked || !encryptionKey) {
    throw new Error('Bitte zuerst anmelden.');
  }
  return {
    recoveryKey: encryptionKey.toString('base64'),
    fingerprint: fingerprintKey(encryptionKey),
  };
});

ipcMain.handle(
  'auth:recover',
  (_event, payload: { recoveryKey: string; newPassword: string }): AppState => {
    const config = readConfig();
    if (!config) {
      throw new Error('Noch nicht eingerichtet.');
    }
    const { recoveryKey, newPassword } = payload;
    if (!recoveryKey || recoveryKey.trim().length === 0) {
      throw new Error('Recovery Key fehlt.');
    }
    if (!newPassword || newPassword.trim().length === 0) {
      throw new Error('Neues Passwort fehlt.');
    }

    const keyBytes = parseRecoveryKey(recoveryKey);
    const fingerprint = fingerprintKey(keyBytes);
    if (config.keyFingerprint && config.keyFingerprint !== fingerprint) {
      throw new Error('Recovery Key passt nicht zu dieser Installation.');
    }

    try {
      encryptionKey = keyBytes;
      unlocked = true;
      openDatabase();
    } catch (err) {
      encryptionKey = null;
      unlocked = false;
      throw err;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(newPassword, salt);
    const passwordKey = deriveKey(newPassword, salt);
    const encrypted = encryptBuffer(keyBytes, passwordKey);

    const nextConfig: AppConfig = {
      salt,
      passwordHash,
      encryptedKey: encrypted.content.toString('base64'),
      keyIv: encrypted.iv.toString('base64'),
      keyTag: encrypted.tag.toString('base64'),
      keyFingerprint: fingerprint,
      configVersion: Math.max(config.configVersion ?? 1, 2),
    };
    writeConfig(nextConfig);

    return { configured: true, unlocked: true };
  },
);

ipcMain.handle('data:list', (_event, { year }: { year: number }): YearDataset => {
  ensureDbReady();
  return getYearDataset(year);
});

ipcMain.handle('data:listPeriods', (_event, { employeeId }: { employeeId: number }) => {
  ensureDbReady();
  return listPeriods(employeeId);
});

ipcMain.handle('data:save', (_event, input) => {
  ensureDbReady();
  return saveEmployee(input);
});

ipcMain.handle('data:delete', (_event, { id, year }: { id: number; year: number }) => {
  ensureDbReady();
  return deleteEmployee(id, year);
});

ipcMain.handle('data:export', async (_event, { year, format }: { year: number; format: 'csv' | 'xlsx' }) => {
  ensureDbReady();
  return exportData(year, format);
});

ipcMain.handle('data:openDocument', async (_event, { path: filePath }: { path: string }) => {
  if (!filePath) return;
  await shell.openPath(filePath);
});

ipcMain.handle('qualifications:list', () => listQualifications());
ipcMain.handle('qualifications:add', (_event, { name, note }: { name: string; note?: string | null }) =>
  addQualification(name, note),
);
ipcMain.handle('qualifications:update', (_event, { id, name, note }: { id: number; name: string; note?: string | null }) =>
  updateQualification(id, name, note),
);
ipcMain.handle('qualifications:delete', (_event, { id }: { id: number }) => deleteQualification(id));
ipcMain.handle('qualifications:reorder', (_event, { ids }: { ids: number[] }) => reorderQualifications(ids));
ipcMain.handle('db:export', (_event, { mode }: { mode: 'encrypted' | 'plain' }) => exportDatabase(mode));
ipcMain.handle('db:import', (_event, { mode }: { mode: 'encrypted' | 'plain' }) => importDatabase(mode));
ipcMain.handle('period:delete', (_event, { periodId, year }: { periodId: number; year: number }) =>
  deletePeriod(periodId, year),
);
ipcMain.handle('events:list', (_event, { employeeId }: { employeeId: number }) => listEvents(employeeId));
ipcMain.handle(
  'events:save',
  (_event, input: { id?: number; employeeId: number; eventDate: string; type: EmployeeEventType; title: string; details?: string | null; meta?: Record<string, unknown> | null }) =>
    saveEvent(input),
);
ipcMain.handle('events:delete', (_event, { id, employeeId }: { id: number; employeeId: number }) =>
  deleteEvent(id, employeeId),
);
ipcMain.handle('db:delete', () => {
  ensureDataDir();
  deleteDatabase();
  return true;
});
ipcMain.handle('app:reset', () => resetApplication());
ipcMain.handle('settings:getBaseHours', () => getBaseHours());
ipcMain.handle('settings:setBaseHours', (_event, { hours }: { hours: number }) => setBaseHours(hours));

// DEV: Raw table data - dynamically discovers all tables
ipcMain.handle('dev:tables', () => {
  if (!db) return {};
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const result: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    result[name] = db.prepare(`SELECT * FROM "${name}"`).all();
  }
  return result;
});
