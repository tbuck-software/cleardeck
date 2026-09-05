/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AuthScreen from '../AuthScreen';
import AuthUpdates from '../AuthUpdates';

/** Same popover as in the app, so the update has to be opened before acting. */
const openPopover = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('updates before authentication', () => {
  it.each(['setup', 'login', 'error'] as const)('can install a downloaded update from %s', (mode) => {
    const install = vi.fn().mockResolvedValue(undefined);
    render(
      <AuthScreen
        mode={mode}
        busy={false}
        onSubmit={vi.fn()}
        footer={
          <AuthUpdates
            status={{ state: 'downloaded', version: '1.8.1' }}
            onCheck={vi.fn()}
            onDownload={vi.fn()}
            onInstall={install}
          />
        }
      />,
    );

    openPopover(/Update 1\.8\.1/);
    fireEvent.click(screen.getByRole('button', { name: 'Installieren & neu starten' }));
    expect(install).toHaveBeenCalledOnce();
  });

  it('shows feed errors and the installed version before login', () => {
    render(
      <AuthUpdates
        status={{ state: 'error', message: 'Bitte manuell installieren.' }}
        version="1.8.0"
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText('ClearDeck 1.8.0')).toBeInTheDocument();

    openPopover(/Update fehlgeschlagen/);
    expect(screen.getByRole('textbox', { name: 'Update-Fehlerdetails' })).toHaveValue(
      'Bitte manuell installieren.',
    );
  });

  it('zeigt die Neuerungen im selben Popover wie in der App', () => {
    render(
      <AuthUpdates
        status={{
          state: 'downloaded',
          version: '1.9.0',
          releaseNotes: '## [1.9.0] - 2026-09-04\n### Hinzugefügt\n- Jahresnachweis als Excel',
        }}
        version="1.8.0"
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    openPopover(/Update 1\.9\.0/);
    expect(screen.getByText('v1.9.0')).toBeInTheDocument();
    expect(screen.getByText('Jahresnachweis als Excel')).toBeInTheDocument();
  });

  it('hält sich bei aktueller Version auf die Versionszeile zurück', () => {
    render(
      <AuthUpdates
        status={{ state: 'not-available' }}
        version="1.8.0"
        onCheck={vi.fn()}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText('ClearDeck 1.8.0')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
