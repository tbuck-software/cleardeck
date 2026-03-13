/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AuthScreen from '../AuthScreen';

describe('AuthScreen', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Neu anlegen' }));

    expect(onResetApp).toHaveBeenCalledTimes(1);
  });
});
