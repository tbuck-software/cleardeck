/**
 * Electron Main Process
 *
 * This is the entry point for the Electron main process.
 * It handles window management, IPC handlers, and app lifecycle.
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
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

// Database & Crypto modules
import {
  getDb,
  isDbOpen,
  setEncryptionKey,
  getEncryptionKey,
  openDatabase,
  persistEncryptedDb,
  closeDb,
  deleteDatabase as deleteDbFiles,
  backupDatabase,
  dataDir,
  ensureDataDir,
} from './main/database/connection';

import {
  type AppConfig,
  deriveKey,
  hashPassword,
  fingerprintKey,
  parseRecoveryKey,
  encryptBuffer,
  decryptBuffer,
  isConfigured,
  readConfig,
  writeConfig,
  deleteConfig,
} from './main/crypto';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require('electron-squirrel-startup')) {
  app.quit();
}

// =============================================================================
// APPLICATION STATE
// =============================================================================

let mainWindow: BrowserWindow | null = null;
let unlocked = false;
let updaterInitialized = false;
let updateFeedConfigured = false;
let latestUpdateVersion: string | undefined;

// =============================================================================
// DATABASE HELPER FUNCTIONS
// =============================================================================

/**
 * Ensure database is ready for operations
 */
const ensureDbReady = (): void => {
  if (!unlocked || !getEncryptionKey()) {
    throw new Error('Bitte zuerst anmelden.');
  }
  if (!isDbOpen()) {
    openDatabase();
  }
};

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

// =============================================================================
// DATA ACCESS FUNCTIONS
// =============================================================================

