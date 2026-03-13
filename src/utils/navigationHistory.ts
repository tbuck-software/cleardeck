import type { EmployeeWithPeriod, PatientWithLatestVisit } from '../shared/types';
import type { Page } from '../types/ui';

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
