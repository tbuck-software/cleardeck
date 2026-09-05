/**
 * "Heute zu tun" — derived, never stored.
 *
 * Every task points at the record that would clear it, so the list stays a view
 * of the data rather than a second copy of it. Ticking one off is a local
 * dismissal for the session; fixing the underlying record is what removes it.
 */

import type { EmployeeWithPeriod, OpenInstruction, PatientWithLatestVisit } from '../shared/types';
import { daysBetween, teilgruppeOf, visitDue } from './qpr';

export type TaskTarget =
  | { kind: 'employee'; id: number; tab?: 'comp' | 'instr' | 'hist' }
  | { kind: 'patient'; id: number };

export type DashboardTask = {
  id: string;
  title: string;
  sub: string;
  tag: string;
  tagClass: string;
  /** Lower sorts first. */
  weight: number;
  target: TaskTarget;
};

type BuildInput = {
  today: string;
  patients: PatientWithLatestVisit[];
  employees: EmployeeWithPeriod[];
  openInstructions: OpenInstruction[];
  visitIntervalDays: number;
  /** Leaving within this window is worth preparing for. */
  leaveHorizonDays?: number;
};

const formatDate = (iso: string): string =>
  iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '—';

export const buildDashboardTasks = ({
  today,
  patients,
  employees,
  openInstructions,
  visitIntervalDays,
  leaveHorizonDays = 60,
}: BuildInput): DashboardTask[] => {
  const tasks: DashboardTask[] = [];

  patients.forEach((patient) => {
    if (patient.id == null) return;
    const target: TaskTarget = { kind: 'patient', id: patient.id };

    if (patient.latestActionNeeded) {
      tasks.push({
        id: `patient-action-${patient.id}`,
        title: `${patient.name} — Handlungsbedarf aus Visite`,
        sub: `Letzte Visite ${formatDate(patient.latestVisitDate ?? '')} · Folgevisite dokumentieren`,
        tag: 'Visite',
        tagClass: 'tag-bad',
        weight: 0,
        target,
      });
    }

    const missingAssessment =
      patient.cognitionImpaired == null || patient.mobilityImpaired == null;
    if (missingAssessment) {
      tasks.push({
        id: `patient-assessment-${patient.id}`,
        title: `${patient.name} — Gutachten-Daten fehlen`,
        sub: 'Mobilität (Modul 1) und Kognition (Modul 2) eintragen, sonst ist die MD-Stichprobenliste unvollständig',
        tag: 'Stammdaten',
        tagClass: 'tag-accent',
        weight: 2,
        target,
      });
    }

    const due = visitDue(
      { latestVisitDate: patient.latestVisitDate, admissionDate: patient.admissionDate },
      today,
      visitIntervalDays,
    );
    if (due.overdue) {
      tasks.push({
        id: `patient-visit-${patient.id}`,
        title: `${patient.name} — ${due.first ? 'Erstvisite' : 'Pflegevisite'} überfällig`,
        sub: `Fällig war ${formatDate(due.dueDate)} · ${-due.daysUntilDue} Tage`,
        tag: 'Visite',
        tagClass: 'tag-accent',
        weight: 1,
        target,
      });
    }

    if (!patient.contact?.trim()) {
      tasks.push({
        id: `patient-contact-${patient.id}`,
        title: `${patient.name} — Bevollmächtigte/Betreuung fehlt`,
        sub: 'Anlage 7 verlangt Name und Telefon, sofern vorhanden',
        tag: 'Stammdaten',
        tagClass: 'tag-neutral',
        weight: 5,
        target,
      });
    }
  });

  openInstructions.forEach((instruction) => {
    const overdue = instruction.daysUntilDue < 0;
    if (!overdue && instruction.daysUntilDue > 30) return;
    tasks.push({
      id: `instruction-${instruction.id}`,
      title: `${instruction.employeeName} — Einweisung ${instruction.topic} ${overdue ? 'überfällig' : 'bald fällig'}`,
      sub: overdue
        ? `Fällig seit ${-instruction.daysUntilDue} Tagen${instruction.legalBasis ? ` · ${instruction.legalBasis}` : ''}`
        : `Fällig ${formatDate(instruction.dueDate)}${instruction.legalBasis ? ` · ${instruction.legalBasis}` : ''}`,
      tag: 'Einweisung',
      tagClass: overdue ? 'tag-accent' : 'tag-neutral',
      weight: overdue ? 1 : 4,
      target: { kind: 'employee', id: instruction.employeeId, tab: 'instr' },
    });
  });

  employees.forEach((employee) => {
    if (employee.id == null) return;

    if (employee.endDate) {
      const days = daysBetween(today, employee.endDate);
      if (days >= 0 && days <= leaveHorizonDays) {
        tasks.push({
          id: `employee-leave-${employee.id}`,
          title: `${employee.name} — Austritt zum ${formatDate(employee.endDate)} vorbereiten`,
          sub: 'Zeugnis, Schlüssel, Zugänge',
          tag: 'Personal',
          tagClass: 'tag-accent-2',
          weight: 3,
          target: { kind: 'employee', id: employee.id, tab: 'hist' },
        });
      }
    }

    if (employee.status === 'active' && employee.weeklyHours == null) {
      tasks.push({
        id: `employee-hours-${employee.id}`,
        title: `${employee.name} — Wochenstunden fehlen`,
        sub: 'Ohne Stundenzahl fehlt die Person in der VZÄ-Summe des Jahresnachweises',
        tag: 'Daten',
        tagClass: 'tag-neutral',
        weight: 5,
        target: { kind: 'employee', id: employee.id, tab: 'hist' },
      });
    }
  });

  return tasks.sort((a, b) => a.weight - b.weight || a.title.localeCompare(b.title, 'de'));
};

