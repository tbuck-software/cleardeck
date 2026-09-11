/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeInstructionModal from '../EmployeeInstructionModal';
import type { InstructionDefinition } from '../../../shared/types';

const definitions: InstructionDefinition[] = [
  { id: 1, topic: 'Brandschutzunterweisung', intervalMonths: 12 },
  { id: 2, topic: 'Hygieneunterweisung (jährlich)', intervalMonths: 12 },
  { id: 3, topic: 'Datenschutz-Grundunterweisung' },
];

describe('Einweisung hinzufügen', () => {
  it('sucht im Katalog und meldet die gewählte Einweisung', () => {
    const onChange = vi.fn();
    render(
      <EmployeeInstructionModal
        state={{
          open: true,
          instructionDefinitionId: null,
          instructionName: '',
          dueDate: '',
          completedAt: '',
          conductedBy: '',
          note: '',
          scheduleFollowUp: false,
        }}
        employeeName="Anna Berger"
        availableDefinitions={definitions}
        onChange={onChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const field = screen.getByLabelText('Einweisung');

    fireEvent.focus(field);
    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.change(field, { target: { value: 'hygiene' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({
      instructionDefinitionId: 2,
      instructionName: 'Hygieneunterweisung (jährlich)',
    });
  });
});
