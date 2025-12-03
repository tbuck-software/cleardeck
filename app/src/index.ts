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
    throw new Error('Verschluesseltes Datenpaket ist ungueltig.');
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
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      qualification TEXT NOT NULL,
      dataSource TEXT,
      note TEXT,
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
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_periods_employee ON employment_periods(employeeId);
    CREATE INDEX IF NOT EXISTS idx_periods_dates ON employment_periods(startDate, endDate);
  `);

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
        qualification: '3-jaehrig examiniert',
        dataSource: 'Verwaltungssoftware',
        note: 'Teamleitung 1',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(anna, '2021-05-01', null, 1.0, '3-jaehrig examiniert');

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
        qualification: '1-jaehrig examiniert',
        dataSource: 'Verwaltungssoftware',
        note: 'Fortbildung Wundmanagement',
        documentPath: '',
      }).lastInsertRowid as number;
      period.run(lisa, '2023-11-01', null, 0.8, '1-jaehrig examiniert');
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

  const rows = db
    .prepare(
      `
      SELECT e.id as employeeId,
             e.name,
             e.qualification as baseQualification,
             e.dataSource,
             e.note,
             e.documentPath,
             p.id as periodId,
             p.startDate,
             p.endDate,
             p.fte,
             COALESCE(p.qualification, e.qualification) as qualification
      FROM employees e
      INNER JOIN employment_periods p ON p.employeeId = e.id
      WHERE date(p.startDate) <= date(@endIso)
        AND (p.endDate IS NULL OR date(p.endDate) >= date(@startIso))
      ORDER BY e.id ASC, p.startDate DESC;
    `,
    )
    .all({ startIso, endIso }) as (Employee &
      EmploymentPeriod & { employeeId: number; periodId: number })[];

  const latest = new Map<number, EmployeeWithPeriod>();
  rows.forEach((row) => {
    const current = latest.get(row.employeeId);
    if (!current || new Date(row.startDate) > new Date(current.startDate)) {
      latest.set(row.employeeId, {
        id: row.employeeId,
        name: row.name,
        qualification: row.qualification,
        dataSource: row.dataSource ?? undefined,
        note: row.note ?? undefined,
        documentPath: row.documentPath ?? undefined,
        startDate: row.startDate,
        endDate: row.endDate ?? null,
        fte: row.fte,
        status: computeStatus(row.startDate, row.endDate ?? null, year),
        periodId: row.periodId,
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
      SELECT id, startDate, endDate, fte, qualification
      FROM employment_periods
      WHERE employeeId = ?
      ORDER BY startDate DESC;
    `,
    )
    .all(employeeId) as EmploymentPeriod[];
  return rows;
};

const saveEmployee = (input: {
  id?: number;
  periodId?: number;
  name: string;
  qualification: string;
  dataSource?: string;
  note?: string;
  documentPath?: string;
  startDate: string;
  endDate?: string | null;
  fte: number;
  year: number;
}): YearDataset => {
  ensureDbReady();
  const mutation = db.transaction(() => {
    const employeePayload: Employee = {
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
        'UPDATE employment_periods SET startDate = ?, endDate = ?, fte = ?, qualification = ? WHERE id = ? AND employeeId = ?',
      ).run(input.startDate, input.endDate ?? null, input.fte, input.qualification, input.periodId, employeeId);
    } else {
      db.prepare(
        'INSERT INTO employment_periods (employeeId, startDate, endDate, fte, qualification) VALUES (?, ?, ?, ?, ?)',
      ).run(employeeId, input.startDate, input.endDate ?? null, input.fte, input.qualification);
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
      const header = 'Name;Qualifikation;Eintritt;Austritt;FTE/VZAE;Status;Quelle;Dokument\n';
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
          'FTE/VZAE': row.fte,
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
          'FTE/VZAE': cat.fte,
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
        : 'Export konnte nicht gespeichert werden. Bitte Pfad/Schreibrechte pruefen.';
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
