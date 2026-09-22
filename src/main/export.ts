import { localDate } from '../utils/calendarDate';
/**
 * Export & Import Functions
 *
 * Handles database export/import and data export to CSV/XLSX.
 */

import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

import { getDb, getEncryptionKey, isRemoteDatabase } from './database/connection';
import { encodeBackup } from './backupFormat';
import { writeAtomic } from './atomicFile';
import { restoreBackup } from './backup';
import { getYearDataset } from './repositories/employees';
import { listPatients } from './repositories/patients';
import {
  teilgruppeOf,
  isActivePatient,
  needsAssessment,
  representativeMissing,
  serviceScopeOf,
} from '../utils/qpr';
import { buildPersonListWorkbook, buildEmployeeWorkbook, writeWorkbook } from './workbook';

/**
 * Export the database (encrypted or plain)
 */
export const exportDatabase = async (
  mode: 'encrypted' | 'plain',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  if (isRemoteDatabase() && mode === 'encrypted') {
    throw new Error('Für den Serverbestand bitte eine SQLite-Datei exportieren. Die Geräteverschlüsselung eignet sich nicht für übertragbare Sicherungen.');
  }
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
    const key = mode === 'encrypted' ? getEncryptionKey() : null;
    if (mode === 'encrypted' && !key)
      throw new Error('Für einen verschlüsselten Export zuerst die Verschlüsselung aktivieren.');
    writeAtomic(
      filePath,
      mode === 'plain' ? getDb().serialize() : encodeBackup(getDb().serialize(), key),
    );
  } catch (err) {
    // A half-written export is worse than none: it looks like a usable backup.
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
  _mode: 'encrypted' | 'plain',
  recoveryKey?: string,
): Promise<{ imported: boolean; error?: string; backupPath?: string }> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'ClearDeck-Sicherung wählen',
    filters: [{ name: 'ClearDeck / SQLite', extensions: ['cdb', 'enc', 'db'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { imported: false };
  const result = await restoreBackup(filePaths[0], recoveryKey);
  return { imported: result.saved, error: result.error, backupPath: result.safetyPath };
};

/**
 * Export employee data to CSV or XLSX
 */
export const exportData = async (
  year: number,
  format: 'csv' | 'xlsx',
  mode: 'year' | 'stichtag' | 'current' | 'year-average' | 'month-end-average' | 'directory' = 'year',
): Promise<{ saved: boolean; filePath?: string; error?: string }> => {
  const dataset = getYearDataset(year, mode);
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: `Daten als ${ext.toUpperCase()} exportieren`,
    defaultPath: `team-${year}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });

  if (canceled || !filePath) {
    return { saved: false };
  }

  const wb = buildEmployeeWorkbook(dataset, year);
  const ws = wb.Sheets.Team;

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
  const active = listPatients().filter((p) => isActivePatient(p));
  const unknown = active.filter((p) => serviceScopeOf(p).scope === 'unknown');
  if (unknown.length)
    return {
      saved: false,
      error: `Für ${unknown.length} aktive Personen sind die Leistungen noch nicht erfasst. In den Stammdaten die erbrachten Leistungen auswählen, bevor die Anlage-7-Liste exportiert wird.`,
    };
  const patients = active.filter((p) => serviceScopeOf(p).scope === 'eligible');
  const incomplete = patients.filter(
    (p) =>
      needsAssessment(p) ||
      representativeMissing(p) ||
      (p.intensiveCare?.startsWith('AKI') && !p.akiSetting) ||
      (p.phkpFirst && !p.phkpStartDate),
  );
  if (incomplete.length)
    return {
      saved: false,
      error: `Angaben für ${incomplete.length} Personen unvollständig: Einstufungsquelle/-datum, Vertretung oder AKI/pHKP prüfen.`,
    };
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Personenliste (Anlage 7) exportieren',
    defaultPath: `Personenliste-Anlage-7-${localDate()}.xlsx`,
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
