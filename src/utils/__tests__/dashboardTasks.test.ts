/// <reference types="vitest/globals" />

import { buildDashboardTasks, buildDataQuality } from '../dashboardTasks';
import type {
  EmployeeWithPeriod,
  OpenInstruction,
  PatientWithLatestVisit,
} from '../../shared/types';

const TODAY = '2026-09-05';

const patient = (overrides: Partial<PatientWithLatestVisit> = {}): PatientWithLatestVisit => ({
  id: 1,
  name: 'Erika Mustermann',
  serviceScope: 'eligible',
  assessmentSource: 'report',
  assessmentDate: '2026-01-01',
  cognitionImpaired: true,
  mobilityImpaired: false,
  contact: 'Tochter · 0171',
  latestVisitDate: TODAY,
  latestActionNeeded: false,
  ...overrides,
});

const employee = (overrides: Partial<EmployeeWithPeriod> = {}): EmployeeWithPeriod => ({
  id: 10,
  name: 'Anna Berger',
  qualification: '3-jährig examiniert',
  startDate: '2016-03-01',
  employmentStartDate: '2016-03-01',
  endDate: null,
  fte: 1,
  weeklyHours: 36,
  status: 'active',
  birthDate: '1985-06-12',
  ...overrides,
});

const build = (input: {
  patients?: PatientWithLatestVisit[];
  employees?: EmployeeWithPeriod[];
  openInstructions?: OpenInstruction[];
}) =>
  buildDashboardTasks({
    today: TODAY,
    patients: input.patients ?? [],
    employees: input.employees ?? [],
    openInstructions: input.openInstructions ?? [],
    visitIntervalDays: 90,
  });

describe('buildDashboardTasks', () => {
  it('meldet Handlungsbedarf aus der letzten Visite', () => {
    const tasks = build({ patients: [patient({ latestActionNeeded: true })] });

    expect(tasks[0].id).toBe('patient-action-1');
    expect(tasks[0].title).toContain('Handlungsbedarf aus Visite');
  });

  it('meldet fehlende Gutachten-Daten', () => {
    const tasks = build({
      patients: [patient({ cognitionImpaired: null, mobilityImpaired: null })],
    });

    expect(tasks.map((task) => task.id)).toContain('patient-assessment-1');
  });

  it('meldet überfällige Pflegevisiten mit Tagen', () => {
    const tasks = build({ patients: [patient({ latestVisitDate: '2026-01-01' })] });
    const visitTask = tasks.find((task) => task.id === 'patient-visit-1');

    expect(visitTask?.sub).toContain('157 Tage');
  });

  it('erkennt eine fehlende Erstvisite ab der Aufnahme', () => {
    const tasks = build({
      patients: [patient({ latestVisitDate: null, admissionDate: '2026-07-01' })],
    });

    expect(tasks.find((task) => task.id === 'patient-visit-1')?.title).toContain('Erstvisite');
  });

  it('meldet fehlende Bevollmächtigte für Anlage 7', () => {
    const tasks = build({ patients: [patient({ contact: '   ' })] });

    expect(tasks.map((task) => task.id)).toContain('patient-contact-1');
  });

  it('meldet überfällige Einweisungen, aber keine fernen', () => {
    const tasks = build({
      openInstructions: [
        {
          id: 1,
          employeeId: 10,
          employeeName: 'Anna Berger',
          topic: 'Brandschutz',
          legalBasis: 'ArbSchG §12',
          dueDate: '2026-08-15',
          daysUntilDue: -21,
        },
        {
          id: 2,
          employeeId: 10,
          employeeName: 'Anna Berger',
          topic: 'Hygiene',
          dueDate: '2027-02-01',
          daysUntilDue: 149,
        },
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].sub).toContain('Fällig 15.08.2026');
    expect(tasks[0].target).toEqual({ kind: 'employee', id: 10, tab: 'instr' });
  });

  it('bereitet nahe Austritte vor, ignoriert ferne', () => {
    const near = build({ employees: [employee({ endDate: '2026-09-30' })] });
    const far = build({ employees: [employee({ endDate: '2027-09-30' })] });

    expect(near.map((task) => task.id)).toContain('employee-leave-10');
    expect(far.map((task) => task.id)).not.toContain('employee-leave-10');
  });

  it('meldet fehlende Wochenstunden nur für aktive Personen', () => {
    const active = build({ employees: [employee({ weeklyHours: null })] });
    const left = build({ employees: [employee({ weeklyHours: null, status: 'left' })] });

    expect(active.map((task) => task.id)).toContain('employee-hours-10');
    expect(left.map((task) => task.id)).not.toContain('employee-hours-10');
  });

  it('sortiert Dringendes nach oben', () => {
    const tasks = build({
      patients: [
        patient({ id: 1, name: 'A', contact: '' }),
        patient({ id: 2, name: 'B', latestActionNeeded: true }),
      ],
    });

    expect(tasks[0].id).toBe('patient-action-2');
  });

  it('liefert nichts, wenn alles gepflegt ist', () => {
    expect(build({ patients: [patient()], employees: [employee()] })).toEqual([]);
  });
});

describe('buildDataQuality', () => {
  it('meldet Lücken mit Sprungziel', () => {
    const checks = buildDataQuality(
      [employee({ weeklyHours: null }), employee({ id: 11, name: 'B', birthDate: null })],
      [patient({ cognitionImpaired: null })],
    );

    const hours = checks.find((check) => check.id === 'hours');
    expect(hours?.label).toBe('1 Person ohne Wochenstunden');
    expect(hours?.target).toEqual({ kind: 'employee', id: 10 });

    expect(checks.find((check) => check.id === 'assessment')?.label).toContain('Gutachten-Daten');
  });

  it('meldet Vollständigkeit ohne Sprungziel', () => {
    const checks = buildDataQuality([employee()], [patient()]);

    expect(checks.every((check) => check.target === undefined)).toBe(true);
    expect(checks.find((check) => check.id === 'hours')?.label).toBe(
      'Alle Personen haben Wochenstunden',
    );
  });
});