export type DataQualityCheck = {
  id: string;
  label: string;
  dot: string;
  target?: TaskTarget;
};

/** The gaps that would make the Jahresnachweis or the Anlage-7 list incomplete. */
export const buildDataQuality = (
  employees: EmployeeWithPeriod[],
  patients: PatientWithLatestVisit[],
): DataQualityCheck[] => {
  const missingHours = employees.filter((e) => e.status === 'active' && e.weeklyHours == null);
  const missingBirth = employees.filter((e) => e.status === 'active' && !e.birthDate);
  const missingAssessment = patients.filter(
    (p) => teilgruppeOf(p.cognitionImpaired, p.mobilityImpaired) == null,
  );
  const missingEnd = employees.filter((e) => e.status === 'left' && !e.endDate);

  const check = (
    id: string,
    count: number,
    problem: string,
    clear: string,
    dot: string,
    target?: TaskTarget,
  ): DataQualityCheck => ({
    id,
    label: count > 0 ? `${count} ${problem}` : clear,
    dot: count > 0 ? dot : 'var(--ok-800)',
    target: count > 0 ? target : undefined,
  });

  return [
    check(
      'hours',
      missingHours.length,
      missingHours.length === 1 ? 'Person ohne Wochenstunden' : 'Personen ohne Wochenstunden',
      'Alle Personen haben Wochenstunden',
      'var(--bad-800)',
      missingHours[0]?.id != null ? { kind: 'employee', id: missingHours[0].id } : undefined,
    ),
    check(
      'birth',
      missingBirth.length,
      missingBirth.length === 1 ? 'Person ohne Geburtsdatum' : 'Personen ohne Geburtsdatum',
      'Alle Personen haben ein Geburtsdatum',
      'var(--color-accent-500)',
      missingBirth[0]?.id != null ? { kind: 'employee', id: missingBirth[0].id } : undefined,
    ),
    check(
      'assessment',
      missingAssessment.length,
      missingAssessment.length === 1
        ? 'Patient:in ohne Gutachten-Daten (Teilgruppe)'
        : 'Patient:innen ohne Gutachten-Daten (Teilgruppe)',
      'Alle Patient:innen haben eine Teilgruppe',
      'var(--color-accent-500)',
      missingAssessment[0]?.id != null ? { kind: 'patient', id: missingAssessment[0].id } : undefined,
    ),
    check(
      'end',
      missingEnd.length,
      'Austritte ohne Datum',
      'Alle Austritte haben ein Datum',
      'var(--bad-800)',
      missingEnd[0]?.id != null ? { kind: 'employee', id: missingEnd[0].id } : undefined,
    ),
  ];
};
