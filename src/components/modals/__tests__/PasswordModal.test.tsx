/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import PasswordModal, { passwordScore } from '../PasswordModal';

const noop = (): void => undefined;

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof PasswordModal>> = {},
): ReturnType<typeof render> =>
  render(
    <PasswordModal open busy={false} error={null} onSubmit={noop} onClose={noop} {...overrides} />,
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('passwordScore', () => {
  it('bewertet Länge, Ziffern und Sonderzeichen', () => {
    expect(passwordScore('kurz')).toBe(0);
    expect(passwordScore('achtzehn')).toBe(1);
    expect(passwordScore('zwoelfzeichen')).toBe(2);
    expect(passwordScore('zwoelfzeichen1')).toBe(3);
    expect(passwordScore('zwoelfzeichen1!')).toBe(4);
  });
});

describe('PasswordModal', () => {
  it('bleibt gesperrt, solange etwas fehlt', () => {
    renderModal();
    const submit = screen.getByRole('button', { name: 'Passwort ändern' });

    expect(submit).toBeDisabled();

    type('Aktuelles Passwort', 'altes-passwort');
    type('Neues Passwort', 'neues-passwort-1');
    expect(submit).toBeDisabled(); // Wiederholung fehlt noch

    type('Wiederholen', 'neues-passwort-1');
    expect(submit).toBeEnabled();
  });

  it('weist abweichende Wiederholungen aus', () => {
    renderModal();
    type('Neues Passwort', 'neues-passwort-1');
    type('Wiederholen', 'vertippt');

    expect(screen.getByText('Die Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passwort ändern' })).toBeDisabled();
  });

  it('lehnt zu schwache Passwörter ab', () => {
    renderModal();
    type('Aktuelles Passwort', 'alt');
    type('Neues Passwort', 'kurz');
    type('Wiederholen', 'kurz');

    expect(screen.getByRole('button', { name: 'Passwort ändern' })).toBeDisabled();
  });

  it('reicht die Eingaben weiter', () => {
    const onSubmit = vi.fn();
    renderModal({ onSubmit });

    type('Aktuelles Passwort', 'altes-passwort');
    type('Neues Passwort', 'neues-passwort-1');
    type('Wiederholen', 'neues-passwort-1');
    fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' }));

    expect(onSubmit).toHaveBeenCalledWith({
      currentPassword: 'altes-passwort',
      newPassword: 'neues-passwort-1',
    });
  });

  it('zeigt Fehler aus dem Hauptprozess', () => {
    renderModal({ error: 'Das aktuelle Passwort ist nicht korrekt.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Das aktuelle Passwort ist nicht korrekt.');
  });

  it('nennt die Folgen für Recovery-Key und Backups', () => {
    renderModal();

    expect(
      screen.getByText(/Der Recovery-Key bleibt gültig\. Backups bleiben mit ihrem bisherigen Passwort lesbar\./),
    ).toBeInTheDocument();
  });
});
