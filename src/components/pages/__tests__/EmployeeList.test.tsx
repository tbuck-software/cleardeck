/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeList from '../EmployeeList';
import type { EmployeeWithPeriod, QualificationType } from '../../../shared/types';

const employees: EmployeeWithPeriod[] = [
  {
    id: 1,
    name: 'Anna Beispiel',
    qualification: 'Pflegekraft',
    startDate: '2024-01-01',
    endDate: '',
    fte: 0.8,
    weeklyHours: 30,
    status: 'active',
  },
  {
    id: 2,
    name: 'Bruno Beispiel',
    qualification: 'Admin',
    startDate: '2024-01-01',
    endDate: '2025-06-30',
    fte: 0.5,
    weeklyHours: 20,
    status: 'left',
  },
];

const qualifications: QualificationType[] = [
  { id: 1, name: 'Pflegekraft' },
  { id: 2, name: 'Admin' },
];

const noop = (): void => undefined;

const renderList = (overrides: Partial<React.ComponentProps<typeof EmployeeList>> = {}): ReturnType<typeof render> =>
  render(
    <EmployeeList
      year={2026}
      years={[2024, 2025, 2026]}
      search=""
      statusFilter="all"
      qualificationFilter="all"
      qualifications={qualifications}
      filteredEmployees={employees}
      totalFte={1.3}
      wideTable
      onSearchChange={noop}
      onStatusChange={noop}
      onQualificationChange={noop}
      onYearChange={noop}
      onExport={noop}
      onOpenReport={noop}
      onCreate={noop}
      onSelect={noop}
      {...overrides}
    />,
  );

describe('EmployeeList', () => {
  it('löst Such- und Filteraktionen aus', () => {
    const onSearchChange = vi.fn();
    const onQualificationChange = vi.fn();
    renderList({ onSearchChange, onQualificationChange });

    fireEvent.change(screen.getByPlaceholderText('Suchen'), { target: { value: 'anna' } });
    expect(onSearchChange).toHaveBeenCalledWith('anna');

    fireEvent.change(screen.getByLabelText('Qualifikation'), { target: { value: 'Admin' } });
    expect(onQualificationChange).toHaveBeenCalledWith('Admin');
  });

  it('öffnet eine Zeile', () => {
    const onSelect = vi.fn();
    renderList({ onSelect });

    fireEvent.click(screen.getByText('Anna Beispiel'));
    expect(onSelect).toHaveBeenCalledWith(employees[0]);
  });

  it('exportiert über das Menü', () => {
    const onExport = vi.fn();
    renderList({ onExport });

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    fireEvent.click(screen.getByText('Als Excel exportieren'));
    expect(onExport).toHaveBeenCalledWith('xlsx');
  });

  it('summiert Stunden und VZÄ in der Fußzeile', () => {
    renderList();

    expect(screen.getByText('Summe über 2 Personen')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('1,30')).toBeInTheDocument();
  });

  it('sortiert nach Klick auf eine Spaltenüberschrift', () => {
    renderList();

    // Die Liste startet nach Name aufsteigend.
    const nameHeader = screen.getByText(/^Name/).closest('th') as HTMLElement;
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(nameHeader);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');

    const hoursHeader = screen.getByText(/^Std\./).closest('th') as HTMLElement;
    fireEvent.click(hoursHeader);
    expect(hoursHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('fällt in schmalen Fenstern auf eine Liste zurück', () => {
    renderList({ wideTable: false });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('2 Personen')).toBeInTheDocument();
  });
});
