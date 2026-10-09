/// <reference types="vitest/globals" />

import {
  buildNavigationSnapshot,
  createAppHistoryState,
  isAppHistoryState,
  navigationTargetLabel,
  resolveNavigationSnapshot,
} from '../navigationHistory';
import type { EmployeeWithPeriod, PatientWithLatestVisit } from '../../shared/types';

const employees: EmployeeWithPeriod[] = [
  {
    id: 7,
    periodId: 11,
    name: 'Mara Beispiel',
    qualification: 'PFK',
    startDate: '2024-01-01',
    employmentStartDate: '2024-01-01',
    endDate: null,
    fte: 1,
    status: 'active',
    weeklyHours: 39,
  },
];

const patients: PatientWithLatestVisit[] = [
  {
    id: 21,
    name: 'Helga Test',
    birthDate: null,
    diagnosis: 'Beispiel',
    latestVisitDate: null,
    latestActionNeeded: null,
    note: null,
  },
];

describe('navigationHistory', () => {
  it('normalisiert snapshots auf die relevanten ids pro seite', () => {
    expect(buildNavigationSnapshot('dashboard', 7, 21)).toEqual({
      page: 'dashboard',
      employeeId: null,
      patientId: null,
    });

    expect(buildNavigationSnapshot('view', 7, 21)).toEqual({
      page: 'view',
      employeeId: 7,
      patientId: null,
    });

    expect(buildNavigationSnapshot('patients', 7, 21)).toEqual({
      page: 'patients',
      employeeId: null,
      patientId: 21,
    });
  });

  it('erkennt app-eigene history-states', () => {
    expect(isAppHistoryState(createAppHistoryState(2, buildNavigationSnapshot('list')))).toBe(true);
    expect(isAppHistoryState({ index: 2 })).toBe(false);
  });

  it('löst snapshots gegen geladene daten auf und faellt sauber zurück', () => {
    expect(resolveNavigationSnapshot(buildNavigationSnapshot('view', 7), employees, patients)).toEqual({
      page: 'view',
      employee: employees[0],
      patient: null,
    });

    expect(resolveNavigationSnapshot(buildNavigationSnapshot('patients', null, 21), employees, patients)).toEqual({
      page: 'patients',
      employee: null,
      patient: patients[0],
    });

    expect(resolveNavigationSnapshot(buildNavigationSnapshot('view', 999), employees, patients)).toEqual({
      page: 'list',
      employee: null,
      patient: null,
    });
  });

  it('benennt das ziel eines zurück-schritts nach person oder bereich', () => {
    const label = (page: Parameters<typeof buildNavigationSnapshot>[0], employeeId?: number, patientId?: number) =>
      navigationTargetLabel(buildNavigationSnapshot(page, employeeId, patientId), employees, patients);

    expect(label('tasks')).toBe('Aufgaben');
    expect(label('dashboard')).toBe('Übersicht');
    expect(label('view', 7)).toBe('Mara Beispiel');
    expect(label('view', 999)).toBe('Team');
    expect(label('patients', undefined, 21)).toBe('Helga Test');
    expect(label('patients')).toBe('Patient:innen');
    expect(label('security')).toBe('Einstellungen');
  });
});
