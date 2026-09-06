// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { getYearDataset, saveEmployee } from '../repositories/employees';
import { listWorkingTimes, saveWorkingTime } from '../repositories/workingTimes';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));

describe('working-time corrections', () => {
  let db: SqliteAdapter;
  const base = { name: 'Arbeitszeit Test', qualification: 'Pflegekraft',
    startDate: '2024-09-01', weeklyHours: 18, fte: 0.5, year: 2025 };
  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });
  afterEach(() => db.close());

  it('moves March to January without leaving an active March entry and retains the previous version', () => {
    const person = saveEmployee(base).employees[0];
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1 });
    const march = listWorkingTimes(person.id!)[0];
    saveWorkingTime({ id: march.id, employeeId: person.id!, effectiveFrom: '2025-01-01', weeklyHours: 36, fte: 1 });
    expect(listWorkingTimes(person.id!)).toEqual([
      { ...march, effectiveFrom: '2025-01-01' },
      expect.objectContaining({ effectiveFrom: '2024-09-01', effectiveUntil: '2024-12-31', weeklyHours: 18, fte: 0.5 }),
    ]);
    expect(getYearDataset(2024, 'stichtag').aggregation.totalFte).toBe(0.5);
    expect(getYearDataset(2025, 'year-average').aggregation.totalFte).toBe(1);
    expect(getYearDataset(2025).employees[0].hoursHistory?.map(row => row.effectiveFrom))
      .toEqual(['2025-01-01', '2025-03-01', '2024-09-01']);
  });

  it('corrects historical hours without changing current hours, personal data or qualification', () => {
    const person = saveEmployee(base).employees[0];
    const first = listWorkingTimes(person.id!)[0];
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-01-01', weeklyHours: 36, fte: 1 });
    saveWorkingTime({ id: first.id, employeeId: person.id!, effectiveFrom: first.effectiveFrom, weeklyHours: 27, fte: 0.75 });
    expect(getYearDataset(2024, 'stichtag').aggregation.totalFte).toBe(0.75);
    expect(getYearDataset(2025).employees[0]).toMatchObject({
      name: base.name, qualification: base.qualification, startDate: base.startDate, weeklyHours: 36, fte: 1,
    });
    expect(getYearDataset(2025).employees[0].hoursHistory?.filter(h => h.effectiveFrom === first.effectiveFrom))
      .toEqual([expect.objectContaining({ weeklyHours: 27 }), expect.objectContaining({ weeklyHours: 18 })]);
  });

  it('resolves the employment section by date when crossing a qualification change', () => {
    const person = saveEmployee({ ...base, endDate: '2024-12-31', year: 2024 }).employees[0];
    saveEmployee({ ...base, id: person.id, startDate: '2025-01-01', qualification: 'Pflegefachkraft', weeklyHours: 36, fte: 1 });
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 30, fte: 0.83 });
    const entry = listWorkingTimes(person.id!)[0];
    saveWorkingTime({ id: entry.id, employeeId: person.id!, effectiveFrom: '2024-12-01', weeklyHours: 30, fte: 0.83 });
    expect(listWorkingTimes(person.id!).find(row => row.id === entry.id)?.periodId).toBe(person.periodId);
    expect(getYearDataset(2024).employees[0].qualification).toBe('Pflegekraft');
    expect(getYearDataset(2025).employees[0]).toMatchObject({ qualification: 'Pflegefachkraft', weeklyHours: 36 });
  });

  it('rejects collisions, dates outside employment, invalid values and foreign entries atomically', () => {
    const person = saveEmployee(base).employees[0];
    const other = saveEmployee({ ...base, name: 'Andere Person' }).employees.find(p => p.name === 'Andere Person')!;
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1 });
    const entry = listWorkingTimes(person.id!)[0];
    const input = { id: entry.id, employeeId: person.id!, effectiveFrom: '2025-02-01', weeklyHours: 30, fte: 0.83 };
    const before = db.serialize();
    expect(() => saveWorkingTime({ ...input, effectiveFrom: '2024-09-01' })).toThrow(/bereits/);
    expect(() => saveWorkingTime({ ...input, effectiveFrom: '2024-08-01' })).toThrow(/Beschäftigungsperiode/);
    expect(() => saveWorkingTime({ ...input, employeeId: other.id! })).toThrow(/nicht gefunden/);
    expect(() => saveWorkingTime({ ...input, fte: 2 })).toThrow(/VZÄ/);
    expect(() => saveWorkingTime({ ...input, weeklyHours: -1 })).toThrow(/Wochenstunden/);
    expect(db.serialize()).toEqual(before);
  });
});
