/// <reference types="vitest/globals" />

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EmploymentIntegrityModal from '../EmploymentIntegrityModal';
import type { EmploymentRepairEmployee, EmployeeWithPeriod } from '../../../shared/types';

const apiMock = vi.hoisted(() => ({
  employment: {
    integrityOverview: vi.fn(),
    previewPeriodDate: vi.fn(),
    previewMerge: vi.fn(),
  },
  employees: {
    listPeriods: vi.fn(),
  },
}));

vi.mock('../../../services/api', () => ({ api: apiMock }));

const employee = {
  id: 1,
  name: 'Test Person',
  qualification: 'Pflegekraft',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  fte: 1,
  weeklyHours: 36,
  status: 'left',
} as unknown as EmployeeWithPeriod;

describe('EmploymentIntegrityModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verwirft eine Datumsvorschau, sobald der Entwurf geändert wird', async () => {
    apiMock.employment.integrityOverview.mockResolvedValue({
      issues: [{
        kind: 'reversed-period',
        severity: 'error',
        title: 'Beschäftigungszeitraum hat umgekehrte Daten',
        detail: 'Test Person: Beginn 01.02.2024 liegt nach dem Ende 31.01.2024.',
        employeeIds: [1],
        periodIds: [1],
      }],
      counts: { 'reversed-period': 1, 'overlapping-periods': 0, 'suspicious-period': 0, 'same-name': 0 },
      checkedAt: '2026-09-11T00:00:00.000Z',
      repairEmployees: [{ id: 1, name: 'Test Person', birthDate: null, startDate: '2024-02-01', endDate: '2024-01-31', qualification: 'Pflegekraft', periodCount: 1 }],
    });
    apiMock.employees.listPeriods.mockResolvedValue([{
      id: 1,
      startDate: '2024-02-01',
      endDate: '2024-01-31',
      qualification: 'Pflegekraft',
      note: null,
    }]);
    apiMock.employment.previewPeriodDate.mockResolvedValue({
      kind: 'period-date',
      token: 'preview-token',
      period: {
        id: 1,
        employeeId: 1,
        employeeName: 'Test Person',
        qualification: 'Pflegekraft',
        before: { startDate: '2024-02-01', endDate: '2024-01-31' },
        after: { startDate: '2024-02-01', endDate: '2024-03-31' },
      },
      affectedRecords: [],
      conflicts: [],
    });

    render(
      <EmploymentIntegrityModal
        open
        employees={[employee]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Daten korrigieren' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Daten korrigieren' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Vorschau' })[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Korrektur speichern' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Beginn'), { target: { value: '2024-03-01' } });

    expect(screen.queryByRole('button', { name: 'Korrektur speichern' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Vorher:/)).not.toBeInTheDocument();
  });

  it('unterscheidet gleichnamige Personen mit Geburtsdatum und Zeitraum', async () => {
    const first = { ...employee, birthDate: '1980-01-01' } as EmployeeWithPeriod;
    const second = { ...employee, id: 2, birthDate: '1985-01-01', startDate: '2025-01-01' } as EmployeeWithPeriod;
    apiMock.employment.integrityOverview.mockResolvedValue({
      issues: [],
      counts: { 'reversed-period': 0, 'overlapping-periods': 0, 'suspicious-period': 0, 'same-name': 0 },
      checkedAt: '2026-09-11T00:00:00.000Z',
      repairEmployees: [
        { id: 1, name: 'Test Person', birthDate: '1980-01-01', startDate: '2024-01-01', endDate: null, qualification: 'Pflegekraft', periodCount: 1 },
        { id: 2, name: 'Test Person', birthDate: '1985-01-01', startDate: '2025-01-01', endDate: null, qualification: 'Pflegekraft', periodCount: 1 },
      ],
    });
    apiMock.employees.listPeriods.mockImplementation((id: number) => Promise.resolve([{
      id,
      startDate: id === 1 ? '2024-01-01' : '2025-01-01',
      endDate: null,
      qualification: 'Pflegekraft',
      note: null,
    }]));

    render(
      <EmploymentIntegrityModal
        open
        employees={[first, second]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Keine Auffälligkeit gefunden.')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Doppelte Person zusammenführen'));
    expect(screen.getAllByRole('option', { name: /geb\. 01\.01\.1980/ })).toHaveLength(2);
    expect(screen.getAllByRole('option', { name: /geb\. 01\.01\.1985/ })).toHaveLength(2);
  });

  it('bietet auch eine Person ohne Beschäftigungszeitraum für eine Vorschau an', async () => {
    const repairEmployees: EmploymentRepairEmployee[] = [
      { id: 10, name: 'Ohne Zeitraum', birthDate: '1975-02-03', startDate: null, endDate: null, qualification: null, periodCount: 0 },
      { id: 11, name: 'Mit Nachweis', birthDate: '1976-04-05', startDate: null, endDate: null, qualification: null, periodCount: 0 },
    ];
    apiMock.employment.integrityOverview.mockResolvedValue({
      issues: [],
      counts: { 'reversed-period': 0, 'overlapping-periods': 0, 'suspicious-period': 0, 'same-name': 0 },
      checkedAt: '2026-09-11T00:00:00.000Z',
      repairEmployees,
    });
    apiMock.employment.previewMerge.mockResolvedValue({
      kind: 'employee-merge',
      token: 'merge-preview',
      target: { id: 10, name: 'Ohne Zeitraum' },
      source: { id: 11, name: 'Mit Nachweis' },
      sourceSnapshot: { id: 11, name: 'Mit Nachweis' },
      periods: { target: 0, source: 0 },
      linkedRecords: [{ table: 'employee_events', ids: [99], count: 1 }],
      conflicts: [],
    });

    render(<EmploymentIntegrityModal open employees={[]} onClose={vi.fn()} onChanged={vi.fn()} onError={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Keine Auffälligkeit gefunden.')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Doppelte Person zusammenführen'));
    expect(screen.getAllByRole('option', { name: /keine Beschäftigungsdaten/ })).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('Zielperson'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Quellperson'), { target: { value: '11' } });
    const previewButtons = screen.getAllByRole('button', { name: 'Vorschau' });
    fireEvent.click(previewButtons[previewButtons.length - 1]);

    await waitFor(() => expect(apiMock.employment.previewMerge).toHaveBeenCalledWith({ targetEmployeeId: 10, sourceEmployeeId: 11 }));
    expect(await screen.findByText(/Ereignisse: 1/)).toBeInTheDocument();
  });
});
