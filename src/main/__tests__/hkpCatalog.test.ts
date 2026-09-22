// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations, migrations } from '../database/migrations';
import { saveEmployee } from '../repositories/employees';
import { addCompetencyDefinition, assignEmployeeCompetencies, importHkpCompetencyDefinitions, listCompetencyDefinitions, listEmployeeCompetencies, saveEmployeeCompetency, updateCompetencyDefinition } from '../repositories/competencies';
import { hkpCatalog } from '../../shared/hkpCatalog';
import { matchesQualificationRelevance } from '../../utils/qualificationRelevance';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));
let db: SqliteAdapter;
beforeEach(() => { db = new SqliteAdapter(':memory:'); state.db = db; runMigrations(db as never); });
afterEach(() => db.close());
const keys = hkpCatalog.map((row) => row.templateKey);

it('imports all 50 source positions as unreviewed, with stable origin and no employee assignments', () => {
  expect(hkpCatalog).toHaveLength(50);
  const count = listCompetencyDefinitions().length;
  const imported = importHkpCompetencyDefinitions(keys).filter((row) => row.templateKey);
  expect(imported).toHaveLength(50);
  expect(new Set(imported.map((row) => row.code)).size).toBe(50);
  expect(imported.every((row) => row.reviewStatus === 'pending' && row.note?.includes('06.03.2023'))).toBe(true);
  expect(listCompetencyDefinitions()).toHaveLength(count + 50);
  expect(db.prepare('SELECT COUNT(*) AS n FROM employee_competencies').get()).toEqual({ n: 0 });
  expect(importHkpCompetencyDefinitions(keys)).toHaveLength(count + 50);
});

it('preserves local code/name collisions, edited template origin, and employee history on repeat import', () => {
  const [first, second, third] = hkpCatalog;
  addCompetencyDefinition({ name: 'Eigene Blutdruckmessung', code: first.code, relevance: 'Nur PFK', note: 'Betriebsregel' });
  addCompetencyDefinition({ name: second.name, code: 'LOKAL', note: 'Eigene Messung' });
  const before = listCompetencyDefinitions();
  const imported = importHkpCompetencyDefinitions(keys);
  for (const old of before) expect(imported.find((row) => row.id === old.id)).toEqual(old);
  const entry = imported.find((row) => row.templateKey === third.templateKey)!;
  const employeeId = saveEmployee({ name: 'Matrix Test', qualification: 'Pflegefachkraft', startDate: '2024-01-01', weeklyHours: 36, fte: 1, year: 2026 }).employees[0].id!;
  saveEmployeeCompetency({ employeeId, competencyDefinitionId: entry.id!, level: 6, stageScheme: 'practice-v1', approvedAt: '2024-01-01', approvedBy: 'Prüfperson', note: 'Bleibt erhalten' });
  const assessment = listEmployeeCompetencies(employeeId);
  updateCompetencyDefinition({ ...entry, id: entry.id!, code: 'EIGEN', name: 'Betriebliche Messung', note: 'Nicht überschreiben' });
  const customized = listCompetencyDefinitions();
  expect(importHkpCompetencyDefinitions(keys)).toEqual(customized);
  expect(listEmployeeCompetencies(employeeId)[0].stageHistory).toEqual(assessment[0].stageHistory);
  expect(listEmployeeCompetencies(employeeId)[0]).toMatchObject({ level: 6, note: 'Bleibt erhalten', approvedBy: 'Prüfperson' });
});

it('can supplement an entry and review its template without altering the assessment', () => {
  const template = hkpCatalog.find((row) => row.code === '032265')!;
  const entry = importHkpCompetencyDefinitions([template.templateKey]).find((row) => row.templateKey === template.templateKey)!;
  const employeeId = saveEmployee({ name: 'Nachtrag Test', qualification: 'Pflegefachkraft', startDate: '2024-01-01', weeklyHours: 36, fte: 1, year: 2026 }).employees[0].id!;
  assignEmployeeCompetencies({ employeeId, competencyDefinitionIds: [entry.id!] });
  const history = listEmployeeCompetencies(employeeId)[0].stageHistory;
  updateCompetencyDefinition({ ...entry, id: entry.id!, name: 'Betrieblich geklärte Magensonde', relevance: 'HKP G1', reviewStatus: 'reviewed', note: 'Durch Betrieb geprüft' });
  expect(listEmployeeCompetencies(employeeId)[0]).toMatchObject({ competencyName: 'Betrieblich geklärte Magensonde', level: null, reviewStatus: 'reviewed', stageHistory: history });
  expect(importHkpCompetencyDefinitions([template.templateKey]).find((row) => row.id === entry.id)?.name).toBe('Betrieblich geklärte Magensonde');
});

it('includes the complete source wording and keeps the observed assistant distinctions', () => {
  const byCode = (code: string) => hkpCatalog.find((row) => row.code === code)!;
  expect(byCode('032265').name).toBe('Legen und Wechseln einer Magensonde');
  expect(byCode('032326').name).toBe('Anhängen, Wechsel oder Abhängen einer i.v.-Infusion');
  for (const code of ['032265', '032326']) {
    expect(matchesQualificationRelevance('Pflegefachkraft', byCode(code).relevance)).toBe(true);
    expect(matchesQualificationRelevance('Krankenpflegeassistenz', byCode(code).relevance)).toBe(false);
    expect(byCode(code).note).toContain('Bestandsschutz');
  }
  expect(byCode('032230').name).toBe('Absaugen der oberen Luftwege / Bronchialtoilette');
  expect(byCode('032201').note).toContain('mindestens 186 Stunden');
  expect(byCode('032B81').note).toContain('Fußnote 1');
  expect(matchesQualificationRelevance('Pflegefachassistenz', byCode('032591').relevance)).toBe(false);
  expect(matchesQualificationRelevance('Krankenpflegeassistenz', byCode('032591').relevance)).toBe(true);
  expect(matchesQualificationRelevance('Pflegefachassistenz', byCode('032276').relevance)).toBe(true);
  expect(matchesQualificationRelevance('Altenpflegehelfer', byCode('032312').relevance)).toBe(false);
  expect(matchesQualificationRelevance('Altenpflegehelfer', byCode('032367').relevance)).toBe(true);
});

it('rejects invalid selections atomically', () => {
  const before = listCompetencyDefinitions();
  for (const input of [[], [keys[0], 'not-a-template'], null, [42]]) {
    expect(() => importHkpCompetencyDefinitions(input as string[])).toThrow();
    expect(listCompetencyDefinitions()).toEqual(before);
  }
});

it('adds only metadata columns to a populated version-23 catalogue', () => {
  db.close(); db = new SqliteAdapter(':memory:'); state.db = db;
  for (const migration of migrations.filter((row) => row.version <= 23)) migration.up(db as never);
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('schema_version','23')").run();
  db.prepare("UPDATE competency_definitions SET note='Individuell gepflegt' WHERE id=1").run();
  const before = db.prepare('SELECT * FROM competency_definitions').all();
  runMigrations(db as never);
  const after = db.prepare('SELECT * FROM competency_definitions').all() as Record<string, unknown>[];
  expect(after.map(({ templateKey, reviewStatus, ...row }) => { expect(templateKey).toBeNull(); expect(reviewStatus).toBeNull(); return row; })).toEqual(before);
});
