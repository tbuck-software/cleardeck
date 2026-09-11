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
    employmentStartDate: '2024-01-01',
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
    employmentStartDate: '2024-01-01',
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

  it('bietet die Mitarbeiterliste-Übernahme im Menü statt im Kopfbereich an', () => {
    const onImport = vi.fn();
    renderList({ onImport });

    expect(screen.queryByText('Mitarbeiterliste übernehmen (Excel / CSV)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    fireEvent.click(screen.getByText('Mitarbeiterliste übernehmen (Excel / CSV)…'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('zeigt im Kopfbereich nur die Hauptaktion und das Menü', () => {
    renderList({ onImport: vi.fn() });

    const actions = screen.getByRole('button', { name: 'Person anlegen' }).parentElement!;
    expect(Array.from(actions.querySelectorAll('button'))).toHaveLength(2);
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
    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: 'Std./Wo.' }));
    expect(screen.getByRole('columnheader', { name: 'Std./Wo.' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('fällt in schmalen Fenstern auf eine Liste zurück', () => {
    renderList({ wideTable: false });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('2 Personen')).toBeInTheDocument();
  });

  it('zeigt den Beschäftigungsbeginn und kennzeichnet ausgeschiedene Zeilen', () => {
    renderList({
      filteredEmployees: employees.map((employee) =>
        employee.id === 2 ? { ...employee, employmentStartDate: '2022-03-01' } : employee,
      ),
    });

    expect(screen.getByText('01.03.2022')).toBeInTheDocument();
    expect(screen.getByText('Bruno Beispiel').closest('tr')).toHaveClass('cd-row-departed');
  });

  it('sortiert den angezeigten Beschäftigungsbeginn statt des Abschnittsbeginns', () => {
    renderList({
      filteredEmployees: employees.map((employee) =>
        employee.id === 1
          ? { ...employee, employmentStartDate: '2025-01-01' }
          : { ...employee, employmentStartDate: '2022-01-01' },
      ),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eintritt' }));
    const names = Array.from(document.querySelectorAll('tbody tr')).map(
      (row) => (row.textContent?.includes('Bruno') ? 'Bruno' : 'Anna'),
    );
    expect(names).toEqual(['Bruno', 'Anna']);
  });

  it('zeigt unbekannte Arbeitszeit als Gedankenstrich statt als null VZÄ', () => {
    renderList({
      filteredEmployees: [
        { ...employees[0], endDate: '2026-06-30', weeklyHours: null, fte: 0, hoursMissing: true },
      ],
      totalFte: 0,
    });

    const cells = screen.getByText('Anna Beispiel').closest('tr')!.querySelectorAll('td');
    expect(cells[4].textContent).toBe('—');
    expect(cells[5].textContent).toBe('—');
  });
  it('zeigt die Notiz als Unterzeile und den Status in der letzten Spalte', () => {
    renderList({ filteredEmployees: [{ ...employees[0], note: 'Leitung Tour 3' }] });

    const row = screen.getByText('Anna Beispiel').closest('tr')!;
    expect(row.querySelector('.cd-person-sub')).toHaveTextContent('Leitung Tour 3');

    const cells = row.querySelectorAll('td');
    expect(cells[cells.length - 1].textContent).toBe('aktiv');
  });
});
