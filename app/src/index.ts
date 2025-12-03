import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from 'electron';
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

const ensureDataDir = (): void => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const deriveKey = (password: string, salt: string): Buffer =>
  crypto.pbkdf2Sync(password, salt, 200_000, 32, 'sha512');

const hashPassword = (password: string, salt: string): string =>
  crypto.pbkdf2Sync(password, salt, 220_000, 64, 'sha512').toString('hex');

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

const runMigrations = (): void => {
  if (!db) return;
  db.pragma('foreign_keys = ON');
  db.exec(`
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

  const defaults = [
    '3-jährig examiniert',
    '1-jährig examiniert',
    'Pflegekraft/-helfer',
    'Sonstige',
  ];
  const seedQuali = db.prepare(
    'INSERT OR IGNORE INTO qualification_types (name) VALUES (?)',
  );
  defaults.forEach((q) => seedQuali.run(q));
  // ensure sortOrder exists
  try {
    db.prepare('ALTER TABLE qualification_types ADD COLUMN sortOrder INTEGER').run();
  } catch (err) {
    // ignore if exists
  }
  try {
    db.prepare('ALTER TABLE employees ADD COLUMN weeklyHours REAL').run();
  } catch (err) {
    // ignore
  }
  try {
    db.prepare('ALTER TABLE employment_periods ADD COLUMN note TEXT').run();
  } catch (err) {
    // ignore if exists
  }
  try {
    db.prepare('ALTER TABLE qualification_types ADD COLUMN note TEXT').run();
  } catch (err) {
    // ignore if exists
  }
  db.prepare('UPDATE qualification_types SET sortOrder = id WHERE sortOrder IS NULL').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_qualification_sort ON qualification_types(sortOrder)').run();
  // add columns for event history details if missing
  try {
    db.prepare('ALTER TABLE employee_events ADD COLUMN previousValue TEXT').run();
  } catch (err) {
    // ignore
  }
  try {
    db.prepare('ALTER TABLE employee_events ADD COLUMN newValue TEXT').run();
  } catch (err) {
    // ignore
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
        'INSERT INTO employment_periods (employeeId, startDate, endDate, fte, qualification) VALUES (?, ?, ?, ?, ?)',
      );

      const anna = emp.run({
        name: 'Anna Beispiel',
        qualification: '3-jährig examiniert',
        dataSource: 'Verwaltungssoftware',
        note: 'Teamleitung 1',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(anna, '2021-05-01', null, 1.0, '3-jährig examiniert');

      const max = emp.run({
        name: 'Max Mustermann',
        qualification: 'Pflegekraft/-helfer',
        dataSource: 'NAS',
        note: 'Teilzeit',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(max, '2020-03-15', '2024-03-31', 0.6, 'Pflegekraft/-helfer');

      const lisa = emp.run({
        name: 'Lisa Referenz',
        qualification: '1-jährig examiniert',
        dataSource: 'Verwaltungssoftware',
        note: 'Fortbildung Wundmanagement',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(lisa, '2023-11-01', null, 0.8, '1-jährig examiniert');
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

const computeStatus = (startDate: string, endDate: string | null, year: number): 'active' | 'new' | 'left' => {
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);
  const start = new Date(`${startDate}T00:00:00`);
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  if (start >= yearStart && start <= yearEnd) {
    return 'new';
  }
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
             e.weeklyHours,
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
      EmploymentPeriod & { employeeId: number; periodId: number; periodNote?: string | null })[];

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
        note: row.note ?? undefined,
        weeklyHours: row.weeklyHours ?? null,
        documentPath: row.documentPath ?? undefined,
        startDate: effectiveStart,
        endDate: effectiveEnd ?? null,
        fte: row.fte,
        status: computeStatus(effectiveStart, effectiveEnd ?? null, year),
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
  };
};

const listPeriods = (employeeId: number): EmploymentPeriod[] => {
  ensureDbReady();
  const rows = db
    .prepare(
      `
      SELECT id, startDate, endDate, fte, qualification, note
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
}): YearDataset => {
  ensureDbReady();
  const fullTimeHours = 40;
  const derivedFte =
    input.weeklyHours !== undefined && input.weeklyHours !== null
      ? Number((input.weeklyHours / fullTimeHours).toFixed(2))
      : input.fte;

  const mutation = db.transaction(() => {
    const existing = input.id
      ? (db
          .prepare('SELECT name, note FROM employees WHERE id = ?')
          .get(input.id) as { name: string; note: string | null } | undefined)
      : undefined;

    const employeePayload: Employee = {
      name: input.name,
      qualification: input.qualification,
      dataSource: input.dataSource ?? null,
      note: input.note ?? null,
      weeklyHours: input.weeklyHours ?? null,
      documentPath: input.documentPath ?? null,
    };

    let employeeId = input.id;
    if (employeeId) {
      db.prepare(
        'UPDATE employees SET name = @name, qualification = @qualification, dataSource = @dataSource, note = @note, weeklyHours = @weeklyHours, documentPath = @documentPath WHERE id = @id',
      ).run({ ...employeePayload, id: employeeId });
    } else {
      const result = db
        .prepare(
          'INSERT INTO employees (name, qualification, dataSource, note, weeklyHours, documentPath) VALUES (@name, @qualification, @dataSource, @note, @weeklyHours, @documentPath)',
        )
        .run(employeePayload);
      employeeId = Number(result.lastInsertRowid);
    }

    if (input.periodId) {
      db.prepare(
        'UPDATE employment_periods SET startDate = ?, endDate = ?, fte = ?, qualification = ?, note = ? WHERE id = ? AND employeeId = ?',
      ).run(
        input.startDate,
        input.endDate ?? null,
        derivedFte,
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
        'INSERT INTO employment_periods (employeeId, startDate, endDate, fte, qualification, note) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        employeeId,
        input.startDate,
        input.endDate ?? null,
        derivedFte,
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

app.on('ready', () => {
  createWindow();
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

  const config: AppConfig = {
    salt,
    passwordHash,
    encryptedKey: encrypted.content.toString('base64'),
    keyIv: encrypted.iv.toString('base64'),
    keyTag: encrypted.tag.toString('base64'),
    configVersion: 1,
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

  encryptionKey = keyBytes;
  unlocked = true;
  openDatabase();
  return { configured: true, unlocked: true };
});

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
