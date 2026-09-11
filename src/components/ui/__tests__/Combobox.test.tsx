/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Combobox, { type ComboboxOption } from '../Combobox';

const options: ComboboxOption[] = [
  { value: 1, label: 'Ganzwaschung', code: 'P01', group: 'SGB XI' },
  { value: 2, label: 'Kompressionsstrümpfe anlegen', code: 'BPf 22', group: 'SGB V' },
  { value: 3, label: 'Toursoftware sicher bedienen', code: 'QM-01', group: 'Digital' },
];

const Harness = ({ onChange = vi.fn() }: { onChange?: (value: string | number | null) => void }) => {
  const [value, setValue] = useState<string | number | null>(null);
  return (
    <>
      <label htmlFor="kompetenz">Kompetenz</label>
      <Combobox
        id="kompetenz"
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <button type="button">Außerhalb</button>
    </>
  );
};

const field = () => screen.getByLabelText('Kompetenz');

describe('Combobox', () => {
  it('zeigt beim Fokus die volle Liste mit Gruppenüberschriften', () => {
    render(<Harness />);

    fireEvent.focus(field());

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('SGB XI')).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-expanded', 'true');
  });

  it('filtert nach Kürzel und Bezeichnung, unabhängig von Umlauten', () => {
    render(<Harness />);
    fireEvent.focus(field());

    fireEvent.change(field(), { target: { value: 'strumpfe' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Kompressionsstrümpfe anlegen');

    fireEvent.change(field(), { target: { value: 'qm-01' } });
    expect(screen.getByRole('option')).toHaveTextContent('Toursoftware sicher bedienen');
  });

  it('meldet ein leeres Ergebnis', () => {
    render(<Harness />);
    fireEvent.focus(field());

    fireEvent.change(field(), { target: { value: 'xyz' } });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Keine Treffer.')).toBeInTheDocument();
  });

  it('wählt mit Pfeiltasten und Enter aus', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(field());

    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(2);
    expect(field()).toHaveValue('BPf 22 · Kompressionsstrümpfe anlegen');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('wählt per Klick aus', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(field());

    fireEvent.click(screen.getByText('Ganzwaschung'));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(field()).toHaveValue('P01 · Ganzwaschung');
  });

  it('setzt die Auswahl über die Löschtaste zurück', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(field());
    fireEvent.click(screen.getByText('Ganzwaschung'));

    fireEvent.click(screen.getByRole('button', { name: 'Auswahl entfernen' }));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Auswahl entfernen' })).not.toBeInTheDocument();
  });

  it('schließt bei Klick außerhalb, ohne die Auswahl zu ändern', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(field());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Außerhalb' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });

  it('schließt mit Escape und verwirft die Eingabe', () => {
    render(<Harness />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'tour' } });

    fireEvent.keyDown(field(), { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field()).toHaveValue('');
  });

  it('hebt den aktiven Eintrag über aria-activedescendant hervor', () => {
    render(<Harness />);
    fireEvent.focus(field());

    const active = document.getElementById(field().getAttribute('aria-activedescendant')!);

    expect(active).toHaveTextContent('Ganzwaschung');
  });
});
