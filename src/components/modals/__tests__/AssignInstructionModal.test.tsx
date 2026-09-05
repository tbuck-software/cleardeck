/// <reference types="vitest/globals" />

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AssignInstructionModal, {
  emptyAssignInstructionModal,
  type AssignInstructionModalState,
} from '../AssignInstructionModal';
import type { EmployeeWithPeriod, InstructionDefinition } from '../../../shared/types';

const definition: InstructionDefinition = {
  id: 1,
  topic: 'Hautschutzunterweisung',
  legalBasis: 'TRBA 250 Abschn. 4.1.3 Abs. 3',
  intervalMonths: 12,
  intervalSource: 'norm',
};

const employees = [
  { id: 1, name: 'Anna Berg', qualification: 'Pflegefachkraft' },
  { id: 2, name: 'Bo Clemens', qualification: 'Pflegehilfskraft' },
  { id: 3, name: 'Cem Dogan', qualification: 'Pflegefachkraft' },
] as unknown as EmployeeWithPeriod[];

const renderModal = (
  overrides: Partial<AssignInstructionModalState> = {},
  props: { alreadyOpenIds?: number[]; onChange?: (next: Partial<AssignInstructionModalState>) => void } = {},
) => {
  const onChange = props.onChange ?? ((): void => undefined);
  render(
    <AssignInstructionModal
      state={{ ...emptyAssignInstructionModal(), open: true, definitionId: 1, ...overrides }}
      definition={definition}
      employees={employees}
      alreadyOpenIds={props.alreadyOpenIds ?? []}
      onChange={onChange}
      onClose={(): void => undefined}
      onSave={(): void => undefined}
    />,
  );
  return onChange;
};

describe('AssignInstructionModal', () => {
  it('zeigt Rechtsgrundlage und Intervall der Einweisung', () => {
    renderModal();

    expect(screen.getByText(/TRBA 250 Abschn. 4.1.3 Abs. 3/)).toBeInTheDocument();
    expect(screen.getByText('Hautschutzunterweisung')).toBeInTheDocument();
  });

  it('sperrt Personen mit offenem Eintrag und zählt sie nicht mit', () => {
    renderModal({}, { alreadyOpenIds: [2] });

    expect(screen.getByText('bereits offen')).toBeInTheDocument();
    expect(screen.getByText('0 von 2 ausgewählt')).toBeInTheDocument();

    const blocked = screen.getByText('Bo Clemens').closest('label') as HTMLElement;
    expect(within(blocked).getByRole('checkbox')).toBeDisabled();
  });

  it('aktiviert nur die zuordenbaren Personen', () => {
    const onChange = vi.fn();
    renderModal({}, { alreadyOpenIds: [2], onChange });

    fireEvent.click(screen.getByText('Alle aktivieren'));

    expect(onChange).toHaveBeenCalledWith({ selectedEmployeeIds: [1, 3] });
  });

  it('filtert die Liste über die Suche', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Person suchen'), { target: { value: 'dogan' } });

    expect(screen.getByText('Cem Dogan')).toBeInTheDocument();
    expect(screen.queryByText('Anna Berg')).not.toBeInTheDocument();
  });

  it('sperrt den Knopf, solange niemand ausgewählt ist', () => {
    renderModal({ selectedEmployeeIds: [] });

    expect(screen.getByText('Zuordnen').closest('button')).toBeDisabled();
  });

  it('zeigt die Anzahl im Knopf, sobald jemand ausgewählt ist', () => {
    renderModal({ selectedEmployeeIds: [1, 3] });

    expect(screen.getByText('2 zuordnen').closest('button')).toBeEnabled();
  });
});
