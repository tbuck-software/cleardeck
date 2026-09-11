/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import PatientModal from '../PatientModal';
import type { PatientModalState } from '../../../types/ui';

const modal: PatientModalState = {
  open: true,
  mode: 'create',
  name: 'Synthetische Person',
  birthDate: '',
  diagnosis: '',
  note: '',
  contact: '',
  admissionDate: '',
  cognitionImpaired: null,
  mobilityImpaired: null,
  hkpCode: null,
  intensiveCare: null,
  careLevel: null,
};

const optionValue = (label: string): string =>
  (screen.getByRole('option', { name: label }) as HTMLOptionElement).value;

describe('PatientModal Pflegegrad', () => {
  it('bietet unbekannt, keinen Pflegegrad und die Grade eins bis fünf an', () => {
    render(
      <PatientModal
        modal={modal}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Pflegegrad' });
    expect(select).toHaveDisplayValue('Unbekannt');
    expect(screen.getByRole('option', { name: 'Kein Pflegegrad' })).toBeInTheDocument();
    for (const grade of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('option', { name: `Pflegegrad ${grade}` })).toBeInTheDocument();
    }
  });

  it('setzt den Pflegegrad auf null zurück und speichert zero als eigene Auswahl', () => {
    const onChange = vi.fn();
    render(
      <PatientModal modal={modal} onChange={onChange} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    const select = screen.getByRole('combobox', { name: 'Pflegegrad' });

    fireEvent.change(select, { target: { value: optionValue('Kein Pflegegrad') } });
    expect(onChange).toHaveBeenLastCalledWith({ ...modal, careLevel: 0 });

    fireEvent.change(select, { target: { value: optionValue('Pflegegrad 5') } });
    expect(onChange).toHaveBeenLastCalledWith({ ...modal, careLevel: 5 });

    fireEvent.change(select, { target: { value: optionValue('Unbekannt') } });
    expect(onChange).toHaveBeenLastCalledWith({ ...modal, careLevel: null });
  });
});
