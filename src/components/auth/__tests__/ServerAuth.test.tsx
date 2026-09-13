/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  connection: { get: vi.fn(), connect: vi.fn(), local: vi.fn() },
}));
vi.mock('../../../services/api', () => ({ api: apiMock, default: apiMock }));

import { ServerSignIn } from '../ServerAuth';

const rememberedServer = {
  mode: 'server',
  connected: false,
  url: 'https://example.org',
  username: 'maria',
  hasOfflineCopy: true,
  syncStatus: 'auth-required',
  pendingChanges: 2,
};

beforeEach(() => {
  vi.resetAllMocks();
  apiMock.connection.get.mockResolvedValue(rememberedServer);
});

const fillPassword = () => {
  fireEvent.change(screen.getByLabelText('Passwort'), {
    target: { value: 'personal-password' },
  });
};

describe('ServerSignIn', () => {
  it('offers explicit offline sign-in for a remembered protected copy', async () => {
    apiMock.connection.connect.mockRejectedValue(new Error('Offline-Test'));
    render(<ServerSignIn />);

    expect(await screen.findByRole('button', { name: 'Offline öffnen' })).toBeInTheDocument();
    expect(screen.getByText('example.org')).toBeInTheDocument();
    expect(screen.queryByLabelText('Datenschlüssel')).not.toBeInTheDocument();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Offline öffnen' }));

    await waitFor(() => expect(apiMock.connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: false,
      offline: true,
    }));
  });

  it('does not fall back to offline after a failed online sign-in', async () => {
    apiMock.connection.connect.mockRejectedValue(new Error('Anmeldung fehlgeschlagen'));
    render(<ServerSignIn />);
    await screen.findByRole('button', { name: 'Offline öffnen' });
    expect(screen.getByText('example.org')).toBeInTheDocument();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen');
    expect(apiMock.connection.connect).toHaveBeenCalledOnce();
    expect(apiMock.connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: false,
    });
  });
});
