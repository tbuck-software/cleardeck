/**
 * Workbook building and writing.
 *
 * Kept free of Electron imports so the row mapping and the write path can be
 * tested directly — the write in particular, because XLSX.writeFile() looks up
 * its own fs handle through a dynamic require that webpack strips when it
 * bundles the main process, and then fails with "cannot save file".
 */

import fs from 'fs';
import * as XLSX from 'xlsx';

import type { Patient } from '../shared/types';
import { HKP_LABEL, INTENSIVE_CARE_LABEL, teilgruppeOf } from '../utils/qpr';

/** Build the buffer ourselves and write it with Node's fs. */
export const writeWorkbook = (workbook: XLSX.WorkBook, target: string): void => {
  fs.writeFileSync(target, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
};

export type PersonListRow = {
  Name: string;
  Geburtsdatum: string;
  'Bevollmächtigte / Betreuung (mit Telefon)': string;
  Teilgruppe: string;
  'Aufwändige HKP (Ziffer)': string;
  'Aufwändige HKP (Leistung)': string;
  'AKI / pHKP': string;
  Pflegegrad: string;
};

/**
 * Personenliste nach Anlage 7 (QPR ambulant): alphabetical, one row per person,
 * with the Teilgruppe derived rather than stored. Blank cells are deliberate —
 * they are what the Vorbereitung checks tell you to fill in before the audit.
 */
export const buildPersonListRows = (patients: Patient[]): PersonListRow[] =>
  [...patients]
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((patient) => {
      const group = teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
      return {
        Name: patient.name,
        Geburtsdatum: patient.birthDate ?? '',
        'Bevollmächtigte / Betreuung (mit Telefon)': patient.contact ?? '',
        Teilgruppe: group == null ? '' : group === 'none' ? 'ohne' : group,
        'Aufwändige HKP (Ziffer)': patient.hkpCode ?? '',
        'Aufwändige HKP (Leistung)': patient.hkpCode ? HKP_LABEL[patient.hkpCode] : '',
        'AKI / pHKP': patient.intensiveCare ? INTENSIVE_CARE_LABEL[patient.intensiveCare] : '',
        Pflegegrad: patient.careLevel != null ? String(patient.careLevel) : '',
      };
    });

export const buildPersonListWorkbook = (patients: Patient[]): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildPersonListRows(patients)), 'Anlage 7');
  return workbook;
};
