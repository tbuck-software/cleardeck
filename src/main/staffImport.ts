import fs from 'fs';
import path from 'path';
import { dialog } from 'electron';
import * as XLSX from 'xlsx';
import type { StaffImportPreview, StaffImportRow } from '../shared/staffImport';
import { requireDate, validDate } from '../utils/calendarDate';
import { getDb, backupDatabase } from './database/connection';
import { saveEmployee } from './repositories/employees';

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('de')
    .replace(/[.\s/_-]+/g, '');
const numberOf = (value: string): number => Number(value.trim().replace(',', '.'));
const dateOf = (value: unknown): string => {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return date
      ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
      : String(value);
  }
  const text = String(value ?? '').trim();
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  return de ? `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}` : text;
};

export const importRowIssues = (row: StaffImportRow): string[] => {
  const issues: string[] = [];
  if (!row.name.trim()) issues.push('Name fehlt');
  if (!row.qualification.trim()) issues.push('Qualifikation fehlt');
  if (!validDate(row.startDate)) issues.push('Gültiger Beginn fehlt');
  if (row.endDate && (!validDate(row.endDate) || row.endDate < row.startDate))
    issues.push('Ende prüfen');
  if (row.birthDate && !validDate(row.birthDate)) issues.push('Geburtsdatum prüfen');
  if (
    !row.weeklyHours.trim() ||
    !Number.isFinite(numberOf(row.weeklyHours)) ||
    numberOf(row.weeklyHours) < 0 ||
    numberOf(row.weeklyHours) > 168
  )
    issues.push('Wochenstunden fehlen oder sind ungültig');
  if (
    !row.fte.trim() ||
    !Number.isFinite(numberOf(row.fte)) ||
    numberOf(row.fte) < 0 ||
    numberOf(row.fte) > 1
  )
    issues.push('VZÄ prüfen');
  return issues;
};

/** Parse values only. Macros and formula text are never executed. */
export const parseStaffImport = (buffer: Buffer, source: string): StaffImportPreview => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, bookVBA: false });
  const sheet = workbook.SheetNames[0];
  if (!sheet) throw new Error('Keine Tabelle vorhanden.');
  const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], {
    header: 1,
    raw: true,
    defval: '',
  });
  const headerIndex = grid
    .slice(0, 10)
    .findIndex((row) =>
      row.some((c) =>
        ['name', 'mitarbeiter', 'mitarbeitende', 'mitarbeitername', 'vorundnachname'].includes(
          normalize(c),
        ),
      ),
    );
  if (headerIndex < 0)
    throw new Error(
      'Erste Tabelle braucht eine Kopfzeile mit Name, Qualifikation, Eintritt/Beginn und Wochenstunden.',
    );
  const headers = grid[headerIndex].map(normalize);
  const index = (...names: string[]) => headers.findIndex((h) => names.map(normalize).includes(h));
  const columns = {
    name: index('Name', 'Mitarbeiter', 'Mitarbeitende', 'Mitarbeitername', 'Vor- und Nachname'),
    qualification: index('Qualifikation'),
    start: index('Eintritt', 'Eintrittsdatum', 'Beginn', 'StartDate'),
    end: index('Austritt', 'Austrittsdatum', 'Ende', 'EndDate'),
    hours: index('Wochenstunden', 'Arbeitsstunden', 'Stunden'),
    birth: index('Geburtsdatum'),
  };
  const rows: StaffImportRow[] = [];
  grid.slice(headerIndex + 1).forEach((values, i) => {
    const get = (column: number) => (column < 0 ? '' : (values[column] ?? ''));
    if (!String(get(columns.name)).trim()) return;
    const weeklyHours = String(get(columns.hours)).trim();
    const hours = numberOf(weeklyHours);
    const row: StaffImportRow = {
      rowNumber: headerIndex + i + 2,
      name: String(get(columns.name)).trim(),
      qualification: String(get(columns.qualification)).trim(),
      startDate: dateOf(get(columns.start)),
      endDate: dateOf(get(columns.end)),
      birthDate: dateOf(get(columns.birth)),
      weeklyHours,
      // Source VZÄ may already be time-weighted. Only constant unweighted values belong in a term.
      fte:
        weeklyHours && Number.isFinite(hours)
          ? String(Number((Math.min(hours, 36) / 36).toFixed(4)))
          : '',
      sourceRef: `${path.basename(source)} · ${sheet} · Zeile ${headerIndex + i + 2}`,
      selected: true,
      issues: [],
    };
    row.issues = importRowIssues(row);
    row.selected = row.issues.length === 0;
    rows.push(row);
  });
  if (rows.length > 5000) throw new Error('Bitte höchstens 5000 Personen pro Übernahme auswählen.');
  return { source: path.basename(source), rows };
};

