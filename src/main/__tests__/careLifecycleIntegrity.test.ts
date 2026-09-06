// @vitest-environment node
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { saveEmployee } from '../repositories/employees';
import {
  savePatient,
  deletePatient,
  listPatients,
  saveVisit,
  getActionNeeded,
  listVisits,
} from '../repositories/patients';
import {
  addInstructionDefinition,
  updateInstructionDefinition,
  saveEmployeeInstruction,
  deleteEmployeeInstruction,
} from '../repositories/instructions';
import { listOpenInstructions, getEmployeeDashboardStats } from '../repositories/dashboard';
import { listEventsInRange, saveEvent } from '../repositories/events';
import { saveAudit, worstResult } from '../repositories/audits';
import { saveEmployeeCompetency, listCompetencyDefinitions } from '../repositories/competencies';
import {
  hkpCodesOf,
  needsAssessment,
  representativeMissing,
  intensiveCareForList,
  visitDue,
} from '../../utils/qpr';
import { buildPersonListRows } from '../workbook';
import { deriveQualificationTags } from '../../utils/qualificationRelevance';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));
const TODAY = '2026-09-06';

describe('care and evidence lifecycles with real SQLite', () => {
  let db: SqliteAdapter;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });
  afterEach(() => {
    db.close();
    vi.useRealTimers();
  });
  const staff = (name = 'Team Test', endDate?: string) =>
    saveEmployee({
      name,
      qualification: '3-jährig examiniert',
      startDate: '2024-01-01',
      endDate,
      weeklyHours: 36,
      fte: 1,
      year: 2024,
      birthDate: '2000-09-10',
    }).employees.find((e) => e.name === name)!;
  const person = () =>
    savePatient({
      name: 'Pflege Test',
      admissionDate: '2026-01-01',
      serviceScope: 'eligible',
      representativeStatus: 'none',
      cognitionImpaired: true,
      mobilityImpaired: false,
      assessmentSource: 'report',
      assessmentDate: TODAY,
      hkpCodes: ['6', '8', '29'],
    })[0];
  const topic = () =>
    addInstructionDefinition({
      topic: 'Gefahren Test',
      intervalMonths: 12,
      intervalSource: 'norm',
      minorHazardInstruction: true,
    }).find((d) => d.topic === 'Gefahren Test')!;

  it('preserves interval and source on partial definition edits', () => {
    const d = topic();
    const updated = updateInstructionDefinition({ id: d.id!, topic: d.topic, note: 'new' }).find(
      (x) => x.id === d.id,
    )!;
    expect(updated).toMatchObject({
      intervalMonths: 12,
      intervalSource: 'norm',
      minorHazardInstruction: true,
    });
    expect(() =>
      updateInstructionDefinition({ id: d.id!, topic: d.topic, intervalMonths: -2 }),
    ).toThrow(/Intervall/);
  });

  it('corrects an automatically linked follow-up, preserves manual rescheduling and deletes one record only', () => {
    const e = staff(),
      d = topic();
    let entries = saveEmployeeInstruction({
      employeeId: e.id!,
      instructionDefinitionId: d.id!,
      completedAt: '2026-03-01',
      scheduleFollowUp: true,
      evidenceRef: 'Personalakte/Test.pdf',
      content: 'Gefahren am Arbeitsplatz',
    });
    const completed = entries.find((x) => x.completedAt)!;
    const follow = entries.find((x) => !x.completedAt)!;
    entries = saveEmployeeInstruction({
      id: completed.id,
      employeeId: e.id!,
      instructionDefinitionId: d.id!,
      completedAt: '2026-04-01',
      scheduleFollowUp: true,
    });
    expect(entries.find((x) => x.id === follow.id)?.dueDate).toBe('2027-04-01');
    saveEmployeeInstruction({
      id: follow.id,
      employeeId: e.id!,
      instructionDefinitionId: d.id!,
      dueDate: '2027-01-15',
    });
    entries = saveEmployeeInstruction({
      id: completed.id,
      employeeId: e.id!,
      instructionDefinitionId: d.id!,
      completedAt: '2026-05-01',
      scheduleFollowUp: true,
    });
    expect(entries.find((x) => x.id === follow.id)?.dueDate).toBe('2027-01-15');
    expect(entries.find((x) => x.id === completed.id)?.evidenceRef).toBe('Personalakte/Test.pdf');
    expect(deleteEmployeeInstruction(e.id!, follow.id!)).toHaveLength(1);
  });

  it('lists more than twenty open items, undated entries and missing evidence, excluding departed staff', () => {
    const e = staff(),
      d = topic(),
      left = staff('Left Test', '2024-06-30');
    for (let i = 0; i < 25; i++)
      saveEmployeeInstruction({
        employeeId: e.id!,
        instructionDefinitionId: d.id!,
        dueDate: '2026-09-01',
      });
    saveEmployeeInstruction({ employeeId: e.id!, instructionDefinitionId: d.id! });
    saveEmployeeInstruction({
      employeeId: e.id!,
      instructionDefinitionId: d.id!,
      completedAt: TODAY,
    });
    saveEmployeeInstruction({
      employeeId: left.id!,
      instructionDefinitionId: d.id!,
      dueDate: '2026-01-01',
    });
    const entries = listOpenInstructions();
    expect(entries).toHaveLength(27);
    expect(entries.some((x) => x.dueDate === null)).toBe(true);
    expect(entries.some((x) => x.evidenceMissing)).toBe(true);
    expect(entries.some((x) => x.employeeId === left.id)).toBe(false);
  });

  it('keeps multiple HKP codes and archives without deleting visits or audit participants', () => {
    const p = person();
    expect(hkpCodesOf(p)).toEqual(['6', '8', '29']);
    expect(buildPersonListRows([p])[0]['Aufwändige HKP (Ziffer)']).toBe('6, 8, 29');
    saveVisit({ patientId: p.id!, visitDate: TODAY, actionNeeded: false, status: 'completed' });
    saveAudit({ auditDate: TODAY, results: [], clientIds: [p.id!] });
    deletePatient(p.id!);
    expect(listVisits(p.id!)).toHaveLength(1);
    expect(db.prepare('SELECT COUNT(*) as n FROM audit_clients').get()).toMatchObject({ n: 1 });
    expect(buildPersonListRows(listPatients())).toHaveLength(0);
  });

  it('makes stale assessments and representatives explicit and computes pHKP E from both conditions', () => {
    const p = person();
    expect(needsAssessment(p, TODAY)).toBe(false);
    expect(needsAssessment({ ...p, assessmentDate: '2025-09-05' }, TODAY)).toBe(true);
    expect(needsAssessment({ ...p, assessmentDate: '2025-09-06' }, TODAY)).toBe(false);
    expect(needsAssessment({ ...p, assessmentSource: 'own', assessmentNote: null }, TODAY)).toBe(
      true,
    );
    expect(representativeMissing(p)).toBe(false);
    expect(
      intensiveCareForList(
        { ...p, intensiveCare: 'pHKP', phkpFirst: true, phkpStartDate: '2026-08-10' },
        TODAY,
      ),
    ).toBe('pHKP E');
    expect(
      intensiveCareForList(
        { ...p, intensiveCare: 'pHKP-EV', phkpFirst: true, phkpStartDate: '2026-08-09' },
        TODAY,
      ),
    ).toBe('pHKP');
    expect(
      intensiveCareForList(
        { ...p, intensiveCare: 'pHKP', phkpFirst: false, phkpStartDate: TODAY },
        TODAY,
      ),
    ).toBe('pHKP');
  });

  it('does not count a planned visit as completed or clear earlier actions through another visit', () => {
    const p = person();
    const first = saveVisit({
      patientId: p.id!,
      visitDate: '2026-08-01',
      actionNeeded: true,
      status: 'completed',
    })[0];
    saveVisit({
      patientId: p.id!,
      visitDate: '2026-08-20',
      actionNeeded: false,
      status: 'completed',
    });
    saveVisit({
      patientId: p.id!,
      visitDate: '2026-09-01',
      actionNeeded: false,
      status: 'planned',
    });
    expect(listPatients()[0].latestVisitDate).toBe('2026-08-20');
    expect(listPatients()[0].latestActionNeeded).toBe(true);
    expect(getActionNeeded()).toHaveLength(1);
    saveVisit({
      id: first.id,
      patientId: p.id!,
      visitDate: first.visitDate,
      actionNeeded: true,
      resolvedAt: TODAY,
      status: 'completed',
      comment: 'Maßnahme nachkontrolliert',
    });
    expect(getActionNeeded()).toHaveLength(0);
    expect(() =>
      saveVisit({
        patientId: p.id!,
        visitDate: '2027-01-01',
        status: 'completed',
        actionNeeded: false,
      }),
    ).toThrow(/zukünftige/);
    expect(visitDue({}, TODAY)).toMatchObject({ missingAnchor: true, dueDate: '' });
  });

  it('starts audits unrecorded and requires an original reference for confirmation', () => {
    const audit = saveAudit({ auditDate: TODAY, results: [], clientIds: [] })[0];
    expect(audit.confirmed).toBe(false);
    expect(worstResult(audit.results)).toBeNull();
    expect(() =>
      saveAudit({ auditDate: TODAY, confirmed: true, results: [], clientIds: [] }),
    ).toThrow(/Originalbericht/);
    expect(() =>
      saveAudit({
        auditDate: TODAY,
        results: [{ sectionKey: 'qb1', result: 'ok' }],
        clientIds: [],
      }),
    ).toThrow(/Qualitätsbereich/);
  });

  it('distinguishes assistant qualifications and confirms onboarding only at stage six', () => {
    expect(deriveQualificationTags('1-jährig examiniert').has('Nur PFK')).toBe(false);
    expect(deriveQualificationTags('3-jährig examiniert').has('Nur PFK')).toBe(true);
    const e = staff(),
      d = listCompetencyDefinitions()[0];
    const input = {
      employeeId: e.id!,
      competencyDefinitionId: d.id!,
      stageScheme: 'practice-v1' as const,
      level: 5,
      approvedAt: TODAY,
      approvedBy: 'Testleitung',
    };
    saveEmployeeCompetency(input);
    expect(getEmployeeDashboardStats().competencies.approvedRate).toBe(0);
    expect(() => saveEmployeeCompetency({ ...input, level: 6, approvedBy: null })).toThrow(
      /Abschluss/,
    );
    const items = saveEmployeeCompetency({ ...input, level: 6 });
    expect(items[0].stageHistory).toHaveLength(2);
    expect(getEmployeeDashboardStats().competencies.approvedRate).toBe(100);
  });

  it('puts staff birthdays, instruction due dates and certificate expiry on the calendar', () => {
    const e = staff(),
      d = topic();
    saveEmployeeInstruction({
      employeeId: e.id!,
      instructionDefinitionId: d.id!,
      dueDate: '2026-09-12',
    });
    saveEvent({
      employeeId: e.id!,
      eventDate: '2025-09-01',
      type: 'emergency-training',
      title: 'Test training',
      expiresAt: '2026-09-15',
    });
    const events = listEventsInRange('2026-09-01', '2026-09-30');
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'birthday', eventDate: '2026-09-10' }),
        expect.objectContaining({ type: 'instruction-due', eventDate: '2026-09-12' }),
        expect.objectContaining({ type: 'certificate-expiry', eventDate: '2026-09-15' }),
      ]),
    );
  });
});
