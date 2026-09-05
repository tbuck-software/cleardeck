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
  getDataDir,
  getEncryptionKey,
} from './database/connection';
import { encryptBuffer, decryptBuffer } from './crypto';
import { getYearDataset } from './repositories/employees';
import { listPatients } from './repositories/patients';
import { teilgruppeOf } from '../utils/qpr';
import { buildPersonListWorkbook, writeWorkbook } from './workbook';

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

  try {
    // SQLite's online backup is asynchronous: without awaiting it, the file is
    // read back — and for the encrypted mode overwritten — while still being
    // written, which silently produces a truncated export.
    await getDb().backup(filePath);

    if (mode === 'encrypted') {
      const key = getEncryptionKey();
      if (!key) throw new Error('Kein Schlüssel vorhanden. Bitte zuerst anmelden.');
      const payload = encryptBuffer(fs.readFileSync(filePath), key);
      fs.writeFileSync(filePath, Buffer.concat([payload.iv, payload.tag, payload.content]));
    }
  } catch (err) {
    // A half-written export is worse than none: it looks like a usable backup.
    fs.rmSync(filePath, { force: true });
    const message = err instanceof Error ? err.message : 'Der Export ist fehlgeschlagen.';
    dialog.showErrorBox('Export fehlgeschlagen', message);
    return { saved: false, error: message };
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

  const targetPath = path.join(getDataDir(), 'employee.db');

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
    defaultPath: `team-${year}.${ext}`,
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
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Team');

  const writeToPath = (target: string) => {
    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
      fs.writeFileSync(target, csvContent, 'utf8');
    } else {
      writeWorkbook(wb, target);
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

/**
 * Personenliste nach Anlage 7 (QPR ambulant).
 *
 * Alphabetical, all people receiving §§ 36/39 SGB XI or §§ 37/37c SGB V
 * services: name, Bevollmächtigte/Betreuung with phone, Teilgruppe A/B/C,
 * aufwändige HKP with its code, AKI/pHKP. Handed to the MD at the start of
 * the inspection, so blanks here are the gaps worth seeing before then.
 */
export const exportPersonList = async (): Promise<{
  saved: boolean;
  filePath?: string;
  error?: string;
  total?: number;
  withoutGroup?: number;
}> => {
  const patients = listPatients();
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Personenliste (Anlage 7) exportieren',
    defaultPath: `Personenliste-Anlage-7-${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'XLSX', extensions: ['xlsx'] }],
  });

  if (canceled || !filePath) {
    return { saved: false };
  }

  const workbook = buildPersonListWorkbook(patients);

  try {
    writeWorkbook(workbook, filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export fehlgeschlagen.';
    dialog.showErrorBox('Export fehlgeschlagen', message);
    return { saved: false, error: message };
  }

  return {
    saved: true,
    filePath,
    total: patients.length,
    withoutGroup: patients.filter(
      (patient) => teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) == null,
    ).length,
  };
};
