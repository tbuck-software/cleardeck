// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { saveEmployee } from '../repositories/employees';
import {
  addCompetencyDefinition,
  bulkChangeCompetencies,
  listEmployeeCompetencies,
  saveEmployeeCompetency,
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
  employeeId = saveEmployee({
    name: 'Kompetenz Test',
    qualification: 'Pflegekraft',
    startDate: '2024-01-01',
    weeklyHours: 36,
    fte: 1,
    year: 2026,
  }).employees[0].id!;
  ids = ['Injektion', 'Hygiene', 'Verbände'].map(
    (name) => addCompetencyDefinition({ name }).find((entry) => entry.name === name)!.id!,
  );
  ids.forEach((id, i) =>
    saveEmployeeCompetency({
      employeeId,
      competencyDefinitionId: id,
      level: 2,
      stageScheme: i === 0 ? 'legacy' : 'practice-v1',
      approvedAt: '2024-01-01',
      approvedBy: 'Vorhandene Person',
      note: `Notiz ${i}`,
    }),
  );
});
afterEach(() => db.close());
const snapshot = () => JSON.stringify(listEmployeeCompetencies(employeeId));

it('changes an arbitrary mixed subset while preserving schemes, metadata and unselected history', () => {
  const before = listEmployeeCompetencies(employeeId);
  const after = bulkChangeCompetencies({
    employeeId,
    changes: [
      { competencyDefinitionId: ids[0], stageScheme: 'legacy', level: 5 },
      { competencyDefinitionId: ids[2], stageScheme: 'practice-v1', level: 4 },
    ],
  });
  expect(after[1]).toEqual(before[1]);
  [0, 2].forEach((i) => {
    expect(after[i]).toMatchObject({
      note: before[i].note,
      approvedAt: before[i].approvedAt,
      approvedBy: before[i].approvedBy,
      stageScheme: before[i].stageScheme,
    });
    expect(after[i].stageHistory).toHaveLength(before[i].stageHistory!.length + 1);
  });
  expect(after.map((entry) => entry.level)).toEqual([5, 2, 4]);
});

it('rolls back earlier writes and their history when a later level is invalid', () => {
  const before = snapshot();
  expect(() =>
    bulkChangeCompetencies({
      employeeId,
      changes: [
        { competencyDefinitionId: ids[1], stageScheme: 'practice-v1', level: 4 },
        { competencyDefinitionId: ids[0], stageScheme: 'legacy', level: 6 },
      ],
    }),
  ).toThrow('Ungültige');
  expect(snapshot()).toBe(before);
});

it('requires explicit completion details and records them only for completed new-model entries', () => {
  const changes = [
    { competencyDefinitionId: ids[0], stageScheme: 'legacy' as const, level: 5 },
    { competencyDefinitionId: ids[1], stageScheme: 'practice-v1' as const, level: 6 },
  ];
  const before = snapshot();
  expect(() => bulkChangeCompetencies({ employeeId, changes })).toThrow('Abschluss braucht');
  expect(snapshot()).toBe(before);
  const after = bulkChangeCompetencies({
    employeeId,
    changes,
    completion: { approvedAt: '2026-01-01', approvedBy: 'Neue Person' },
  });
  expect(after[0].approvedBy).toBe('Vorhandene Person');
  expect(after[1]).toMatchObject({
    level: 6,
    approvedAt: '2026-01-01',
    approvedBy: 'Neue Person',
    note: 'Notiz 1',
  });
});

it('rejects unassigned IDs, duplicates and changed models without writing', () => {
  const before = snapshot();
  const change = { competencyDefinitionId: ids[0], stageScheme: 'legacy' as const, level: 4 };
  expect(() => bulkChangeCompetencies({ employeeId: employeeId + 1, changes: [change] })).toThrow(
    'zugeordnet',
  );
  expect(() => bulkChangeCompetencies({ employeeId, changes: [change, change] })).toThrow(
    'mehrfach',
  );
  expect(() =>
    bulkChangeCompetencies({ employeeId, changes: [{ ...change, stageScheme: 'practice-v1' }] }),
  ).toThrow('Stufenmodell');
  expect(snapshot()).toBe(before);
});

it('does not add history for unchanged levels', () => {
  const before = snapshot();
  bulkChangeCompetencies({
    employeeId,
    changes: [{ competencyDefinitionId: ids[0], stageScheme: 'legacy', level: 2 }],
  });
  expect(snapshot()).toBe(before);
});

it.each(['2099-01-01', '2026-02-30'])(
  'rejects invalid completion date %s and keeps all values',
  (approvedAt) => {
    const before = snapshot();
    expect(() =>
      bulkChangeCompetencies({
        employeeId,
        changes: [{ competencyDefinitionId: ids[1], stageScheme: 'practice-v1', level: 6 }],
        completion: { approvedAt, approvedBy: 'Test' },
      }),
    ).toThrow();
    expect(snapshot()).toBe(before);
  },
);

it('preserves the exact text of existing notes and approvers', () => {
  db.prepare(
    'UPDATE employee_competencies SET note=?, approvedBy=? WHERE employeeId=? AND competencyDefinitionId=?',
  ).run('  Bestehende Notiz  ', '  Name aus Import  ', employeeId, ids[0]);
  const after = bulkChangeCompetencies({
    employeeId,
    changes: [{ competencyDefinitionId: ids[0], stageScheme: 'legacy', level: 5 }],
  });
  expect(after[0]).toMatchObject({
    note: '  Bestehende Notiz  ',
    approvedBy: '  Name aus Import  ',
  });
});
