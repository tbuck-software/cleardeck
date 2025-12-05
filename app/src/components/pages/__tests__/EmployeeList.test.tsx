/// <reference types="vitest/globals" />

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
    name: 'Bruno Stringwert',
    qualification: 'Admin',
    startDate: '2024-01-01',
    endDate: '',
    fte: '0.5' as unknown as number,
    weeklyHours: 20,
    status: 'left',
  },
];

const qualifications: QualificationType[] = [
  { id: 1, name: 'Pflegekraft' },
  { id: 2, name: 'Admin' },
];

describe('EmployeeList', () => {
  it('löst Filter- und Toolbar-Aktionen aus', () => {
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    const onQualificationChange = vi.fn();
    const onExport = vi.fn();
    const onCreate = vi.fn();
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    render(
      <EmployeeList
        search=""
        statusFilter="all"
        qualificationFilter="all"
        qualifications={qualifications}
        filteredEmployees={employees}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onQualificationChange={onQualificationChange}
        onExport={onExport}
        onCreate={onCreate}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Suchen/), { target: { value: 'anna' } });
    expect(onSearchChange).toHaveBeenCalledWith('anna');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'active' } });
    expect(onStatusChange).toHaveBeenCalledWith('active');

    fireEvent.change(selects[1], { target: { value: 'Admin' } });
    expect(onQualificationChange).toHaveBeenCalledWith('Admin');

    fireEvent.click(screen.getByText('CSV'));
    expect(onExport).toHaveBeenCalledWith('csv');

    fireEvent.click(screen.getByText('Excel'));
    expect(onExport).toHaveBeenCalledWith('xlsx');

    fireEvent.click(screen.getByText('Neu anlegen'));
    expect(onCreate).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Anna Beispiel'));
    expect(onSelect).toHaveBeenCalledWith(employees[0]);

    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getAllByText('0.50').length).toBeGreaterThan(0);
  });
});
