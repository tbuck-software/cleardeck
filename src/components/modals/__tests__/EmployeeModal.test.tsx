/// <reference types="vitest/globals" />

import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EmployeeModal from '../EmployeeModal';
import type { EditModalState, FormState } from '../../../types/ui';
import type { IntegrityEmployee, QualificationType } from '../../../shared/types';

const existingEmployee: IntegrityEmployee = {
  id: 7,
  name: 'Test Person',
  birthDate: null,
};

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
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenExisting).not.toHaveBeenCalled();

    expect(screen.getByRole('status')).toHaveTextContent('Die Eingaben werden verworfen.');
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Öffnen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenExisting).toHaveBeenCalledWith(7);
  });

  it('behält die Eingaben, wenn das Öffnen abgebrochen wird', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Test Person öffnen' }));
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenExisting).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Gleicher Name ist nur ein Hinweis');
  });
});

const hintForm: FormState = {
  periodId: 21,
  name: 'Synthetic Person',
  qualification: 'Pflegefachkraft',
  note: '',
  startDate: '2024-01-01',
  endDate: '',
  fte: 0.5,
  weeklyHours: 18,
};

/** The dialog is controlled, so the hint only updates live through a state holder. */
const Harness = ({ initial }: { initial: EditModalState }) => {
  const [state, setState] = useState(initial);
  return (
    <EmployeeModal
      state={state}
      form={hintForm}
      qualifications={[{ id: 1, name: 'Pflegefachkraft' }]}
      fteHelp=""
      onStateChange={(next) => setState((prev) => ({ ...prev, ...next }))}
      onFormChange={vi.fn()}
      onWeeklyHoursChange={vi.fn()}
      onFteChange={vi.fn()}
      onToggleLinked={vi.fn()}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />
  );
};

const baseState: EditModalState = {
  open: true,
  mode: 'edit',
  name: 'Synthetic Person',
  note: '',
  weeklyHours: '18',
  linked: false,
  fteValue: '0.5',
  birthDate: '',
  hoursEffectiveFrom: '2025-01-01',
  initialHoursEffectiveFrom: '2025-01-01',
  existingHoursEffectiveFrom: '2025-01-01',
};

it('announces a replacement on the existing term date and switches to a new state live', () => {
  render(<Harness initial={baseState} />);

  expect(screen.getByText('Ersetzt den Stand vom 01.01.2025.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Stunden / VZÄ gültig ab'), {
    target: { value: '2025-06-01' },
  });

  expect(
    screen.getByText('Neuer Stand ab diesem Datum. Frühere Stände bleiben in der Historie.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Ersetzt den Stand/)).not.toBeInTheDocument();
});

it('announces a new state when the pre-filled date differs from the existing term', () => {
  render(
    <Harness
      initial={{
        ...baseState,
        hoursEffectiveFrom: '2025-09-11',
        initialHoursEffectiveFrom: '2025-09-11',
      }}
    />,
  );

  expect(
    screen.getByText('Neuer Stand ab diesem Datum. Frühere Stände bleiben in der Historie.'),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Stunden / VZÄ gültig ab'), {
    target: { value: '2025-01-01' },
  });

  expect(screen.getByText('Ersetzt den Stand vom 01.01.2025.')).toBeInTheDocument();
});
