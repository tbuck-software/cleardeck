/// <reference types="vitest/globals" />
// @vitest-environment node

import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { seedDatabase } from '../database/seed';

const state = vi.hoisted(() => ({ db: null as SqliteAdapter | null }));
vi.mock('better-sqlite3', async () => ({ default: (await import('./sqliteAdapter')).default }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));

import { saveEmployee } from '../repositories/employees';
import { allocateDeviceIds } from '../syncRecords';

const baseInput = {
  name: 'Replica employee',
  qualification: 'Pflegefachkraft',
  startDate: '2026-01-01',
  fte: 1,
  weeklyHours: 38,
  year: 2026,
};

describe('repository ID allocation', () => {
  it('gives repository-created rows disjoint ids on two replicas', () => {
    const first = new SqliteAdapter(':memory:');
    const second = new SqliteAdapter(':memory:');
    runMigrations(first as never);
    runMigrations(second as never);

    state.db = first;
    allocateDeviceIds(first as never, 31);
    const firstEmployee = saveEmployee({ ...baseInput, name: 'First replica' }).employees[0];

    state.db = second;
    allocateDeviceIds(second as never, 32);
    const secondEmployee = saveEmployee({ ...baseInput, name: 'Second replica' }).employees[0];

    expect(firstEmployee.id).toBe(31 * 2 ** 32 + 1);
    expect(secondEmployee.id).toBe(32 * 2 ** 32 + 1);
    expect(
      first.prepare('SELECT id FROM employment_term_history').get(),
    ).toMatchObject({ id: 31 * 2 ** 32 + 1 });
    expect(
      second.prepare('SELECT id FROM employment_term_history').get(),
    ).toMatchObject({ id: 32 * 2 ** 32 + 1 });

    first.close();
    second.close();
    state.db = null;
  });

  it('uses allocated IDs throughout the demo seed', () => {
    const db = new SqliteAdapter(':memory:');
    runMigrations(db as never);
    seedDatabase(db as never);

    for (const table of ['employees', 'employment_periods', 'employee_events', 'patients', 'patient_visits']) {
      const ids = db.prepare(`SELECT id FROM ${table}`).all() as Array<{ id: number }>;
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids.map((row) => row.id)).size).toBe(ids.length);
      expect(ids.every((row) => row.id > 0 && Number.isSafeInteger(row.id))).toBe(true);
    }
    db.close();
  });

});
