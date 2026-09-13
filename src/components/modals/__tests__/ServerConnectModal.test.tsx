/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  connection: { connect: vi.fn() },
}));
vi.mock('../../../services/api', () => ({ api: apiMock, default: apiMock }));

import ServerConnectModal from '../ServerConnectModal';

const fillCredentials = async (dialog: HTMLElement): Promise<HTMLElement> => {
  const name = dialog.getAttribute('aria-label') ?? '';
  fireEvent.click(within(dialog).getByRole('button', { name: /Server (einrichten|ändern)/ }));
  const addressDialog = await screen.findByRole('dialog', { name: /Server.*(einrichten|ändern)/i });
  fireEvent.change(within(addressDialog).getByLabelText('Serveradresse'), {
    target: { value: 'https://example.org' },
  });
  fireEvent.click(within(addressDialog).getByRole('button', { name: 'Übernehmen' }));
  const activeDialog = await screen.findByRole('dialog', { name });
  fireEvent.change(within(activeDialog).getByLabelText('Benutzername'), {
    target: { value: 'maria' },
  });
  fireEvent.change(within(activeDialog).getByLabelText('Passwort'), {
    target: { value: 'personal-password' },
  });
  return activeDialog;
};

beforeEach(() => {
  vi.resetAllMocks();
  apiMock.connection.connect.mockResolvedValue({ mode: 'server', connected: true });
});

describe('ServerConnectModal', () => {
  it('submits a normal connection without a shared data key', async () => {
    const onConnected = vi.fn();
    render(
      <ServerConnectModal
        variant="open"
        onClose={vi.fn()}
        onConnected={onConnected}
      />,
    );
    let dialog = screen.getByRole('dialog', { name: 'Serverbestand öffnen' });
    dialog = await fillCredentials(dialog);
    expect(within(dialog).queryByLabelText('Datenschlüssel')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));

    await waitFor(() => expect(apiMock.connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: false,
    }));
    expect(apiMock.connection.connect.mock.calls[0][0]).not.toHaveProperty('dataKey');
    expect(onConnected).toHaveBeenCalledOnce();
  });

  it('uses initialize for a transfer without key generation or acknowledgement', async () => {
    render(
      <ServerConnectModal
        variant="transfer"
        onClose={vi.fn()}
        onConnected={vi.fn()}
      />,
    );
    let dialog = screen.getByRole('dialog', { name: 'Lokalen Bestand übertragen' });
    dialog = await fillCredentials(dialog);
    expect(within(dialog).getByText(/Administratorkonto erforderlich/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Datenschlüssel/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Übertragen und verbinden' }));

    await waitFor(() => expect(apiMock.connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: true,
    }));
  });

  it('validates the address, preserves cancel, and clears credentials for a new server', async () => {
    render(
      <ServerConnectModal
        variant="login"
        initialUrl="https://example.org"
        initialUsername="maria"
        onClose={vi.fn()}
        onConnected={vi.fn()}
      />,
    );
    let dialog = screen.getByRole('dialog', { name: 'Anmeldung ändern' });
    fireEvent.change(within(dialog).getByLabelText('Passwort'), {
      target: { value: 'personal-password' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Server ändern…' }));

    let addressDialog = screen.getByRole('dialog', { name: 'Serveradresse ändern' });
    fireEvent.change(within(addressDialog).getByLabelText('Serveradresse'), {
      target: { value: 'http://example.org' },
    });
    fireEvent.click(within(addressDialog).getByRole('button', { name: 'Übernehmen' }));
    expect(await within(addressDialog).findByRole('alert')).toHaveTextContent('HTTPS');

    fireEvent.click(within(addressDialog).getByRole('button', { name: 'Abbrechen' }));
    dialog = await screen.findByRole('dialog', { name: 'Anmeldung ändern' });
    expect(within(dialog).getByText('example.org')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Passwort')).toHaveValue('personal-password');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Server ändern…' }));
    addressDialog = screen.getByRole('dialog', { name: 'Serveradresse ändern' });
    fireEvent.change(within(addressDialog).getByLabelText('Serveradresse'), {
      target: { value: 'https://other.example' },
    });
    fireEvent.click(within(addressDialog).getByRole('button', { name: 'Übernehmen' }));
    dialog = await screen.findByRole('dialog', { name: 'Anmeldung ändern' });
    expect(within(dialog).getByText('other.example')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Passwort')).toHaveValue('');
  });
});