export const chooseStaffImport = async (): Promise<StaffImportPreview | null> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Mitarbeiterliste zur Prüfung öffnen',
    properties: ['openFile'],
    filters: [{ name: 'Tabellen', extensions: ['xlsx', 'csv'] }],
  });
  if (canceled || !filePaths[0]) return null;
  const preview = parseStaffImport(fs.readFileSync(filePaths[0]), filePaths[0]);
  const db = getDb();
  const seen = new Set<string>();
  for (const row of preview.rows) {
    if (seen.has(row.name.toLowerCase()))
      row.issues.push(
        'Mehrere Zeilen gleichen Namens: Identität und Zeitabschnitte getrennt prüfen',
      );
    if (db.prepare('SELECT id FROM employees WHERE LOWER(name)=LOWER(?)').get(row.name))
      row.issues.push('Name vorhanden: bestehende Person ausdrücklich zuordnen');
    seen.add(row.name.toLowerCase());
    row.selected = row.issues.length === 0;
  }
  return preview;
};

/** Commit only explicitly selected, reviewed rows in one transaction. */
export const commitStaffImport = (
  rows: StaffImportRow[],
): { imported: number; safetyPath: string } => {
  const selected = rows.filter((row) => row.selected);
  if (!selected.length) throw new Error('Keine Zeilen ausgewählt.');
  if (selected.length > 5000) throw new Error('Zu viele Zeilen.');
  const db = getDb();
  const names = new Set<string>();
  for (const row of selected) {
    const issues = importRowIssues(row);
    if (issues.length) throw new Error(`Zeile ${row.rowNumber}: ${issues.join('; ')}`);
    if (
      !row.employeeId &&
      (names.has(normalize(row.name)) ||
        db.prepare('SELECT id FROM employees WHERE LOWER(name)=LOWER(?)').get(row.name.trim()))
    )
      throw new Error(
        `Zeile ${row.rowNumber}: vorhandene oder doppelte Person ausdrücklich zuordnen.`,
      );
    names.add(normalize(row.name));
    requireDate(row.startDate);
  }
  const safetyPath = backupDatabase();
  db.transaction(() => {
    for (const row of selected) {
      const period = row.employeeId
        ? (db
            .prepare(
              "SELECT id FROM employment_periods WHERE employeeId=? AND startDate=? AND COALESCE(endDate,'')=?",
            )
            .get(row.employeeId, row.startDate, row.endDate) as { id: number } | undefined)
        : undefined;
      const existing = row.employeeId
        ? (db.prepare('SELECT note FROM employees WHERE id=?').get(row.employeeId) as
            | { note: string | null }
            | undefined)
        : undefined;
      saveEmployee({
        note: existing?.note ?? undefined,
        id: row.employeeId,
        periodId: period?.id,
        name: row.name,
        qualification: row.qualification,
        startDate: row.startDate,
        endDate: row.endDate || null,
        weeklyHours: numberOf(row.weeklyHours),
        fte: numberOf(row.fte),
        birthDate: row.birthDate || undefined,
        sourceRef: row.sourceRef,
        hoursEffectiveFrom: row.startDate,
        hoursVerified: false,
        year: new Date().getFullYear(),
      });
      if (
        !db.prepare('SELECT id FROM qualification_types WHERE name=?').get(row.qualification.trim())
      )
        db.prepare('INSERT INTO qualification_types(name) VALUES (?)').run(
          row.qualification.trim(),
        );
    }
  })();
  return { imported: selected.length, safetyPath };
};
