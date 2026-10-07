/// <reference types="vitest/globals" />
// @vitest-environment node
import * as XLSX from 'xlsx';
import SqliteAdapter from './sqliteAdapter';
import { migrations, runMigrations } from '../database/migrations';
import { getYearDataset, listPeriods, saveEmployee } from '../repositories/employees';
import { switchQualification } from '../repositories/employmentActions';
import { buildEmployeeWorkbook } from '../workbook';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));
let db: SqliteAdapter;
const nurse = { name: 'Paula Pflege', qualification: 'Pflegefachkraft', startDate: '2025-01-01', weeklyHours: 36, fte: 1, year: 2025 };
const trainee = { name: 'Alex Azubi', qualification: 'Auszubildende Pflegefachkraft', startDate: '2025-01-01', weeklyHours: 24, fte: 0.67, year: 2025 };
beforeEach(() => { db = new SqliteAdapter(':memory:'); state.db = db; runMigrations(db as never); });
afterEach(() => db.close());

it('does not backfill trainees when upgrading an existing database', () => {
  const old = new SqliteAdapter(':memory:');
  migrations.filter((migration) => migration.version <= 24).forEach((migration) => migration.up(old as never));
  old.prepare("INSERT INTO settings(key,value) VALUES ('schema_version','24')").run();
  old.prepare("INSERT INTO employees(id,name,fte) VALUES (1,'Alt Azubi',0.67)").run();
  old.prepare("INSERT INTO employment_periods(id,employeeId,startDate,qualification) VALUES (1,1,'2024-08-01','Azubi')").run();
  runMigrations(old as never);
  expect(old.prepare('SELECT excludeFromFteTotal FROM employment_periods').get()).toEqual({ excludeFromFteTotal: 0 });
  expect(() => migrations.find((migration) => migration.version === 25)!.up(old as never)).not.toThrow();
  old.close();
});

it('leaves excluded periods out of totals but keeps their own FTE visible', () => {
  saveEmployee(nurse);
  saveEmployee({ ...trainee, excludeFromFteTotal: true });
  const stichtag = getYearDataset(2025, 'stichtag');
  expect(stichtag.aggregation).toMatchObject({ totalHeadcount: 2, totalFte: 1, excludedFte: 0.67, excludedHeadcount: 1 });
  expect(stichtag.aggregation.categories).toContainEqual({
    qualification: trainee.qualification, headcount: 1, fte: 0, excludedFte: 0.67,
  });
  expect(stichtag.employees.find((e) => e.name === trainee.name)).toMatchObject({ fte: 0.67, excludeFromFteTotal: true });

  const year = getYearDataset(2025);
  expect(year.annualSummary?.aggregation).toMatchObject({ totalFte: 1, excludedFte: 0.67 });
  expect(year.employees.find((e) => e.name === trainee.name)).toMatchObject({ annualFte: 0.67, annualFteExcluded: 0.67 });
});

it('changes the flag only when the save says so', () => {
  const created = saveEmployee({ ...trainee, excludeFromFteTotal: true }).employees[0];
  const edit = { ...trainee, id: created.id, periodId: created.periodId, updateHours: false };
  saveEmployee({ ...edit, name: 'Alex Azubi-Neu' });
  expect(getYearDataset(2025, 'stichtag').employees[0].excludeFromFteTotal).toBe(true);
  saveEmployee({ ...edit, excludeFromFteTotal: false });
  expect(getYearDataset(2025, 'stichtag').aggregation.totalFte).toBe(0.67);
});

it('counts a finished trainee again from the qualification switch onwards', () => {
  const created = saveEmployee({ ...trainee, fte: 1, weeklyHours: 36, excludeFromFteTotal: true }).employees[0];
  switchQualification({
    employeeId: created.id!, periodId: created.periodId!, effectiveFrom: '2025-07-01', qualification: 'Pflegefachkraft', year: 2025,
  });
  expect(listPeriods(created.id!).map((p) => [p.qualification, p.excludeFromFteTotal])).toEqual([
    ['Pflegefachkraft', false],
    [trainee.qualification, true],
  ]);
  const report = getYearDataset(2025, 'month-end-average');
  expect(report.aggregation).toMatchObject({ totalHeadcount: 1, totalFte: 0.5, excludedFte: 0.5, excludedHeadcount: 0 });
  const year = getYearDataset(2025);
  expect(year.employees[0]).toMatchObject({ excludeFromFteTotal: false, annualFteExcluded: 0.5 });
});

it('shows the excluded share in the exported Jahresnachweis', () => {
  saveEmployee(nurse);
  saveEmployee({ ...trainee, excludeFromFteTotal: true });
  const workbook = buildEmployeeWorkbook(getYearDataset(2025), 2025);
  const summary = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets.Jahresnachweis, { header: 1 });
  expect(summary).toContainEqual(['Gesamt', 2, 1]);
  expect(summary).toContainEqual(['Nicht in VZÄ-Summe (z. B. Auszubildende)', '', 0.67]);
  const team = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Team);
  expect(team.map((row) => [row.Name, row['In VZÄ-Summe']])).toEqual(
    expect.arrayContaining([[trainee.name, 'Nein'], [nurse.name, 'Ja']]),
  );
});
