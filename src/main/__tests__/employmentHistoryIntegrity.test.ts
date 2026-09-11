// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { v017_employment_terms } from '../database/migrations/v017_employment_terms';
import { getYearDataset, saveEmployee } from '../repositories/employees';
import { saveEvent } from '../repositories/events';
import { buildEmployeeWorkbook } from '../workbook';
import * as XLSX from 'xlsx';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));

describe('effective employment and year reports', () => {
  let db: SqliteAdapter;
  const base = {
    name: 'Historie Test',
    qualification: 'Pflegefachkraft',
    startDate: '2024-01-01',
    fte: 1,
    weeklyHours: 40,
    birthDate: '2000-01-01',
    year: 2024,
  };
  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });
  afterEach(() => db.close());

  it('preserves earlier FTE after a later change and uses the selected report year', () => {
    const person = saveEmployee(base).employees[0];
    saveEmployee({
      ...base,
      id: person.id,
      periodId: person.periodId,
      fte: 0.5,
      weeklyHours: 20,
      hoursEffectiveFrom: '2026-01-01',
      year: 2026,
    });
    expect(getYearDataset(2024, 'stichtag').aggregation.totalFte).toBe(1);
    expect(getYearDataset(2026, 'stichtag').aggregation.totalFte).toBe(0.5);
    const workbook = buildEmployeeWorkbook(getYearDataset(2024, 'stichtag'), 2024);
    expect(workbook.SheetNames).toEqual(['Jahresnachweis', 'Team']);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Jahresnachweis, { header: 1 })).toContainEqual([
      'Gesamt',
      1,
      1,
    ]);
  });

  it('backdates unchanged March hours to January while preserving the earlier half-time period', () => {
    const input = { ...base, startDate: '2024-09-01', weeklyHours: 18, fte: 0.5, hoursVerified: true };
    const person = saveEmployee(input).employees[0];
    const fullTime = { ...input, id: person.id, periodId: person.periodId,
      weeklyHours: 36, fte: 1, updateHours: true, year: 2025 };
    saveEmployee({ ...fullTime, hoursEffectiveFrom: '2025-03-01' });
    saveEmployee({ ...fullTime, hoursEffectiveFrom: '2025-01-01' });
    expect(getYearDataset(2024, 'stichtag').aggregation.totalFte).toBe(0.5);
    expect(getYearDataset(2025, 'year-average').aggregation.totalFte).toBe(1);
    expect(db.prepare('SELECT effectiveFrom,weeklyHours,verified FROM employment_terms ORDER BY effectiveFrom').all())
      .toEqual([
        { effectiveFrom: '2024-09-01', weeklyHours: 18, verified: 1 },
        { effectiveFrom: '2025-01-01', weeklyHours: 36, verified: 1 },
        { effectiveFrom: '2025-03-01', weeklyHours: 36, verified: 1 },
      ]);
  });

  it('excludes summer exits from the December snapshot but retains them in history', () => {
    saveEmployee({ ...base, endDate: '2024-06-30' });
    expect(getYearDataset(2024).employees).toHaveLength(1);
    expect(getYearDataset(2024, 'stichtag').employees).toHaveLength(0);
    expect(getYearDataset(2025).employees).toHaveLength(0);
  });

  it('keeps birth dates when changing a period and separates re-entry', () => {
    const person = saveEmployee({ ...base, endDate: '2024-06-30' }).employees[0];
    const input = { ...base, birthDate: undefined as string | undefined };
    saveEmployee({ ...input, id: person.id, startDate: '2026-03-01', year: 2026 });
    expect(getYearDataset(2024).employees[0]).toMatchObject({
      startDate: '2024-01-01',
      birthDate: base.birthDate,
    });
    expect(getYearDataset(2026).employees[0].startDate).toBe('2026-03-01');
  });

  it('derives the display entry from adjacent periods while keeping the selected period start', () => {
    const first = saveEmployee({ ...base, startDate: '2022-07-01', endDate: '2023-12-31', year: 2023 });
    const person = first.employees[0];
    saveEmployee({
      ...base,
      id: person.id,
      periodId: undefined,
      startDate: '2024-01-01',
      endDate: undefined,
      year: 2024,
    });

    expect(getYearDataset(2024).employees[0]).toMatchObject({
      startDate: '2024-01-01',
      employmentStartDate: '2022-07-01',
    });
  });

  it('rejects reversed, overlapping and negative data without partial writes', () => {
    expect(() => saveEmployee({ ...base, endDate: '2023-01-01' })).toThrow();
    expect(() => saveEmployee({ ...base, fte: -1 })).toThrow();
    expect(getYearDataset(2024).employees).toHaveLength(0);
    const person = saveEmployee(base).employees[0];
    expect(() =>
      saveEmployee({ ...base, id: person.id, name: 'Must not persist', startDate: '2025-01-01' }),
    ).toThrow(/überschneiden/);
    expect(getYearDataset(2024).employees[0].name).toBe(base.name);
  });

  it('does not allow event edits to silently override employment dates', () => {
    const person = saveEmployee(base).employees[0];
    expect(() =>
      saveEvent({ employeeId: person.id!, eventDate: '2024-06-30', type: 'leave', title: 'Exit' }),
    ).toThrow(/Beschäftigungsperiode/);
  });

  it('migrates explicit legacy exits and flags inherited hours without inventing certainty', () => {
    const person = saveEmployee(base).employees[0];
    db.exec('DELETE FROM employment_terms');
    db.prepare(
      "INSERT INTO employee_events(employeeId,eventDate,type,title) VALUES (?,'2024-06-30','leave','Exit')",
    ).run(person.id);
    v017_employment_terms.up(db as never);
    expect(getYearDataset(2025).employees).toHaveLength(0);
    expect(getYearDataset(2024).unverifiedHoursCount).toBe(1);
    expect(getYearDataset(2024).employees[0].birthDate).toBe(base.birthDate);
  });
});

