// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { saveEmployee } from '../repositories/employees';
import {
  addCompetencyDefinition, assignEmployeeCompetencies, listEmployeeCompetencies, saveEmployeeCompetency,
} from '../repositories/competencies';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));
let db: SqliteAdapter;
let employeeId: number;
let ids: number[];
beforeEach(() => {
  db = new SqliteAdapter(':memory:');
  state.db = db;
  runMigrations(db as never);
  employeeId = saveEmployee({ name: 'Vorlagen Test', qualification: 'Pflegefachkraft', startDate: '2024-01-01', weeklyHours: 36, fte: 1, year: 2026 }).employees[0].id!;
  ids = ['Vorlage A', 'Vorlage B'].map((name) => addCompetencyDefinition({ name }).find((entry) => entry.name === name)!.id!);
});
afterEach(() => db.close());

it('adds a set unassessed and leaves every existing assessment and history unchanged on repeat application', () => {
  saveEmployeeCompetency({ employeeId, competencyDefinitionId: ids[0], level: 5, stageScheme: 'legacy', note: 'Bestehende Notiz', approvedAt: '2024-01-01', approvedBy: 'Prüfperson' });
  const before = listEmployeeCompetencies(employeeId)[0];
  const input = { employeeId, competencyDefinitionIds: [...ids, ids[1]] };
  const result = assignEmployeeCompetencies(input);
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual(before);
  expect(result[1]).toMatchObject({ level: null, stageScheme: 'practice-v1', approvedAt: null, approvedBy: null, note: null });
  expect(result[1].stageHistory).toHaveLength(1);
  expect(assignEmployeeCompetencies(input)).toEqual(result);
});

it('preserves an assessment saved after the preview was opened', () => {
  const input = { employeeId, competencyDefinitionIds: ids };
  saveEmployeeCompetency({ employeeId, competencyDefinitionId: ids[1], level: 6, stageScheme: 'practice-v1', approvedAt: '2024-01-01', approvedBy: 'Bestätigung', note: 'Inzwischen abgeschlossen' });
  const before = listEmployeeCompetencies(employeeId)[0];
  expect(assignEmployeeCompetencies(input).find((entry) => entry.competencyDefinitionId === ids[1])).toEqual(before);
});

it('rolls back the whole set and its history when a definition has been removed', () => {
  expect(() => assignEmployeeCompetencies({ employeeId, competencyDefinitionIds: [ids[0], -123] })).toThrow('Katalog');
  expect(listEmployeeCompetencies(employeeId)).toEqual([]);
  expect(db.prepare('SELECT count(*) AS total FROM competency_history WHERE employeeId=?').get(employeeId)).toEqual({ total: 0 });
});

it('rejects missing employees and malformed selections without writing', () => {
  expect(() => assignEmployeeCompetencies({ employeeId: -123, competencyDefinitionIds: ids })).toThrow('Person');
  for (const competencyDefinitionIds of [[], [NaN], [1.5]]) {
    expect(() => assignEmployeeCompetencies({ employeeId, competencyDefinitionIds })).toThrow('auswählen');
  }
  expect(listEmployeeCompetencies(employeeId)).toEqual([]);
});
