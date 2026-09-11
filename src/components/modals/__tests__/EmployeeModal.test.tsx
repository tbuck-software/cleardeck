/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeModal from '../EmployeeModal';
import type { EditModalState, FormState } from '../../../types/ui';

const form: FormState = {
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
      form={form}
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
