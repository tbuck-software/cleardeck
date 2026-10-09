import type { EmployeeWithPeriod, PatientWithLatestVisit } from '../shared/types';
import { SETTINGS_PAGES, type Page } from '../types/ui';

export type NavigationSnapshot = {
  page: Page;
  employeeId: number | null;
  patientId: number | null;
};

export type AppHistoryState = {
  __appNavigation: true;
  index: number;
  snapshot: NavigationSnapshot;
};

export const buildNavigationSnapshot = (
  page: Page,
  selectedEmployeeId?: number | null,
  selectedPatientId?: number | null,
): NavigationSnapshot => ({
  page,
  employeeId: page === 'view' ? selectedEmployeeId ?? null : null,
  patientId: page === 'patients' ? selectedPatientId ?? null : null,
});

export const createAppHistoryState = (index: number, snapshot: NavigationSnapshot): AppHistoryState => ({
  __appNavigation: true,
  index,
  snapshot,
});

export const isAppHistoryState = (value: unknown): value is AppHistoryState => {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<AppHistoryState>;
  return state.__appNavigation === true && typeof state.index === 'number' && !!state.snapshot;
};

export const resolveNavigationSnapshot = (
  snapshot: NavigationSnapshot,
  employees: EmployeeWithPeriod[],
  patients: PatientWithLatestVisit[],
): {
  page: Page;
  employee: EmployeeWithPeriod | null;
  patient: PatientWithLatestVisit | null;
} => {
  const employee =
    snapshot.employeeId == null ? null : employees.find((entry) => entry.id === snapshot.employeeId) ?? null;
  const patient =
    snapshot.patientId == null ? null : patients.find((entry) => entry.id === snapshot.patientId) ?? null;

  if (snapshot.page === 'view' && !employee) {
    return { page: 'list', employee: null, patient: null };
  }

  if (snapshot.page === 'patients' && snapshot.patientId != null && !patient) {
    return { page: 'patients', employee: null, patient: null };
  }

  return {
    page: snapshot.page,
    employee,
    patient,
  };
};

const PAGE_LABELS: Partial<Record<Page, string>> = {
  dashboard: 'Übersicht',
  tasks: 'Aufgaben',
  list: 'Team',
  view: 'Team',
  patients: 'Patient:innen',
  audit: 'MD-Prüfung',
  calendar: 'Kalender',
  integrity: 'Datenprüfung',
  quals: 'Qualifikationen',
  services: 'Leistungen',
  comps: 'Kompetenzen',
  instrs: 'Einweisungen',
};

/** Names the place a snapshot leads back to, e.g. for a "← Aufgaben" link. */
export const navigationTargetLabel = (
  snapshot: NavigationSnapshot,
  employees: EmployeeWithPeriod[],
  patients: PatientWithLatestVisit[],
): string => {
  if (snapshot.employeeId != null) {
    const employee = employees.find((entry) => entry.id === snapshot.employeeId);
    if (employee) return employee.name;
  }
  if (snapshot.patientId != null) {
    const patient = patients.find((entry) => entry.id === snapshot.patientId);
    if (patient) return patient.name;
  }
  if (SETTINGS_PAGES.includes(snapshot.page)) return 'Einstellungen';
  return PAGE_LABELS[snapshot.page] ?? 'Zurück';
};
