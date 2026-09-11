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

  it('updates period-specific report totals while retaining a later full-time period', () => {
    const person = saveEmployee({
      ...base, startDate: '2024-01-01', endDate: '2024-12-31', weeklyHours: 20, fte: 0.5, year: 2024,
    }).employees[0];
    saveEmployee({
      ...base, id: person.id, periodId: undefined, startDate: '2025-01-01', endDate: null,
      weeklyHours: 36, fte: 1, year: 2025,
    });
    const historical = listWorkingTimes(person.id!).find(entry => entry.periodId === person.periodId)!;

    saveWorkingTime({
      id: historical.id, employeeId: person.id!, effectiveFrom: historical.effectiveFrom,
      weeklyHours: 20, fte: 0,
    });

    expect(getYearDataset(2024, 'stichtag').aggregation.totalFte).toBe(0);
    expect(getYearDataset(2025, 'stichtag').aggregation.totalFte).toBe(1);
    expect(getYearDataset(2024, 'year-average').aggregation.totalFte).toBe(0);
    expect(getYearDataset(2025, 'year-average').aggregation.totalFte).toBe(1);
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

  it('corrects an existing term by id when unrelated legacy periods overlap its unchanged date', () => {
    const person = saveEmployee({
      ...base, startDate: '2024-01-01', endDate: '2025-12-31', weeklyHours: 20, fte: 0.5, year: 2025,
    }).employees[0];
    const firstPeriod = person.periodId!;
    const secondPeriod = Number(db.prepare(`
      INSERT INTO employment_periods(employeeId,startDate,endDate,qualification)
      VALUES (?,?,?,?)
    `).run(person.id, '2025-01-01', null, 'Pflegefachkraft').lastInsertRowid);
    db.prepare(`
      INSERT INTO employment_terms(periodId,effectiveFrom,weeklyHours,fte,verified)
      VALUES (?,?,?,?,1)
    `).run(firstPeriod, '2025-01-01', 20, 0.5);
    db.prepare(`
      INSERT INTO employment_terms(periodId,effectiveFrom,weeklyHours,fte,verified)
      VALUES (?,?,?,?,1)
    `).run(secondPeriod, '2025-01-01', 36, 1);
    const firstTerm = db.prepare(
      'SELECT id FROM employment_terms WHERE periodId=? AND effectiveFrom=?',
    ).get(firstPeriod, '2025-01-01') as { id: number };

    expect(() => saveWorkingTime({
      id: firstTerm.id,
      employeeId: person.id!,
      effectiveFrom: '2025-01-01',
      weeklyHours: 20,
      fte: 0,
    })).not.toThrow();
    expect(db.prepare('SELECT periodId,effectiveFrom,weeklyHours,fte FROM employment_terms WHERE id=?')
      .get(firstTerm.id)).toEqual({
        periodId: firstPeriod, effectiveFrom: '2025-01-01', weeklyHours: 20, fte: 0,
      });
    expect(db.prepare('SELECT periodId,effectiveFrom,weeklyHours,fte FROM employment_terms WHERE periodId=? AND effectiveFrom=?')
      .get(secondPeriod, '2025-01-01')).toEqual({
        periodId: secondPeriod, effectiveFrom: '2025-01-01', weeklyHours: 36, fte: 1,
      });
    expect(db.prepare('SELECT effectiveFrom,weeklyHours,fte FROM employment_term_history WHERE periodId=? ORDER BY id DESC LIMIT 1')
      .get(firstPeriod)).toEqual({ effectiveFrom: '2025-01-01', weeklyHours: 20, fte: 0 });

    const beforeAmbiguousChanges = db.serialize();
    expect(() => saveWorkingTime({
      id: firstTerm.id,
      employeeId: person.id!,
      effectiveFrom: '2025-06-01',
      weeklyHours: 20,
      fte: 0,
    })).toThrow(/Beschäftigungsperiode/);
    expect(() => saveWorkingTime({
      employeeId: person.id!,
      effectiveFrom: '2025-06-01',
      weeklyHours: 20,
      fte: 0,
    })).toThrow(/Beschäftigungsperiode/);
    expect(db.serialize()).toEqual(beforeAmbiguousChanges);
  });

  it('names the overlap when several periods match and keeps the outside-employment message', () => {
    const person = saveEmployee({
      ...base, startDate: '2024-01-01', endDate: '2025-12-31', weeklyHours: 20, fte: 0.5, year: 2025,
    }).employees[0];
    db.prepare(`
      INSERT INTO employment_periods(employeeId,startDate,endDate,qualification)
      VALUES (?,?,?,?)
    `).run(person.id, '2025-01-01', null, 'Pflegefachkraft');

    expect(() => saveWorkingTime({
      employeeId: person.id!, effectiveFrom: '2025-06-01', weeklyHours: 20, fte: 0.5,
    })).toThrow('An diesem Datum überschneiden sich mehrere Beschäftigungsperioden. Bitte zuerst die Perioden in der Historie korrigieren.');
    expect(() => saveWorkingTime({
      employeeId: person.id!, effectiveFrom: '2023-06-01', weeklyHours: 20, fte: 0.5,
    })).toThrow('Das Datum muss innerhalb einer Beschäftigungsperiode liegen.');
  });
});
