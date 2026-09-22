import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EmploymentIntegrityPage from '../EmploymentIntegrityPage';
import type { EmploymentIntegrityOverview } from '../../../shared/types';

const overview: EmploymentIntegrityOverview = {
  employees: [
    { id: 1, name: 'Alex Beispiel', birthDate: '1980-01-01' },
    { id: 2, name: 'Alex Beispiel', birthDate: '1990-01-01' },
    { id: 3, name: 'Kim Altbestand', birthDate: null },
  ],
  periods: [
    { id: 10, employeeId: 3, startDate: '2020-01-01', endDate: '2020-03-31', qualification: 'Pflegefachkraft', note: null, weeklyHours: 28.8, fte: 0.8 },
    { id: 11, employeeId: 3, startDate: '2020-03-01', endDate: '2020-12-31', qualification: 'Pflegefachkraft', note: null, weeklyHours: 36, fte: 1 },
  ],
  issues: [
    { kind: 'same-name', severity: 'warning', employeeId: 1, relatedEmployeeId: 2, periodIds: [] },
    { kind: 'same-name', severity: 'warning', employeeId: 2, relatedEmployeeId: 1, periodIds: [] },
    { kind: 'overlapping-periods', severity: 'error', employeeId: 3, relatedEmployeeId: null, periodIds: [10, 11] },
  ],
};

it('shows historical overlap dates before warnings and opens the affected person', () => {
  const onOpenEmployee = vi.fn();
  render(<EmploymentIntegrityPage overview={overview} status="ready" onRefresh={vi.fn()} onOpenEmployee={onOpenEmployee} />);
  const findings = screen.getAllByRole('button', { name: /In Historie prüfen/ });
  expect(findings).toHaveLength(2);
  expect(findings[0]).toHaveAccessibleName(/Kim Altbestand/);
  expect(screen.getByText(/01.01.2020 bis 31.03.2020/)).toBeInTheDocument();
  expect(screen.getByText(/01.03.2020 bis 31.12.2020/)).toBeInTheDocument();
  fireEvent.click(findings[0]);
  expect(onOpenEmployee).toHaveBeenCalledWith(3);
  fireEvent.click(findings[1]);
  expect(onOpenEmployee).toHaveBeenLastCalledWith(1);
});

it('filters severity and names, shows a duplicate pair once even without periods', () => {
  render(<EmploymentIntegrityPage overview={overview} status="ready" onRefresh={vi.fn()} onOpenEmployee={vi.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: /Prüfhinweise\s*1/ }));
  expect(screen.getAllByRole('button', { name: /In Historie prüfen/ })).toHaveLength(1);
  expect(screen.getByText(/geb. 01.01.1980.*geb. 01.01.1990/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Kim' } });
  expect(screen.getByText('Keine Funde für diese Auswahl.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /Alle\s*2/ }));
  expect(screen.getByRole('button', { name: /Kim Altbestand.*In Historie prüfen/ })).toBeInTheDocument();
});

it('removes resolved findings when refreshed data arrives', () => {
  const props = { status: 'ready' as const, onRefresh: vi.fn(), onOpenEmployee: vi.fn() };
  const { rerender } = render(<EmploymentIntegrityPage overview={overview} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Erneut prüfen' }));
  expect(props.onRefresh).toHaveBeenCalledOnce();
  rerender(<EmploymentIntegrityPage overview={{ ...overview, issues: [] }} {...props} />);
  expect(screen.queryByRole('button', { name: /In Historie prüfen/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Keine Auffälligkeiten in den geprüften/)).toBeInTheDocument();
});

it('does not claim a clean result before a successful scan', () => {
  const empty: EmploymentIntegrityOverview = { issues: [], employees: [], periods: [] };
  const props = { overview: empty, onRefresh: vi.fn(), onOpenEmployee: vi.fn() };
  const { rerender } = render(<EmploymentIntegrityPage {...props} status="loading" />);
  expect(screen.getByRole('status')).toHaveTextContent('werden geprüft');
  expect(screen.getByRole('button', { name: 'Erneut prüfen' })).toBeDisabled();
  expect(screen.queryByText(/Keine Auffälligkeiten/)).not.toBeInTheDocument();
  rerender(<EmploymentIntegrityPage {...props} status="error" />);
  expect(screen.getByRole('alert')).toHaveTextContent('konnte nicht geladen werden');
  expect(screen.queryByText(/Keine Auffälligkeiten/)).not.toBeInTheDocument();
});
