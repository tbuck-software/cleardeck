/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AuthScreen from '../AuthScreen';

describe('AuthScreen', () => {
  it.each(['loading', 'error'] as const)('hides setup and reset controls while startup is %s', (mode) => {
    render(
      <AuthScreen
        mode={mode}
        onSubmit={vi.fn()}
        onResetApp={vi.fn()}
        onForgotPassword={vi.fn()}
        busy={false}
        globalError={mode === 'error' ? 'config.json kann nicht gelesen werden' : undefined}
      />,
    );
    expect(screen.queryByText('Ersteinrichtung')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neu einrichten' })).not.toBeInTheDocument();
    if (mode === 'error') expect(screen.getByRole('alert')).toHaveTextContent('config.json');
  });

  it('erlaubt eine unverschlüsselte Ersteinrichtung ohne Passwort', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AuthScreen
        mode="setup"
        onSubmit={onSubmit}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Ohne Passwort/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Passwort starten' }));

    expect(onSubmit).toHaveBeenCalledWith({ password: '', storageMode: 'plain' });
  });

  it('sperrt eine unverschlüsselte Datenbank ohne Passwortfeld', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AuthScreen
        mode="login"
        configuredStorageMode="plain"
        onSubmit={onSubmit}
        onForgotPassword={vi.fn()}
        onResetApp={vi.fn()}
        busy={false}
      />,
    );

    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument();
    // Ohne Passwort ergeben Recovery-Key und Neueinrichtung keinen Sinn.
    expect(screen.queryByRole('button', { name: 'Recovery-Key verwenden' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neu einrichten' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onSubmit).toHaveBeenCalledWith({ password: '', storageMode: 'encrypted' });
  });

  it('spricht vom Verdecken statt vom Entsperren', () => {
    render(<AuthScreen mode="login" configuredStorageMode="plain" onSubmit={vi.fn()} busy={false} />);

    expect(screen.getByRole('heading', { name: 'Bildschirm verdeckt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entsperren' })).not.toBeInTheDocument();
    // Keine Belehrung ueber die eigene Einrichtung.
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('verlangt bei verschlüsselter Datenbank weiterhin ein Passwort', () => {
    render(<AuthScreen mode="login" configuredStorageMode="encrypted" onSubmit={vi.fn()} busy={false} />);

    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ClearDeck entsperren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entsperren' })).toBeInTheDocument();
  });

  it('zeigt im Login einen Reset-Knopf für nicht wiederherstellbare Datenbanken', () => {
    const onResetApp = vi.fn();

    render(
      <AuthScreen
        mode="login"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onResetApp={onResetApp}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Neu einrichten' }));

    expect(onResetApp).toHaveBeenCalledTimes(1);
  });
});
