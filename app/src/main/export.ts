/**
 * Export & Import Functions
 *
 * Handles database export/import and data export to CSV/XLSX.
 */

import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

import {
  getDb,
  openDatabase,
  closeDb,
  backupDatabase,
  dataDir,
  getEncryptionKey,
} from './database/connection';
import { encryptBuffer, decryptBuffer } from './crypto';
import { getYearDataset } from './repositories/employees';

/**
 * Export the database (encrypted or plain)
 */
export const exportDatabase = async (
  mode: 'encrypted' | 'plain',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title:
      mode === 'encrypted'
        ? 'Datenbank verschlüsselt exportieren'
        : 'Datenbank unverschlüsselt exportieren',
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

/**
 * Import a database (encrypted or plain)
 */
export const importDatabase = async (
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

/**
 * Export employee data to CSV or XLSX
 */
export const exportData = async (
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
