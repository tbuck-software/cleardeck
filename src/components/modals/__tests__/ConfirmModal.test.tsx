/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmModal from '../ConfirmModal';

const noop = (): void => undefined;

describe('ConfirmModal', () => {
  it('bestätigt einfache Aktionen direkt', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        state={{ message: 'Wirklich löschen?', onConfirm, confirmLabel: 'Löschen', danger: true }}
        onClose={noop}
      />,
    );

    const button = screen.getByRole('button', { name: 'Löschen' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('verlangt das Tippwort bei unwiderruflichen Aktionen', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        state={{
          message: 'Alle lokalen Daten werden unwiderruflich entfernt.',
          onConfirm,
          title: 'Datenbank löschen?',
          confirmLabel: 'Endgültig löschen',
          danger: true,
          confirmPhrase: 'LÖSCHEN',
        }}
        onClose={noop}
      />,
    );

    const button = screen.getByRole('button', { name: 'Endgültig löschen' });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Zur Bestätigung „LÖSCHEN“ eingeben'), {
      target: { value: 'löschen' },
    });
    expect(button).toBeEnabled(); // Groß-/Kleinschreibung ist egal

    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('bleibt bei falschem Tippwort gesperrt', () => {
    render(
      <ConfirmModal
        state={{ message: 'x', onConfirm: noop, confirmLabel: 'Weg', confirmPhrase: 'LÖSCHEN' }}
        onClose={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText('Zur Bestätigung „LÖSCHEN“ eingeben'), {
      target: { value: 'losch' },
    });
    expect(screen.getByRole('button', { name: 'Weg' })).toBeDisabled();
  });

  it('nutzt den eigenen Titel, sonst den Standard', () => {
    const { rerender } = render(
      <ConfirmModal state={{ message: 'x', onConfirm: noop, title: 'Datenbank löschen?' }} onClose={noop} />,
    );
    expect(screen.getByText('Datenbank löschen?')).toBeInTheDocument();

    rerender(<ConfirmModal state={{ message: 'y', onConfirm: noop }} onClose={noop} />);
    expect(screen.getByText('Bist du sicher?')).toBeInTheDocument();
  });
});