const getYearDataset = (year: number): YearDataset => {
  ensureDbReady();
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
    EmploymentPeriod & {
      employeeId: number;
      periodId: number;
      periodNote?: string | null;
      createdAt?: string;
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

  const employees = Array.from(latest.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return {
    employees,
    aggregation: buildAggregation(employees),
    baseHours: fullTimeHours,
  };
};

const listPeriods = (employeeId: number): EmploymentPeriod[] => {
  ensureDbReady();
  const db = getDb();
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

const listEvents = (employeeId: number): EmployeeEvent[] => {
  ensureDbReady();
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

const saveEmployee = (input: {
  id?: number;
  periodId?: number;
  name: string;
  qualification: string;
  fte: number;
  weeklyHours?: number | null;
  startDate: string;
  endDate?: string | null;
  dataSource?: string | null;
  note?: string | null;
  documentPath?: string | null;
  year: number;
}): YearDataset => {
  ensureDbReady();
  const db = getDb();

  const employeePayload = {
    name: input.name,
    qualification: input.qualification,
    dataSource: input.dataSource ?? null,
    note: input.note ?? null,
    documentPath: input.documentPath ?? null,
  };

  const periodPayload = {
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    fte: input.fte,
    weeklyHours: input.weeklyHours ?? null,
    qualification: input.qualification,
    note: input.note ?? null,
  };

  if (input.id) {
    db.prepare(
      `UPDATE employees
       SET name = @name, qualification = @qualification, dataSource = @dataSource, note = @note, documentPath = @documentPath
       WHERE id = @id`,
    ).run({ ...employeePayload, id: input.id });

    if (input.periodId) {
      db.prepare(
        `UPDATE employment_periods
         SET startDate = @startDate, endDate = @endDate, fte = @fte, weeklyHours = @weeklyHours, qualification = @qualification, note = @note
         WHERE id = @periodId`,
      ).run({ ...periodPayload, periodId: input.periodId });
    } else {
      db.prepare(
        `INSERT INTO employment_periods (employeeId, startDate, endDate, fte, weeklyHours, qualification, note)
         VALUES (@employeeId, @startDate, @endDate, @fte, @weeklyHours, @qualification, @note)`,
      ).run({ ...periodPayload, employeeId: input.id });
    }
  } else {
    const empResult = db
      .prepare(
        `INSERT INTO employees (name, qualification, dataSource, note, documentPath)
         VALUES (@name, @qualification, @dataSource, @note, @documentPath)`,
      )
      .run(employeePayload);
    const newId = empResult.lastInsertRowid as number;

    db.prepare(
      `INSERT INTO employment_periods (employeeId, startDate, endDate, fte, weeklyHours, qualification, note)
       VALUES (@employeeId, @startDate, @endDate, @fte, @weeklyHours, @qualification, @note)`,
    ).run({ ...periodPayload, employeeId: newId });
  }

  return getYearDataset(input.year);
};

const deleteEmployee = (id: number, year: number): YearDataset => {
  ensureDbReady();
  const db = getDb();
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  return getYearDataset(year);
};

const deletePeriod = (periodId: number, year: number): YearDataset => {
  ensureDbReady();
  const db = getDb();
  db.prepare('DELETE FROM employment_periods WHERE id = ?').run(periodId);
  return getYearDataset(year);
};

const deleteDatabase = (): void => {
  closeDb();
  deleteDbFiles();
};

const resetApplication = (): AppState => {
  closeDb();
  deleteDbFiles();
  deleteConfig();
  unlocked = false;
  setEncryptionKey(null);
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

const deleteEvent = (id: number, employeeId: number): EmployeeEvent[] => {
  ensureDbReady();
  const db = getDb();
  db.prepare('DELETE FROM employee_events WHERE id = ?').run(id);
  return listEvents(employeeId);
};

const getBaseHours = (): number => {
  ensureDbReady();
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'baseHours'").get() as
    | { value?: string }
    | undefined;
  return row?.value ? Number(row.value) || 36 : 36;
};

const setBaseHours = (hours: number): number => {
  ensureDbReady();
  const db = getDb();
  const clamped = Math.max(1, Math.min(168, hours));
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('baseHours', ?)").run(
    String(clamped),
  );
  return clamped;
};

const listQualifications = (): QualificationType[] => {
  ensureDbReady();
  const db = getDb();
  return db
    .prepare('SELECT id, name, sortOrder, note FROM qualification_types ORDER BY sortOrder ASC')
    .all() as QualificationType[];
};

const addQualification = (name: string, note?: string | null): QualificationType[] => {
  ensureDbReady();
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Qualifikationsname darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM qualification_types').get() as {
    mx: number | null;
  };
  const nextSort = (maxSort.mx ?? 0) + 1;
  db.prepare(
    'INSERT INTO qualification_types (name, sortOrder, note) VALUES (@name, @sortOrder, @note)',
  ).run({ name: trimmed, sortOrder: nextSort, note: note ?? null });
  return listQualifications();
};

const updateQualification = (
  id: number,
  name: string,
  note?: string | null,
): QualificationType[] => {
  ensureDbReady();
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Qualifikationsname darf nicht leer sein.');
  }
  db.prepare('UPDATE qualification_types SET name = @name, note = @note WHERE id = @id').run({
    id,
    name: trimmed,
    note: note ?? null,
  });
  return listQualifications();
};

const reorderQualifications = (orderedIds: number[]): QualificationType[] => {
  ensureDbReady();
  const db = getDb();
  const update = db.prepare('UPDATE qualification_types SET sortOrder = ? WHERE id = ?');
  orderedIds.forEach((id, idx) => update.run(idx, id));
  return listQualifications();
};

const deleteQualification = (id: number): QualificationType[] => {
  ensureDbReady();
  const db = getDb();
  db.prepare('DELETE FROM qualification_types WHERE id = ?').run(id);
  return listQualifications();
};

// =============================================================================
// EXPORT / IMPORT
// =============================================================================

const exportDatabase = async (
  mode: 'encrypted' | 'plain',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: mode === 'encrypted' ? 'Datenbank verschlüsselt exportieren' : 'Datenbank unverschlüsselt exportieren',
    defaultPath: `employee-backup-${Date.now()}.${mode === 'encrypted' ? 'enc' : 'db'}`,
    filters: [
      mode === 'encrypted'
        ? { name: 'Verschlüsselte Datenbank', extensions: ['enc'] }
        : { name: 'SQLite Datenbank', extensions: ['db'] },
    ],
  });
  if (canceled || !filePath) {
    return { saved: false };
  }

  ensureDbReady();
  const db = getDb();
  db.backup(filePath);

  if (mode === 'encrypted') {
    const key = getEncryptionKey();
    if (!key) throw new Error('Kein Schlüssel');
    const data = fs.readFileSync(filePath);
    const payload = encryptBuffer(data, key);
    const combined = Buffer.concat([payload.iv, payload.tag, payload.content]);
    fs.writeFileSync(filePath, combined);
  }

  return { saved: true, filePath };
};

