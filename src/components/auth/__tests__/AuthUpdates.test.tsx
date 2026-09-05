/// <reference types="vitest/globals" />

import { fireEvent, render, screen } from '@testing-library/react';
import AuthScreen from '../AuthScreen';
import AuthUpdates from '../AuthUpdates';

describe('updates before authentication', () => {
  it.each(['setup', 'login', 'error'] as const)('can install a downloaded update from %s', (mode) => {
    const install = vi.fn().mockResolvedValue(undefined);
    render(<AuthScreen mode={mode} busy={false} onSubmit={vi.fn()} footer={
      <AuthUpdates status={{ state: 'downloaded', version: '1.8.1' }} onCheck={vi.fn()} onInstall={install} />
    } />);
    fireEvent.click(screen.getByRole('button', { name: 'Update installieren und neu starten' }));
    expect(install).toHaveBeenCalledOnce();
  });

  it('shows feed errors and the installed version before login', () => {
    render(<AuthUpdates status={{ state: 'error', message: 'Bitte manuell installieren.' }} version="1.8.0" onCheck={vi.fn()} onInstall={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Update-Fehlerdetails' })).toHaveValue('Bitte manuell installieren.');
    expect(screen.getByText('ClearDeck 1.8.0')).toBeInTheDocument();
  });
});
