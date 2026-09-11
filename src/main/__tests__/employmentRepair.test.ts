// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { saveEmployee } from '../repositories/employees';
import { saveEmployeeCompetency } from '../repositories/competencies';
import { saveEmployeeInstruction } from '../repositories/instructions';
import { saveEvent } from '../repositories/events';
import {
  applyConsolidatePeriods,
  applyEmployeeMerge,
  getEmploymentIntegrityOverview,
  previewConsolidatePeriods,
  previewEmployeeMerge,
  applyReconcilePeriods,
  previewReconcilePeriods,
} from '../employmentRepair';
import type { IntegrityIssueKind } from '../../shared/types';

const countIssues = (kind: IntegrityIssueKind): number =>
  getEmploymentIntegrityOverview().issues.filter((issue) => issue.kind === kind).length;

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));

describe('employment repair previews and transactions', () => {
  let db: SqliteAdapter;

  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });
  afterEach(() => db.close());

  const person = (name: string, startDate: string, endDate: string | null = null) =>
    saveEmployee({
      name,
      qualification: 'Pflegekraft/-helfer',
      startDate,
      endDate,
      weeklyHours: 36,
      fte: 1,
      year: Number(startDate.slice(0, 4)),
    }).employees[0];

  it('reports malformed periods and same-name warnings without changing data', () => {
    const first = person('Test Person', '2024-01-01');
    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run('2023-12-31', first.periodId);
    person('Test Person', '2025-01-01');
    const before = db.serialize();
    const overview = getEmploymentIntegrityOverview();
    expect(overview.issues.filter((issue) => issue.kind === 'reversed-period')).toHaveLength(1);
    // One warning per person, so both pages offer the merge.
    expect(overview.issues.filter((issue) => issue.kind === 'same-name')).toHaveLength(2);
    expect(overview.issues.find((issue) => issue.periodIds.includes(first.periodId!))).toMatchObject({
      severity: 'error',
    });
    expect(db.serialize()).toEqual(before);
  });

  it('reports an open period overlapping a later finite period', () => {
    const first = person('Offener Zeitraum', '2024-01-01');
    db.prepare('INSERT INTO employment_periods(employeeId,startDate,endDate,qualification) VALUES (?,?,?,?)').run(
      first.id,
      '2024-03-01',
      '2024-06-01',
      first.qualification,
    );
    expect(countIssues('overlapping-periods')).toBe(1);
  });

  it('includes employees without periods when they still have repair evidence', () => {
    const target = person('Ziel mit Zeitraum', '2024-01-01', '2024-12-31');
    const orphanId = Number(db.prepare('INSERT INTO employees(name,birthDate,note,weeklyHours,fte,department) VALUES (?,?,?,?,?,?)').run('Nachweis ohne Zeitraum', '1982-06-07', 'orphan evidence', null, null, 'Pflege').lastInsertRowid);
    const competencyId = Number((db.prepare('SELECT id FROM competency_definitions LIMIT 1').get() as { id: number }).id);
    saveEmployeeCompetency({ employeeId: orphanId, competencyDefinitionId: competencyId, level: 2, stageScheme: 'practice-v1' });
    saveEvent({ employeeId: orphanId, eventDate: '2026-02-01', type: 'custom', title: 'Orphan Nachweis', meta: { source: 'synthetic' } });

    const overview = getEmploymentIntegrityOverview();

    expect(overview.employees).toContainEqual({
      id: orphanId,
      name: 'Nachweis ohne Zeitraum',
      birthDate: '1982-06-07',
    });
    expect(overview.periods.some((period) => period.employeeId === orphanId)).toBe(false);
    const preview = previewEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: orphanId });
    expect(preview.conflicts).toEqual([]);
    expect(preview.source).toEqual({ id: orphanId, name: 'Nachweis ohne Zeitraum' });
    expect(preview.linkedRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'employee_events', count: 1 }),
      expect.objectContaining({ table: 'employee_competencies', count: 1 }),
    ]));
  });

  it('records the previous dates when the period editor corrects a reversed period', () => {
    const first = person('Reparatur Test', '2024-05-01');
    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run('2024-01-31', first.periodId);
    saveEmployee({
      id: first.id,
      periodId: first.periodId,
      name: 'Reparatur Test',
      qualification: first.qualification,
      startDate: '2024-05-01',
      endDate: '2024-06-30',
      weeklyHours: 36,
      fte: 1,
      updateHours: false,
      year: 2024,
    });
    expect(db.prepare('SELECT startDate,endDate FROM employment_periods WHERE id=?').get(first.periodId)).toEqual({
      startDate: '2024-05-01',
      endDate: '2024-06-30',
    });
    expect(countIssues('reversed-period')).toBe(0);
    const correctionAudit = db.prepare("SELECT meta,previousValue,newValue FROM employee_events WHERE title='Zeitraum korrigiert – ursprüngliche Daten erhalten'").get() as { meta: string; previousValue: string; newValue: string };
    expect(JSON.parse(correctionAudit.meta)).toMatchObject({
      kind: 'employment-period-date-correction',
      period: { id: first.periodId, startDate: '2024-05-01', endDate: '2024-01-31' },
      correctedDates: { startDate: '2024-05-01', endDate: '2024-06-30' },
    });
    expect(correctionAudit).toMatchObject({
      previousValue: '2024-05-01 – 2024-01-31',
      newValue: '2024-05-01 – 2024-06-30',
    });
  });

  it('refuses a period edit that would leave a working-time record outside the section', () => {
    const employee = person('Arbeitszeit Grenze', '2024-01-01', '2024-12-31');
    expect(() =>
      saveEmployee({
        id: employee.id,
        periodId: employee.periodId,
        name: 'Arbeitszeit Grenze',
        qualification: employee.qualification,
        startDate: '2024-03-01',
        endDate: '2024-12-31',
        weeklyHours: 36,
        fte: 1,
        updateHours: false,
        year: 2024,
      }),
    ).toThrow(/außerhalb des neuen Zeitraums/);
  });

  it('only warns about a migrated section while the migration note is still there', () => {
    const employee = person('Übernahme Notiz', '2024-01-01');
    db.prepare('UPDATE employment_periods SET note=? WHERE id=?').run(
      'Aus bisherigem Eintrittsereignis übernommen. Qualifikation und Stunden prüfen.',
      employee.periodId,
    );
    expect(countIssues('suspicious-period')).toBe(1);
    db.prepare('UPDATE employment_periods SET note=? WHERE id=?').run('Vertrag prüfen', employee.periodId);
    expect(countIssues('suspicious-period')).toBe(0);
  });

  it('resolves an explicit malformed duplicate section without guessing its dates', () => {
    const employee = person('Übernahme Test', '2025-01-01');
    const firstPeriodId = employee.periodId!;
    db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run('2024-03-31', firstPeriodId);
    const secondPeriodId = Number(db.prepare('INSERT INTO employment_periods(employeeId,startDate,endDate,qualification,note) VALUES (?,?,?,?,?)').run(employee.id, '2025-01-01', null, employee.qualification, 'Übernommener Abschnitt prüfen').lastInsertRowid);
    db.prepare('INSERT INTO employment_terms(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) SELECT ?,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms WHERE periodId=?').run(secondPeriodId, firstPeriodId);
    const removedTermId = Number((db.prepare('SELECT id FROM employment_terms WHERE periodId=?').get(firstPeriodId) as { id: number }).id);
    const retainedTermId = Number((db.prepare('SELECT id FROM employment_terms WHERE periodId=?').get(secondPeriodId) as { id: number }).id);
    const preview = previewReconcilePeriods({
      periodIds: [firstPeriodId, secondPeriodId],
      retainedPeriodId: secondPeriodId,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
    expect(preview.conflicts).toEqual([]);
    applyReconcilePeriods({
      periodIds: [firstPeriodId, secondPeriodId],
      retainedPeriodId: secondPeriodId,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      previewToken: preview.token,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM employment_periods WHERE employeeId=?').get(employee.id!)).toEqual({ count: 1 });
    expect(db.prepare('SELECT startDate,endDate FROM employment_periods WHERE id=?').get(secondPeriodId)).toEqual({ startDate: '2025-01-01', endDate: '2025-12-31' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM employment_terms WHERE periodId=?').get(secondPeriodId)).toEqual({ count: 1 });
    expect(Number((db.prepare('SELECT COUNT(*) AS count FROM employment_term_history WHERE periodId=?').get(secondPeriodId) as { count: number }).count)).toBeGreaterThanOrEqual(2);
    const reconciliationAudit = db.prepare("SELECT meta FROM employee_events WHERE title='Abschnittsauflösung – ursprünglicher Abschnitt erhalten'").get() as { meta: string };
    expect(JSON.parse(reconciliationAudit.meta)).toMatchObject({
      kind: 'employment-period-reconciliation',
      removedPeriod: { id: firstPeriodId, startDate: '2025-01-01', endDate: '2024-03-31' },
      duplicateCurrentTerms: [{ source: { id: removedTermId, periodId: firstPeriodId }, target: { id: retainedTermId, periodId: secondPeriodId } }],
    });
  });

  it('blocks a corrected range that excludes a retained term and rolls back', () => {
    const employee = person('Begrenzter Zeitraum Test', '2024-01-01', '2024-12-31');
    const removedPeriodId = Number(db.prepare('INSERT INTO employment_periods(employeeId,startDate,endDate,qualification) VALUES (?,?,?,?)').run(employee.id, '2025-01-01', null, employee.qualification).lastInsertRowid);
    const preview = previewReconcilePeriods({
      periodIds: [employee.periodId!, removedPeriodId],
      retainedPeriodId: employee.periodId!,
      startDate: '2024-02-01',
      endDate: '2024-12-31',
    });
    expect(preview.conflicts).toContain('Der Arbeitszeitstand vom 01.01.2024 läge außerhalb des korrigierten Zeitraums.');
    const before = db.serialize();
    expect(() => applyReconcilePeriods({
      periodIds: [employee.periodId!, removedPeriodId],
      retainedPeriodId: employee.periodId!,
      startDate: '2024-02-01',
      endDate: '2024-12-31',
      previewToken: preview.token,
    })).toThrow(/Arbeitszeitstand/);
    expect(db.serialize()).toEqual(before);
  });

  it('does not resolve two valid periods separated by a gap', () => {
    const employee = person('Lücke Test', '2024-01-01', '2024-01-31');
    const separatePeriodId = Number(db.prepare('INSERT INTO employment_periods(employeeId,startDate,endDate,qualification) VALUES (?,?,?,?)').run(employee.id, '2024-03-01', '2024-03-31', employee.qualification).lastInsertRowid);
    const preview = previewReconcilePeriods({
      periodIds: [employee.periodId!, separatePeriodId],
      retainedPeriodId: employee.periodId!,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });
    expect(preview.conflicts).toContain('Die ausgewählten Zeiträume sind getrennte gültige Abschnitte. Eine Auflösung würde einen echten Zeitraum entfernen.');
    const before = db.serialize();
    expect(() => applyReconcilePeriods({
      periodIds: [employee.periodId!, separatePeriodId],
      retainedPeriodId: employee.periodId!,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      previewToken: preview.token,
    })).toThrow(/getrennte gültige Abschnitte/);
    expect(db.serialize()).toEqual(before);
  });

  it('retains every employee relation during an explicit merge', () => {
    const target = person('Merge Ziel', '2024-01-01', '2024-12-31');
    const source = person('Merge Quelle', '2025-01-01');
    const competencyId = Number((db.prepare('SELECT id FROM competency_definitions LIMIT 1').get() as { id: number }).id);
    const instructionDefinitionId = Number((db.prepare('SELECT id FROM instruction_definitions LIMIT 1').get() as { id: number }).id);
    saveEmployeeCompetency({ employeeId: source.id!, competencyDefinitionId: competencyId, level: 2, stageScheme: 'practice-v1' });
    saveEmployeeInstruction({ employeeId: source.id!, instructionDefinitionId, dueDate: '2026-04-01', completedAt: '2026-03-01', conductedBy: 'Test Leitung', evidenceRef: 'synthetic-evidence', content: 'synthetic-content', scheduleReviewRequired: true });
    db.prepare('UPDATE employee_instructions SET scheduleReviewRequired=1 WHERE employeeId=?').run(source.id);
    db.prepare('UPDATE employees SET note=?,department=? WHERE id=?').run('synthetic source metadata', 'synthetic department', source.id);
    saveEvent({ employeeId: source.id!, eventDate: '2026-02-01', type: 'custom', title: 'Test Ereignis', meta: { evidence: 'kept' } });
    db.exec('CREATE TABLE linked_employee_test (id INTEGER PRIMARY KEY, personId INTEGER NOT NULL REFERENCES employees(id))');
    db.prepare('INSERT INTO linked_employee_test(id,personId) VALUES (?,?)').run(1, source.id);

    const instructionId = Number((db.prepare('SELECT id FROM employee_instructions WHERE employeeId=?').get(source.id!) as { id: number }).id);
    const followUpId = Number(db.prepare('INSERT INTO employee_instructions(employeeId,instructionDefinitionId,dueDate,previousInstructionId) VALUES (?,?,?,?)').run(source.id, instructionDefinitionId, '2027-03-01', instructionId).lastInsertRowid);
    const merge = previewEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id! });
    expect(merge.conflicts).toEqual([]);
    applyEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id!, previewToken: merge.token });

    expect(db.prepare('SELECT id FROM employees WHERE id=?').get(source.id!)).toBeUndefined();
    expect(db.prepare('SELECT personId FROM linked_employee_test').get()).toEqual({ personId: target.id });
    expect(db.prepare('SELECT employeeId,meta FROM employee_events WHERE title=?').get('Test Ereignis')).toMatchObject({ employeeId: target.id, meta: JSON.stringify({ evidence: 'kept' }) });
    expect(db.prepare('SELECT employeeId FROM employee_competencies WHERE competencyDefinitionId=?').get(competencyId)).toEqual({ employeeId: target.id });
    expect(db.prepare('SELECT employeeId,evidenceRef,content,scheduleReviewRequired FROM employee_instructions WHERE id=?').get(instructionId)).toEqual({ employeeId: target.id, evidenceRef: 'synthetic-evidence', content: 'synthetic-content', scheduleReviewRequired: 1 });
    expect(db.prepare('SELECT employeeId,previousInstructionId FROM employee_instructions WHERE id=?').get(followUpId)).toEqual({ employeeId: target.id, previousInstructionId: instructionId });
    expect(db.prepare('SELECT p.employeeId,COUNT(t.id) AS count FROM employment_terms t JOIN employment_periods p ON p.id=t.periodId WHERE p.employeeId=?').get(target.id)).toMatchObject({ employeeId: target.id, count: 2 });
    expect(db.prepare('SELECT COUNT(h.id) AS count FROM employment_term_history h JOIN employment_periods p ON p.id=h.periodId WHERE p.employeeId=?').get(target.id)).toMatchObject({ count: 2 });
    const mergeAudit = db.prepare("SELECT meta,previousValue,newValue FROM employee_events WHERE title='Zusammenführung – Quelldaten erhalten'").get() as { meta: string; previousValue: string; newValue: string };
    expect(JSON.parse(mergeAudit.meta)).toMatchObject({
      kind: 'employee-merge-source',
      sourceEmployeeId: source.id,
      sourceEmployee: { id: source.id, name: 'Merge Quelle', note: 'synthetic source metadata', department: 'synthetic department' },
    });
    expect(mergeAudit).toMatchObject({ previousValue: 'Merge Quelle', newValue: 'Merge Ziel' });
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });

  it('blocks conflicting current competency values and rolls back', () => {
    const target = person('Konflikt Ziel', '2024-01-01', '2024-12-31');
    const source = person('Konflikt Quelle', '2025-01-01');
    const competencyId = Number((db.prepare('SELECT id FROM competency_definitions LIMIT 1').get() as { id: number }).id);
    saveEmployeeCompetency({ employeeId: target.id!, competencyDefinitionId: competencyId, level: 1, stageScheme: 'practice-v1' });
    saveEmployeeCompetency({ employeeId: source.id!, competencyDefinitionId: competencyId, level: 4, stageScheme: 'practice-v1' });
    const merge = previewEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id! });
    expect(merge.conflicts[0]).toMatch(/aktuellen Angaben/);
    expect(() => applyEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id!, previewToken: merge.token })).toThrow(/aktuellen Angaben/);
    expect(db.prepare('SELECT id FROM employees WHERE id=?').get(source.id!)).toBeDefined();
    expect(db.prepare('SELECT COUNT(*) AS count FROM employee_competencies WHERE employeeId=?').get(source.id!)).toEqual({ count: 1 });
  });

  it('deduplicates equal current competency rows only with a complete audit snapshot', () => {
    const target = person('Gleiche Qualifikation Ziel', '2024-01-01', '2024-12-31');
    const source = person('Gleiche Qualifikation Quelle', '2025-01-01');
    const competencyId = Number((db.prepare('SELECT id FROM competency_definitions LIMIT 1').get() as { id: number }).id);
    saveEmployeeCompetency({ employeeId: target.id!, competencyDefinitionId: competencyId, level: 2, stageScheme: 'practice-v1' });
    saveEmployeeCompetency({ employeeId: source.id!, competencyDefinitionId: competencyId, level: 2, stageScheme: 'practice-v1' });
    const merge = previewEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id! });
    expect(merge.conflicts).toEqual([]);
    applyEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id!, previewToken: merge.token });
    expect(db.prepare('SELECT COUNT(*) AS count FROM employee_competencies WHERE employeeId=? AND competencyDefinitionId=?').get(target.id, competencyId)).toEqual({ count: 1 });
    const audit = db.prepare("SELECT meta FROM employee_events WHERE title='Zusammenführung – Quelldaten erhalten'").get() as { meta: string };
    expect(JSON.parse(audit.meta)).toMatchObject({ equivalentCompetencies: [{ source: { employeeId: source.id }, target: { employeeId: target.id } }] });
  });

  it('rejects stale previews before any merge write', () => {
    const target = person('Stale Ziel', '2024-01-01');
    const source = person('Stale Quelle', '2025-01-01');
    const merge = previewEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id! });
    db.prepare('UPDATE employees SET note=? WHERE id=?').run('zwischenzeitliche Änderung', target.id);
    expect(() => applyEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id!, previewToken: merge.token })).toThrow(/veraltet/);
    expect(db.prepare('SELECT id FROM employees WHERE id=?').get(source.id!)).toBeDefined();
  });

  it('keeps a repair preview valid when backup bookkeeping changes', () => {
    const target = person('Backup Ziel', '2024-01-01', '2024-12-31');
    const source = person('Backup Quelle', '2025-01-01');
    const merge = previewEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id! });
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('backupLastAt',?)").run('2026-09-11T12:00:00.000Z');
    expect(() => applyEmployeeMerge({ targetEmployeeId: target.id!, sourceEmployeeId: source.id!, previewToken: merge.token })).not.toThrow();
    expect(db.prepare('SELECT id FROM employees WHERE id=?').get(source.id!)).toBeUndefined();
  });

  it('consolidates adjacent same-qualification periods while retaining term history', () => {
    const first = person('Zusammenlegung Test', '2024-01-01', '2024-06-30');
    const second = saveEmployee({
      id: first.id,
      name: 'Zusammenlegung Test',
      qualification: 'Pflegekraft/-helfer',
      startDate: '2024-07-01',
      weeklyHours: 36,
      fte: 1,
      year: 2024,
    }).employees[0];
    const periods = db.prepare('SELECT id FROM employment_periods WHERE employeeId=? ORDER BY startDate').all(first.id!) as { id: number }[];
    const preview = previewConsolidatePeriods({ periodIds: [periods[0].id, periods[1].id] });
    expect(preview.conflicts).toEqual([]);
    applyConsolidatePeriods({ periodIds: [periods[0].id, periods[1].id], previewToken: preview.token });
    expect(db.prepare('SELECT COUNT(*) AS count FROM employment_periods WHERE employeeId=?').get(first.id!)).toEqual({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM employment_term_history WHERE periodId=?').get(periods[0].id)).toEqual({ count: 2 });
    const consolidationAudit = db.prepare("SELECT meta FROM employee_events WHERE title='Zusammenlegung – ursprünglicher Abschnitt erhalten'").get() as { meta: string };
    expect(JSON.parse(consolidationAudit.meta)).toMatchObject({
      kind: 'employment-period-consolidation',
      removedPeriod: { id: periods[1].id, startDate: '2024-07-01' },
    });
    expect(second.id).toBe(first.id);
  });
});
