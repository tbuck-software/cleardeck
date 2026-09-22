// @vitest-environment node
import { getAnnualFteMethod, setAnnualFteMethod } from '../repositories/settings';
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { getYearDataset, saveEmployee } from '../repositories/employees';
import { saveWorkingTime } from '../repositories/workingTimes';
import { buildEmployeeWorkbook } from '../workbook';
import * as XLSX from 'xlsx';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));
let db: SqliteAdapter;
const base = { name: 'Beispiel Person', qualification: 'Pflegefachkraft', startDate: '2025-01-01', weeklyHours: 28.8, fte: 0.8, year: 2025 };
const report = (year = 2025) => getYearDataset(year, 'month-end-average');
const rawFte = (year = 2025) => report(year).employees.reduce((sum, row) => sum + row.fte, 0);
beforeEach(() => { db = new SqliteAdapter(':memory:'); state.db = db; runMigrations(db as never); });
afterEach(() => db.close());

it('averages two months at 80 percent and ten at full time, preserving daily and snapshot alternatives', () => {
  const person = saveEmployee(base).employees[0];
  saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1 });
  expect(rawFte()).toBeCloseTo((2 * 0.8 + 10) / 12, 12);
  expect(report().aggregation).toMatchObject({ totalHeadcount: 1, totalFte: 0.97 });
  expect(report().employees.map(row => row.reportMonthEnds?.length)).toEqual([2, 10]);
  expect(getYearDataset(2025, 'year-average').employees.reduce((sum, row) => sum + row.fte, 0))
    .toBeCloseTo((59 * 0.8 + 306) / 365, 12);
  expect(getYearDataset(2025, 'stichtag').aggregation.totalFte).toBe(1);
});

it('uses the new hours on the month end itself, including a leap day', () => {
  const person = saveEmployee({ ...base, startDate: '2023-12-01', year: 2024 }).employees[0];
  saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2024-02-29', weeklyHours: 36, fte: 1 });
  expect(rawFte(2024)).toBeCloseTo((0.8 + 11) / 12, 12);
  expect(report(2024).employees[0].reportMonthEnds).toEqual(['2024-01-31']);
  expect(report(2024).employees[1].reportMonthEnds?.[0]).toBe('2024-02-29');
  expect(report(2024).employees[1].reportMonthEnds?.slice(-1)[0]).toBe('2024-12-31');
});

it('includes entry and departure on month end, excludes short periods between month ends and divides by twelve', () => {
  saveEmployee({ ...base, startDate: '2025-02-28', endDate: '2025-03-31', fte: 1, weeklyHours: 36 });
  saveEmployee({ ...base, name: 'Kurzer Einsatz', startDate: '2025-04-01', endDate: '2025-04-29', fte: 1 });
  expect(rawFte()).toBeCloseTo(2 / 12, 12);
  expect(report().aggregation.totalHeadcount).toBe(1);
  expect(report().employees[0].reportMonthEnds).toEqual(['2025-02-28', '2025-03-31']);
  expect(getYearDataset(2025, 'year-average').aggregation.totalHeadcount).toBe(2);
});

it('splits qualifications at month ends but counts the person only once in total', () => {
  const person = saveEmployee({ ...base, qualification: 'Pflegehilfe', endDate: '2025-06-29', fte: 1 }).employees[0];
  saveEmployee({ ...base, id: person.id, startDate: '2025-06-30', qualification: 'Pflegefachkraft', fte: 1 });
  expect(report().aggregation).toMatchObject({ totalHeadcount: 1, totalFte: 1 });
  expect(report().aggregation.categories).toEqual(expect.arrayContaining([
    { qualification: 'Pflegehilfe', headcount: 1, fte: 0.42 },
    { qualification: 'Pflegefachkraft', headcount: 1, fte: 0.58 },
  ]));
});

it('keeps missing and unverified month-end values visible without treating them as verified zero', () => {
  const person = saveEmployee(base).employees[0];
  db.prepare('DELETE FROM employment_terms WHERE periodId=?').run(person.periodId);
  saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 0, fte: 0 });
  let result = report();
  expect(result.employees[0]).toMatchObject({ hoursMissing: true, hoursVerified: false, reportMonthEnds: ['2025-01-31', '2025-02-28'] });
  expect(result.employees[1]).toMatchObject({ hoursMissing: false, hoursVerified: true, unweightedFte: 0 });
  expect(result.unverifiedHoursCount).toBe(1);
  db.prepare('UPDATE employment_terms SET verified=0 WHERE periodId=?').run(person.periodId);
  result = report();
  expect(result.unverifiedHoursCount).toBe(2);
});

it('does not flag missing hours before the first counted month end', () => {
  const person = saveEmployee(base).employees[0];
  db.prepare('DELETE FROM employment_terms WHERE periodId=?').run(person.periodId);
  saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-01-31', weeklyHours: 36, fte: 1 });
  expect(report().unverifiedHoursCount).toBe(0);
  expect(report().employees).toHaveLength(1);
  expect(rawFte()).toBe(1);
});

