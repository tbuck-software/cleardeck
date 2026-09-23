// @vitest-environment node

import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { getEmployeePeriod, getYearDataset, saveEmployee } from '../repositories/employees';
import { recordDeparture, switchQualification } from '../repositories/employmentActions';
import { addCompetencyDefinition, listEmployeeCompetencies, saveEmployeeCompetency } from '../repositories/competencies';
import { saveWorkingTime } from '../repositories/workingTimes';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));

describe('employment actions', () => {
  let db: SqliteAdapter;

  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });

  afterEach(() => db.close());

  it('records a departure on the existing period and keeps the person identity and terms', () => {
    const person = saveEmployee({
      name: 'Synthetic Departure',
      qualification: 'Pflegekraft',
      startDate: '2024-01-01',
      weeklyHours: 30,
      fte: 0.83,
      year: 2024,
    }).employees[0];

    recordDeparture({ employeeId: person.id!, periodId: person.periodId!, endDate: '2024-09-30', year: 2024 });

    expect(getYearDataset(2024, 'directory').employees[0]).toMatchObject({
      id: person.id,
      startDate: '2024-01-01',
      endDate: '2024-09-30',
    });
    expect(db.prepare('SELECT periodId,effectiveFrom,weeklyHours,fte FROM employment_terms').all()).toEqual([
      { periodId: person.periodId, effectiveFrom: '2024-01-01', weeklyHours: 30, fte: 0.83 },
    ]);
  });

  it('rejects a departure that would strand a future working-time state and rolls back', () => {
    const person = saveEmployee({
      name: 'Synthetic Terms',
      qualification: 'Pflegekraft',
      startDate: '2024-01-01',
      weeklyHours: 18,
      fte: 0.5,
      year: 2026,
    }).employees[0];
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2026-01-01', weeklyHours: 36, fte: 1 });
    const before = db.serialize();

    expect(() => recordDeparture({ employeeId: person.id!, periodId: person.periodId!, endDate: '2025-12-31', year: 2025 }))
      .toThrow(/Arbeitszeitstand/);
    expect(db.serialize()).toEqual(before);
  });

  it('moves an existing departure later while no later period follows', () => {
    const person = saveEmployee({
      name: 'Synthetic Moved Departure',
      qualification: 'Pflegekraft',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      weeklyHours: 30,
      fte: 0.83,
      year: 2024,
    }).employees[0];

    recordDeparture({ employeeId: person.id!, periodId: person.periodId!, endDate: '2024-09-30', year: 2024 });
    expect(db.prepare('SELECT endDate FROM employment_periods WHERE id=?').get(person.periodId))
      .toEqual({ endDate: '2024-09-30' });

    saveEmployee({
      id: person.id,
      name: person.name,
      qualification: 'Pflegefachkraft',
      startDate: '2025-01-01',
      weeklyHours: 36,
      fte: 1,
      year: 2025,
      birthDate: person.birthDate,
    });
    const before = db.serialize();
    expect(() => recordDeparture({ employeeId: person.id!, periodId: person.periodId!, endDate: '2025-03-31', year: 2025 }))
      .toThrow(/überschneiden sich/);
    expect(db.serialize()).toEqual(before);
  });

  it('maps a historical period with its effective terms despite a later reentry', () => {
    const person = saveEmployee({
      name: 'Synthetic Mapped Period',
      qualification: 'Pflegekraft',
      startDate: '2020-01-01',
      endDate: '2024-12-31',
      weeklyHours: 18,
      fte: 0.5,
      sourceRef: 'Historical Source',
      hoursVerified: false,
      year: 2024,
    }).employees[0];
    saveEmployee({
      id: person.id,
      name: person.name,
      qualification: 'Pflegefachkraft',
      startDate: '2025-01-01',
      weeklyHours: 36,
      fte: 1,
      year: 2025,
      birthDate: person.birthDate,
    });

    const mapped = getEmployeePeriod(person.id!, person.periodId!, 2025);

    expect(mapped).toMatchObject({
      id: person.id,
      periodId: person.periodId,
      weeklyHours: 18,
      fte: 0.5,
      sourceRef: 'Historical Source',
      hoursVerified: false,
      hoursMissing: false,
      hoursEffectiveFrom: '2020-01-01',
    });
    expect(mapped.workingTimes?.find((entry) => entry.periodId === person.periodId)).toMatchObject({
      weeklyHours: 18,
      fte: 0.5,
      effectiveUntil: '2024-12-31',
    });
    expect(mapped.hoursHistory?.find((entry) => entry.effectiveFrom === '2020-01-01')).toMatchObject({
      weeklyHours: 18,
      fte: 0.5,
      verified: 0,
      sourceRef: 'Historical Source',
    });
  });

  it('splits a period, carries unverified terms forward, and keeps one employee', () => {
    const person = saveEmployee({
      name: 'Synthetic Qualification',
      qualification: 'Einarbeitung',
      startDate: '2024-01-01',
      weeklyHours: 18,
      fte: 0.5,
      sourceRef: 'Altbestand Arbeitszeit',
      hoursVerified: false,
      year: 2025,
    }).employees[0];
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1 });

    switchQualification({
      employeeId: person.id!,
      periodId: person.periodId!,
      effectiveFrom: '2025-01-01',
      qualification: 'Pflegefachkraft',
      year: 2025,
    });

    const periods = db.prepare('SELECT id,startDate,endDate,qualification FROM employment_periods ORDER BY startDate').all();
    expect(periods).toHaveLength(2);
    expect(periods[0]).toMatchObject({ id: person.periodId, endDate: '2024-12-31', qualification: 'Einarbeitung' });
    expect(periods[1]).toMatchObject({ startDate: '2025-01-01', qualification: 'Pflegefachkraft' });
    expect(db.prepare('SELECT periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms ORDER BY periodId,effectiveFrom').all())
      .toEqual([{ periodId: periods[0].id, effectiveFrom: '2024-01-01', weeklyHours: 18, fte: 0.5, verified: 0, sourceRef: 'Altbestand Arbeitszeit' },
        { periodId: periods[1].id, effectiveFrom: '2025-01-01', weeklyHours: 18, fte: 0.5, verified: 0, sourceRef: 'Altbestand Arbeitszeit' },
        { periodId: periods[1].id, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1, verified: 1, sourceRef: null }]);
    expect(db.prepare('SELECT periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_term_history WHERE periodId=? ORDER BY effectiveFrom').all(periods[1].id))
      .toEqual([
        { periodId: periods[1].id, effectiveFrom: '2025-01-01', weeklyHours: 18, fte: 0.5, verified: 0, sourceRef: 'Altbestand Arbeitszeit' },
        { periodId: periods[1].id, effectiveFrom: '2025-03-01', weeklyHours: 36, fte: 1, verified: 1, sourceRef: null },
      ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM employees WHERE id=?').get(person.id)).toEqual({ count: 1 });
  });

  it('keeps a later existing period bounded and rejects a transition into an occupied period', () => {
    const person = saveEmployee({
      name: 'Synthetic Future',
      qualification: 'Pflegekraft',
      startDate: '2024-01-01',
      endDate: '2026-12-31',
      weeklyHours: 36,
      fte: 1,
      year: 2026,
    }).employees[0];
    saveEmployee({
      id: person.id,
      name: person.name,
      qualification: 'Pflegefachkraft',
      startDate: '2027-01-01',
      weeklyHours: 36,
      fte: 1,
      year: 2027,
      birthDate: person.birthDate,
    });

    switchQualification({
      employeeId: person.id!,
      periodId: person.periodId!,
      effectiveFrom: '2025-01-01',
      qualification: '1-jährig examiniert',
      year: 2025,
    });
    expect(db.prepare('SELECT endDate FROM employment_periods WHERE qualification=?').get('1-jährig examiniert'))
      .toEqual({ endDate: '2026-12-31' });

    const occupied = db.prepare('SELECT id FROM employment_periods WHERE startDate=?').get('2027-01-01') as { id: number };
    expect(() => switchQualification({
      employeeId: person.id!, periodId: occupied.id, effectiveFrom: '2027-01-01', qualification: 'Sonstige', year: 2027,
    })).toThrow(/Beginn/);
  });

  it('refuses to strand a working-time state through the employee editor as well', () => {
    const person = saveEmployee({
      name: 'Synthetic Editor Path',
      qualification: 'Pflegekraft',
      startDate: '2024-01-01',
      weeklyHours: 18,
      fte: 0.5,
      year: 2026,
    }).employees[0];
    saveWorkingTime({ employeeId: person.id!, effectiveFrom: '2026-01-01', weeklyHours: 36, fte: 1 });
    const before = db.serialize();

    expect(() => saveEmployee({
      id: person.id,
      periodId: person.periodId,
      name: person.name,
      qualification: 'Pflegekraft',
      startDate: '2024-01-01',
      endDate: '2025-12-31',
      weeklyHours: 18,
      fte: 0.5,
      updateHours: false,
      year: 2025,
    })).toThrow(/Arbeitszeitstand/);
    expect(db.serialize()).toEqual(before);
  });

  it('continues after the last trainee day with preserved working time and assessments', () => {
    const person = saveEmployee({
      name: 'Synthetic Trainee', qualification: 'Azubi 1j', startDate: '2025-09-01',
      endDate: '2026-08-31', weeklyHours: 30, fte: 0.83,
      hoursVerified: false, sourceRef: 'Altbestand', year: 2026,
    }).employees[0];
    const definition = addCompetencyDefinition({ name: 'Bestehende Bewertung' }).find((row) => row.name === 'Bestehende Bewertung')!;
    saveEmployeeCompetency({ employeeId: person.id!, competencyDefinitionId: definition.id!, level: 4,
      note: 'Erhalten', approvedBy: 'Prüfperson', approvedAt: '2026-08-01' });
    const assessments = listEmployeeCompetencies(person.id!);
    const originalTerms = db.prepare('SELECT * FROM employment_terms WHERE periodId=?').all(person.periodId);
    const originalHistory = db.prepare('SELECT * FROM employment_term_history WHERE periodId=?').all(person.periodId);
    const input = { employeeId: person.id!, periodId: person.periodId!, effectiveFrom: '2026-09-01',
      qualification: 'Pflegefachassistentin', year: 2026 };

    switchQualification(input);

    const periods = db.prepare('SELECT id,startDate,endDate,qualification FROM employment_periods ORDER BY startDate').all();
    expect(periods).toEqual([
      { id: person.periodId, startDate: '2025-09-01', endDate: '2026-08-31', qualification: 'Azubi 1j' },
      { id: expect.any(Number), startDate: '2026-09-01', endDate: null, qualification: 'Pflegefachassistentin' },
    ]);
    expect(db.prepare('SELECT * FROM employment_terms WHERE periodId=?').all(person.periodId)).toEqual(originalTerms);
    expect(db.prepare('SELECT * FROM employment_term_history WHERE periodId=?').all(person.periodId)).toEqual(originalHistory);
    expect(db.prepare('SELECT effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms WHERE periodId=?').all(periods[1].id))
      .toEqual([{ effectiveFrom: '2026-09-01', weeklyHours: 30, fte: 0.83, verified: 0, sourceRef: 'Altbestand' }]);
    expect(listEmployeeCompetencies(person.id!)).toEqual(assessments);
    expect(getEmployeePeriod(person.id!, periods[1].id as number, 2026)).toMatchObject({
      id: person.id, endDate: null, employmentStartDate: '2025-09-01', qualification: 'Pflegefachassistentin',
    });
    const beforeRetry = db.serialize();
    expect(() => switchQualification(input)).toThrow(/bereits/);
    expect(db.serialize()).toEqual(beforeRetry);
  });

  it.each([
    ['2026-12-31', '2027-01-01'],
    ['2024-02-28', '2024-02-29'],
    ['2024-02-29', '2024-03-01'],
  ])('continues even a one-day period at %s across calendar boundaries', (endDate, effectiveFrom) => {
    const person = saveEmployee({ name: 'Synthetic Boundary', qualification: 'Azubi',
      startDate: endDate, endDate, fte: 1, year: Number(endDate.slice(0, 4)) }).employees[0];
    switchQualification({ employeeId: person.id!, periodId: person.periodId!, effectiveFrom,
      qualification: 'Pflegefachassistenz', year: Number(effectiveFrom.slice(0, 4)) });
    expect(db.prepare('SELECT startDate,endDate FROM employment_periods ORDER BY startDate').all())
      .toEqual([{ startDate: endDate, endDate }, { startDate: effectiveFrom, endDate: null }]);
  });

  it.each(['2026-09-01', '2026-10-01'])('rejects continuation when another period starts %s without changing data', (startDate) => {
    const person = saveEmployee({ name: 'Synthetic Conflict', qualification: 'Azubi',
      startDate: '2025-09-01', endDate: '2026-08-31', fte: 1, year: 2026 }).employees[0];
    saveEmployee({ id: person.id, name: person.name, qualification: 'Pflegefachkraft', startDate, fte: 1, year: 2026 });
    const before = db.serialize();
    expect(() => switchQualification({ employeeId: person.id!, periodId: person.periodId!,
      effectiveFrom: '2026-09-01', qualification: 'Pflegefachassistenz', year: 2026 })).toThrow(/zukünftige[nr] Beschäftigungszeitraum/);
    expect(db.serialize()).toEqual(before);
  });

  it('rejects gaps and does not silently repair working-time records beyond a closed period', () => {
    const person = saveEmployee({ name: 'Synthetic Invalid Continuation', qualification: 'Azubi',
      startDate: '2025-09-01', endDate: '2026-08-31', fte: 1, year: 2026 }).employees[0];
    const input = { employeeId: person.id!, periodId: person.periodId!, qualification: 'Pflegefachassistenz', year: 2026 };
    const before = db.serialize();
    expect(() => switchQualification({ ...input, effectiveFrom: '2026-09-02' })).toThrow(/Folgetag/);
    expect(db.serialize()).toEqual(before);
    db.prepare('UPDATE employment_terms SET effectiveFrom=? WHERE periodId=?').run('2026-09-01', person.periodId);
    const corruptBefore = db.serialize();
    expect(() => switchQualification({ ...input, effectiveFrom: '2026-09-01' })).toThrow(/Arbeitszeitstand/);
    expect(db.serialize()).toEqual(corruptBefore);
  });

  it('validates dates before changing anything', () => {
    const person = saveEmployee({
      name: 'Synthetic Invalid', qualification: 'Pflegekraft', startDate: '2024-01-01', fte: 1, year: 2024,
    }).employees[0];
    const before = db.serialize();
    expect(() => recordDeparture({ employeeId: person.id!, periodId: person.periodId!, endDate: '2023-12-31', year: 2024 }))
      .toThrow(/Beginn/);
    expect(() => switchQualification({
      employeeId: person.id!, periodId: person.periodId!, effectiveFrom: '2024-00-20', qualification: 'Sonstige', year: 2024,
    })).toThrow(/ungültig/);
    expect(db.serialize()).toEqual(before);
  });
});