const importDatabase = async (
  mode: 'encrypted' | 'plain',
): Promise<{ imported: boolean; error?: string }> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: mode === 'encrypted' ? 'Verschlüsselte Datenbank importieren' : 'Datenbank importieren',
    filters: [
      mode === 'encrypted'
        ? { name: 'Verschlüsselte Datenbank', extensions: ['enc'] }
        : { name: 'SQLite Datenbank', extensions: ['db'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) {
    return { imported: false };
  }

  const sourceFile = filePaths[0];
  backupDatabase();
  closeDb();

  const targetPath = path.join(dataDir, 'employee.db');

  if (mode === 'encrypted') {
    const key = getEncryptionKey();
    if (!key) throw new Error('Kein Schlüssel');
    const payload = fs.readFileSync(sourceFile);
    if (payload.length < 28) throw new Error('Datei ist ungültig');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const content = payload.subarray(28);
    const data = decryptBuffer({ iv, tag, content }, key);
    fs.writeFileSync(targetPath, data);
  } else {
    fs.copyFileSync(sourceFile, targetPath);
  }

  openDatabase();
  return { imported: true };
};

const exportData = async (
  year: number,
  format: 'csv' | 'xlsx',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  const dataset = getYearDataset(year);
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: `Daten als ${ext.toUpperCase()} exportieren`,
    defaultPath: `mitarbeitende-${year}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });

  if (canceled || !filePath) {
    return { saved: false };
  }

  const rows = dataset.employees.map((emp) => ({
    Name: emp.name,
    Qualifikation: emp.qualification,
    VZÄ: emp.fte,
    Wochenstunden: emp.weeklyHours ?? '',
    'Start-Datum': emp.startDate,
    'End-Datum': emp.endDate ?? '',
    Status: emp.status,
    Notiz: emp.note ?? '',
    Datenquelle: emp.dataSource ?? '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Mitarbeitende');

  const writeToPath = (target: string) => {
    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
      fs.writeFileSync(target, csvContent, 'utf8');
    } else {
      XLSX.writeFile(wb, target);
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

// =============================================================================
// WINDOW & AUTO-UPDATER
// =============================================================================

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

// =============================================================================
// APP LIFECYCLE
// =============================================================================

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

// =============================================================================
// IPC HANDLERS
// =============================================================================

// App state
ipcMain.handle('app:state', (): AppState => ({
  configured: isConfigured(),
  unlocked,
}));

// Auto-updates
ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) {
    if (process.env.MOCK_UPDATE_BANNER === '1') {
      sendUpdateStatus({ state: 'available', version: 'dev-demo' });
      setTimeout(
        () => sendUpdateStatus({ state: 'downloading', version: 'dev-demo', progress: 42 }),
        300,
      );
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

// Authentication
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

  setEncryptionKey(keyBytes);
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

  setEncryptionKey(keyBytes);
  unlocked = true;
  openDatabase();
  return { configured: true, unlocked: true };
});

ipcMain.handle('auth:recoveryKey', (): { recoveryKey: string; fingerprint: string } => {
  const key = getEncryptionKey();
  if (!unlocked || !key) {
    throw new Error('Bitte zuerst anmelden.');
  }
  return {
    recoveryKey: key.toString('base64'),
    fingerprint: fingerprintKey(key),
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
      setEncryptionKey(keyBytes);
      unlocked = true;
      openDatabase();
    } catch (err) {
      setEncryptionKey(null);
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

// Data operations
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

ipcMain.handle(
  'data:export',
  async (_event, { year, format }: { year: number; format: 'csv' | 'xlsx' }) => {
    ensureDbReady();
    return exportData(year, format);
  },
);

ipcMain.handle('data:openDocument', async (_event, { path: filePath }: { path: string }) => {
  if (!filePath) return;
  await shell.openPath(filePath);
});

// Qualifications
ipcMain.handle('qualifications:list', () => listQualifications());
ipcMain.handle(
  'qualifications:add',
  (_event, { name, note }: { name: string; note?: string | null }) => addQualification(name, note),
);
ipcMain.handle(
  'qualifications:update',
  (_event, { id, name, note }: { id: number; name: string; note?: string | null }) =>
    updateQualification(id, name, note),
);
ipcMain.handle('qualifications:delete', (_event, { id }: { id: number }) => deleteQualification(id));
ipcMain.handle('qualifications:reorder', (_event, { ids }: { ids: number[] }) =>
  reorderQualifications(ids),
);

// Database management
ipcMain.handle('db:export', (_event, { mode }: { mode: 'encrypted' | 'plain' }) =>
  exportDatabase(mode),
);
ipcMain.handle('db:import', (_event, { mode }: { mode: 'encrypted' | 'plain' }) =>
  importDatabase(mode),
);
ipcMain.handle('period:delete', (_event, { periodId, year }: { periodId: number; year: number }) =>
  deletePeriod(periodId, year),
);

// Events
ipcMain.handle('events:list', (_event, { employeeId }: { employeeId: number }) =>
  listEvents(employeeId),
);
ipcMain.handle(
  'events:save',
  (
    _event,
    input: {
      id?: number;
      employeeId: number;
      eventDate: string;
      type: EmployeeEventType;
      title: string;
      details?: string | null;
      meta?: Record<string, unknown> | null;
    },
  ) => saveEvent(input),
);
ipcMain.handle('events:delete', (_event, { id, employeeId }: { id: number; employeeId: number }) =>
  deleteEvent(id, employeeId),
);

// App management
ipcMain.handle('db:delete', () => {
  ensureDataDir();
  deleteDatabase();
  return true;
});
ipcMain.handle('app:reset', () => resetApplication());
ipcMain.handle('settings:getBaseHours', () => getBaseHours());
ipcMain.handle('settings:setBaseHours', (_event, { hours }: { hours: number }) =>
  setBaseHours(hours),
);

// DEV: Raw table data - dynamically discovers all tables
ipcMain.handle('dev:tables', () => {
  if (!isDbOpen()) return {};
  const db = getDb();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  const result: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    result[name] = db.prepare(`SELECT * FROM "${name}"`).all();
  }
  return result;
});