it('exports the formula, person-count meaning and exact month ends with the report values', () => {
  saveEmployee({ ...base, startDate: '2025-02-28', endDate: '2025-03-31' });
  const dataset = report();
  const workbook = buildEmployeeWorkbook(dataset, 2025);
  const summary = XLSX.utils.sheet_to_json(workbook.Sheets.Jahresnachweis, { header: 1 });
  expect(summary).toContainEqual(['Gesamt', 1, 0.13]);
  expect(summary).toContainEqual(['Qualifikation', 'Personen an Monatsenden', 'VZÄ']);
  expect(summary).toContainEqual(['Auswertung', expect.stringContaining('/ 12')]);
  expect(XLSX.utils.sheet_to_json(workbook.Sheets.Team)).toEqual([
    expect.objectContaining({ 'Berücksichtigte Monatsenden': '2025-02-28, 2025-03-31', 'Anzahl Monatsenden': 2, VZÄ: dataset.employees[0].fte }),
  ]);
});


describe('saved annual FTE method', () => {
  it('defaults to month ends, persists the alternative, and rejects invalid values', () => {
    expect(getAnnualFteMethod()).toBe('month-end-average');
    setAnnualFteMethod('year-average');
    expect(db.prepare("SELECT value FROM settings WHERE key='annualFteMethod'").get()).toEqual({ value: 'year-average' });
    expect(getYearDataset(2025).annualSummary?.method).toBe('year-average');
    expect(() => setAnnualFteMethod('invalid' as never)).toThrow('Ungültige');
    expect(getAnnualFteMethod()).toBe('year-average');
  });

  it('keeps working-time snapshots separate and exports the same annual contributions as the year table', () => {
    const person = saveEmployee(base).employees[0];
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1 });
    for (const method of ['month-end-average', 'year-average'] as const) {
      setAnnualFteMethod(method);
      const dataset = getYearDataset(2025);
      const expected = method === 'month-end-average' ? (2 * 0.8 + 10) / 12 : (59 * 0.8 + 306) / 365;
      expect(dataset.employees[0]).toMatchObject({ fte: 1, weeklyHours: 36, annualFteMissing: false, annualFteVerified: true });
      expect(dataset.employees[0].annualFte).toBeCloseTo(expected, 12);
      expect(dataset.annualSummary?.aggregation).toEqual(getYearDataset(2025, method).aggregation);
      const workbook = buildEmployeeWorkbook(dataset, 2025);
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.Team);
      expect(rows[0].VZÄ).toBeCloseTo(expected, 12);
      expect(rows[0]['Stellenanteil letzter Stand im Jahr']).toBe(1);
      expect(rows[0]['Berechnung Jahres-VZÄ']).toContain(method === 'month-end-average' ? 'Monatsenden' : 'Taggewichteter');
      expect(XLSX.utils.sheet_to_csv(workbook.Sheets.Team)).toContain('Berechnung Jahres-VZÄ');
      expect(XLSX.utils.sheet_to_json(workbook.Sheets.Jahresnachweis, { header: 1 })).toContainEqual(['Gesamt', 1, 0.97]);
      expect(getYearDataset(2025, 'directory').employees[0]).toMatchObject({ fte: 1 });
      expect(getYearDataset(2025, 'directory').annualSummary).toBeUndefined();
    }
  });

  it('retains short employment in the year list with zero monthly contribution and keeps report overrides local', () => {
    saveEmployee({ ...base, startDate: '2025-04-01', endDate: '2025-04-29', fte: 1 });
    expect(getYearDataset(2025).employees[0]).toMatchObject({ annualFte: 0, fte: 1, annualFteMissing: false });
    expect(getYearDataset(2025).aggregation.totalHeadcount).toBe(1);
    expect(getYearDataset(2025).annualSummary?.aggregation.totalHeadcount).toBe(0);
    expect(getYearDataset(2025, 'year-average').aggregation.totalFte).toBe(0.08);
    expect(getAnnualFteMethod()).toBe('month-end-average');
    setAnnualFteMethod('year-average');
    expect(getYearDataset(2025).employees[0].annualFte).toBeCloseTo(29 / 365, 12);
  });

  it('assigns historical qualification contributions rather than grouping the latest working-time snapshots', () => {
    const person = saveEmployee({ ...base, qualification: 'Pflegehilfe', endDate: '2025-06-29', fte: 1 }).employees[0];
    saveEmployee({ ...base, id: person.id, startDate: '2025-06-30', qualification: 'Pflegefachkraft', fte: 1 });
    const dataset = getYearDataset(2025);
    expect(dataset.employees).toHaveLength(1);
    expect(dataset.employees[0]).toMatchObject({ qualification: 'Pflegefachkraft', annualFte: 1 });
    expect(dataset.annualSummary?.aggregation.categories).toEqual(expect.arrayContaining([
      { qualification: 'Pflegehilfe', headcount: 1, fte: 0.42 },
      { qualification: 'Pflegefachkraft', headcount: 1, fte: 0.58 },
    ]));
  });

  it('flags missing historical hours even when the latest working-time snapshot is complete', () => {
    const person = saveEmployee(base).employees[0];
    db.prepare('DELETE FROM employment_terms WHERE periodId=?').run(person.periodId);
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1 });
    const dataset = getYearDataset(2025);
    expect(dataset.employees[0]).toMatchObject({ hoursMissing: false, hoursVerified: true, annualFteMissing: true, annualFteVerified: false });
    expect(dataset.annualSummary?.unverifiedHoursCount).toBe(1);
    const workbook = buildEmployeeWorkbook(dataset, 2025);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Team)[0]).toMatchObject({ VZÄ: '' });
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Jahresnachweis, { header: 1 })).toContainEqual(['Fehlende Stellenanteile', expect.stringContaining('vorläufigen Summe')]);
  });
});
