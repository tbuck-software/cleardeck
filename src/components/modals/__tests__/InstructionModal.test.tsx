/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import InstructionModal from '../InstructionModal';
import type { InstructionModalState } from '../../../types/ui';

const state: InstructionModalState = {
  open: true,
  id: 7,
  topic: 'Hygiene',
  legalBasis: 'ArbSchG § 12',
  note: '',
  intervalMonths: 12,
  intervalSource: 'betrieblich',
};

describe('Einweisungs-Dialog', () => {
  it('ordnet die Einweisung aus dem Dialog heraus zu', () => {
    const onAssign = vi.fn();
    render(
      <InstructionModal
        state={state}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onAssign={onAssign}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zuordnen' }));
    expect(onAssign).toHaveBeenCalledWith(7);
  });

  it('bietet die Zuordnung erst für eine gespeicherte Einweisung an', () => {
    render(
      <InstructionModal
        state={{ ...state, id: undefined }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onAssign={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Zuordnen' })).not.toBeInTheDocument();
  });
});