describe('report variants and correction provenance', () => {
  let db: SqliteAdapter;
  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });
  afterEach(() => db.close());
  it('weights leap-year days and employment boundaries without counting inactive months', () => {
    const base = {
      name: 'Jahresanteil Test',
      qualification: 'Pflegefachkraft',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      weeklyHours: 36,
      fte: 1,
      year: 2024,
    };
    const person = saveEmployee(base).employees[0];
    saveEmployee({
      ...base,
      id: person.id,
      periodId: person.periodId,
      weeklyHours: 18,
      fte: 0.5,
      hoursEffectiveFrom: '2024-04-01',
      sourceRef: 'Vertrag B',
    });
    const average = getYearDataset(2024, 'year-average');
    expect(average.employees.map((row) => row.reportDays)).toEqual([91, 91]);
    expect(average.aggregation.totalFte).toBe(0.37);
    expect(average.aggregation.totalHeadcount).toBe(1);
    expect(getYearDataset(2024, 'stichtag').aggregation.totalFte).toBe(0);
  });
  it('retains old corrections and exposes former staff outside recent years', () => {
    const input = {
      name: 'Altbestand Test',
      qualification: 'Pflegefachkraft',
      startDate: '2010-01-01',
      endDate: '2012-12-31',
      weeklyHours: 36,
      fte: 1,
      year: 2012,
      sourceRef: 'Vertrag A',
    };
    const person = saveEmployee(input).employees[0];
    saveEmployee({
      ...input,
      id: person.id,
      periodId: person.periodId,
      fte: 0.75,
      weeklyHours: 27,
      hoursEffectiveFrom: '2010-01-01',
      sourceRef: 'Korrektur Personalakte',
    });
    const directory = getYearDataset(2026, 'directory');
    expect(directory.employees).toHaveLength(1);
    expect(directory.availableYears).toContain(2010);
    expect(directory.employees[0].hoursHistory?.map((row) => row.fte)).toEqual([0.75, 1]);
    expect(directory.employees[0].sourceRef).toBe('Korrektur Personalakte');
  });
});
