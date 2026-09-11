/// <reference types="vitest/globals" />

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EmployeeModal from '../EmployeeModal';
import type { EditModalState, FormState } from '../../../types/ui';
import type { EmployeeWithPeriod, QualificationType } from '../../../shared/types';

const existingEmployee = {
  id: 7,
  name: 'Test Person',
  qualification: 'Pflegekraft',
  startDate: '2024-01-01',
  endDate: null,
  fte: 1,
  weeklyHours: 36,
  status: 'active',
} as unknown as EmployeeWithPeriod;

const state: EditModalState = {
  open: true,
  mode: 'create',
  name: 'Test Person',
  note: '',
  weeklyHours: '36',
  linked: true,
  fteValue: '1',
  birthDate: '',
};

const form: FormState = {
  name: 'Test Person',
  qualification: 'Pflegekraft',
  note: '',
  startDate: '2026-01-01',
  endDate: '',
  fte: 1,
  weeklyHours: 36,
};

describe('EmployeeModal', () => {
  it('zeigt bei gleicher Schreibweise einen nicht blockierenden Hinweis mit Link zur Person', () => {
    const onClose = vi.fn();
    const onOpenExisting = vi.fn();
    render(
      <EmployeeModal
        state={state}
        form={form}
        qualifications={[{ id: 1, name: 'Pflegekraft' } as QualificationType]}
        fteHelp=""
        onStateChange={vi.fn()}
        onFormChange={vi.fn()}
        onWeeklyHoursChange={vi.fn()}
        onFteChange={vi.fn()}
        onToggleLinked={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
        existingEmployees={[existingEmployee]}
        onOpenExisting={onOpenExisting}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Gleicher Name ist nur ein Hinweis');
    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Test Person öffnen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenExisting).toHaveBeenCalledWith(existingEmployee);
  });
});
