import { annualFteLabel } from '../shared/annualFte';
import type { YearDataset } from '../shared/types';
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
import {
  teilgruppeOf,
  hkpCodesOf,
  intensiveCareForList,
  isActivePatient,
  needsAssessment,
  serviceScopeOf,
} from '../utils/qpr';

/** Build the buffer ourselves and write it with Node's fs. */
export const writeWorkbook = (workbook: XLSX.WorkBook, target: string): void => {
  fs.writeFileSync(target, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
};

export type PersonListRow = {
  Name: string;
  'Bevollmächtigte / Betreuung (mit Telefon)': string;
  Teilgruppe: string;
  'Aufwändige HKP (Ziffer)': string;
  'AKI / pHKP': string;
};

/**
 * Personenliste nach Anlage 7 (QPR ambulant): alphabetical, one row per person,
 * with the Teilgruppe derived rather than stored. Blank cells are deliberate —
 * they are what the Vorbereitung checks tell you to fill in before the audit.
 */
export const buildPersonListRows = (patients: Patient[]): PersonListRow[] =>
  [...patients]
    .filter((p) => isActivePatient(p) && serviceScopeOf(p).scope !== 'excluded')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((patient) => {
      const group = needsAssessment(patient)
        ? null
        : teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
      return {
        Name: patient.name,
        'Bevollmächtigte / Betreuung (mit Telefon)': patient.contact ?? '',
        Teilgruppe: group == null ? '' : group === 'none' ? 'ohne' : group,
        'Aufwändige HKP (Ziffer)': hkpCodesOf(patient).join(', '),
        'AKI / pHKP': intensiveCareForList(patient),
      };
    });

export const buildPersonListWorkbook = (patients: Patient[]): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildPersonListRows(patients)),
    'Anlage 7',
  );
  return workbook;
};

/** The report and its individual rows travel together in the exported workbook. */
export const buildEmployeeWorkbook = (dataset: YearDataset, year: number): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  const annual = dataset.annualSummary;
  const reportMode = annual?.method ?? dataset.reportMode;
  const aggregation = annual?.aggregation ?? dataset.aggregation;
  const unverifiedCount = annual?.unverifiedHoursCount ?? dataset.unverifiedHoursCount;
  const summary: (string | number)[][] = [
    ['Berichtsjahr', reportMode === 'directory' ? 'Gesamtliste' : year],
    [
      'Auswertung',
      reportMode === 'directory'
        ? 'Gesamtliste aller Beschäftigten; letzter erfasster Stand, keine Jahreskennzahl'
        : reportMode === 'stichtag'
          ? `Stichtag 31.12.${year}`
          : reportMode === 'month-end-average'
            ? 'Durchschnitt aus 12 Monatsenden; Summe der gültigen Stellenanteile an den zwölf Monatsenden / 12; ohne gesonderte SGB-XI-Aufteilung'
          : reportMode === 'year-average'
            ? 'Taggewichteter Jahresdurchschnitt; inklusive Tage / Kalendertage des Jahres'
            : 'Im Jahr beschäftigt; letzter Stellenanteil des Jahres',
    ],
    ...(reportMode === 'month-end-average' ? [['Personenzählung', 'Unterschiedliche Personen an mindestens einem Monatsende, je Qualifikation einmal; kein Monatsdurchschnitt']] : []),
    ['Bezugswochenstunden', dataset.baseHours ?? 'nicht angegeben'],
    [
      'Betriebliche VZÄ-Regel',
      'Ab 36 Wochenstunden 1,0; darunter Anteil am Bezugswert, höchstens 1,0. Historische erfasste Stellenanteile sind maßgeblich.',
    ],
    [
      'Status',
      unverifiedCount
        ? `Vorläufig: ${unverifiedCount} unbestätigte Altwerte`
        : 'Erfasste Stellenanteile bestätigt',
    ],
    [
      'Fehlende Stellenanteile',
      dataset.employees.some((e) => annual ? e.annualFteMissing : e.hoursMissing)
        ? 'Unbekannte Abschnitte fehlen in der vorläufigen Summe; kein bestätigter Nullwert'
        : 'Alle Abschnitte mit erfasstem Stellenanteil',
    ],
    ...(annual ? [['Personen im Jahr beschäftigt', dataset.aggregation.totalHeadcount], ['Team-Liste', 'Eine Zeile je Person; Jahres-VZÄ über alle Abschnitte. Qualifikation und Wochenstunden zeigen den letzten Stand im Jahr. Qualifikationsgruppen im Jahresnachweis werden zeitanteilig zugeordnet.']] : []),
    ['Vertragsformular', 'Betrieblich zu prüfen'],
    [],
    ...(reportMode === 'directory'
      ? [['Personen gesamt', aggregation.totalHeadcount]]
      : [
          ['Qualifikation', reportMode === 'month-end-average' ? 'Personen an Monatsenden' : 'Personen', 'VZÄ'],
          ...aggregation.categories.map((c) => [c.qualification, c.headcount, c.fte]),
          ['Gesamt', aggregation.totalHeadcount, aggregation.totalFte],
        ]),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'Jahresnachweis');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      dataset.employees.map((e) => ({
        Name: e.name,
        Qualifikation: e.qualification,
        VZÄ: (annual ? e.annualFteMissing : e.hoursMissing) ? '' : (e.annualFte ?? e.fte),
        ...(annual ? {
          'Berechnung Jahres-VZÄ': annualFteLabel(annual.method),
          'Stellenanteil letzter Stand im Jahr': e.hoursMissing ? '' : e.fte,
          'Stand Qualifikation und Wochenstunden': 'Letzter erfasster Stand im Jahr',
        } : {}),
        'Ungewichteter Stellenanteil': e.unweightedFte ?? '',
        ...(annual ? {} : reportMode === 'month-end-average'
          ? { 'Berücksichtigte Monatsenden': e.reportMonthEnds?.join(', ') ?? '',
              'Anzahl Monatsenden': e.reportMonthEnds?.length ?? 0 }
          : { 'Kalendertage im Abschnitt': e.reportDays ?? '' }),
        Wochenstunden: e.weeklyHours ?? '',
        Eintritt: e.employmentStartDate,
        'Beginn Abschnitt': e.startDate,
        'Ende Abschnitt': e.endDate ?? '',
        Personalbeleg: e.sourceRef ?? '',
        'Stellenanteil gültig ab': e.hoursEffectiveFrom ?? '',
        'Stellenanteil bestätigt': (annual ? e.annualFteVerified : e.hoursVerified) ? 'Ja' : 'Ungeprüfter oder fehlender Wert',
        Notiz: e.note ?? '',
      })),
    ),
    'Team',
  );
  return workbook;
};
