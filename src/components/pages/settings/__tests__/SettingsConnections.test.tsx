/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  connection: { get: vi.fn(), connect: vi.fn(), local: vi.fn(), refresh: vi.fn(), resolveConflict: vi.fn() },
  updates: { getPreferences: vi.fn(), savePreferences: vi.fn() },
}));
vi.mock('../../../../services/api', () => ({ api: apiMock, default: apiMock }));

import SettingsConnections from '../SettingsConnections';

const { connection, updates } = apiMock;
const reader = {
  mode: 'server',
  connected: true,
  role: 'reader',
  username: 'maria',
  url: 'https://example.org',
  syncStatus: 'synced',
  pendingChanges: 0,
};

const renderPage = () => {
  const changed = vi.fn();
  const notice = vi.fn();
  render(<SettingsConnections onNotice={notice} onDataSourceChanged={changed} />);
  return { changed, notice };
};

const fillCredentials = (dialog: HTMLElement, url = 'https://example.org') => {
  fireEvent.change(within(dialog).getByLabelText('Serveradresse'), { target: { value: url } });
  fireEvent.change(within(dialog).getByLabelText('Benutzername'), { target: { value: 'maria' } });
  fireEvent.change(within(dialog).getByLabelText('Passwort'), { target: { value: 'personal-password' } });
};

beforeEach(() => {
  vi.resetAllMocks();
  connection.get.mockResolvedValue({ mode: 'local', connected: false });
  connection.connect.mockResolvedValue({ mode: 'server', connected: true });
  connection.resolveConflict.mockResolvedValue(undefined);
  updates.getPreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/Rasalas/employee-db', hasToken: false });
});

describe('Datenablage', () => {
  it('opens an existing workspace with address, account and password in one dialog', async () => {
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Serverbestand öffnen' });
    expect(within(dialog).queryByLabelText('Datenschlüssel')).not.toBeInTheDocument();
    fillCredentials(dialog, 'https://example.org/');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: false,
    });
  });

  it('transfers with initialize and names the admin requirement', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Lokalen Bestand auf Server übertragen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Lokalen Bestand übertragen' });
    expect(within(dialog).getByText(/Administratorkonto erforderlich/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    fillCredentials(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Übertragen und verbinden' }));
    await waitFor(() => expect(connection.connect).toHaveBeenCalledWith(expect.objectContaining({ initialize: true })));
  });

  it('rejects plain HTTP to a remote server before contacting it', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    const dialog = screen.getByRole('dialog');
    fillCredentials(dialog, 'http://example.org');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('HTTPS');
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with a cleaned error when connecting fails', async () => {
    connection.connect.mockRejectedValue(new Error('Anmeldung fehlgeschlagen'));
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    const dialog = screen.getByRole('dialog');
    fillCredentials(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen');
    expect(within(dialog).getByLabelText('Passwort')).toHaveValue('');
    expect(changed).not.toHaveBeenCalled();
  });

  it('shows one status tag with account details and synchronizes in place', async () => {
    connection.get.mockResolvedValue({ ...reader, role: 'editor', syncStatus: 'pending', pendingChanges: 2, lastSyncedAt: '2026-09-13T10:00:00.000Z' });
    connection.refresh.mockResolvedValue(undefined);
    const { changed } = renderPage();
    expect(await screen.findByText('Ausstehende Änderungen')).toBeInTheDocument();
    expect(screen.getByText('example.org · maria · Lesen und bearbeiten')).toBeInTheDocument();
    expect(screen.getByText(/2 Änderungen warten/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Jetzt synchronisieren/ }));
    await waitFor(() => expect(connection.refresh).toHaveBeenCalledOnce());
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Anmeldung ändern/ }));
    expect(screen.getByLabelText('Serveradresse')).toHaveValue('https://example.org');
    expect(screen.getByLabelText('Benutzername')).toHaveValue('maria');
  });

  it('explains offline mode and offers a retry', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'offline' });
    renderPage();
    expect(await screen.findByText(/Server ist nicht erreichbar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeInTheDocument();
  });

  it('puts conflict decisions first and confirms the full queue impact', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'conflict', pendingChanges: 3 });
    renderPage();
    expect(await screen.findByText('Konflikt')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('3 lokale Änderungen passen nicht mehr zum Serverstand');
    const rows = screen.getAllByRole('button').filter((button) => button.classList.contains('cd-item'));
    expect(rows[0]).toHaveTextContent('Serverversion übernehmen');
    expect(screen.queryByRole('button', { name: /Jetzt synchronisieren/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lokale Änderungen erneut senden/ })).not.toBeInTheDocument();
    fireEvent.click(rows[0]);
    const dialog = screen.getByRole('dialog', { name: 'Serverversion übernehmen?' });
    expect(within(dialog).getByText(/ALLE 3 ausstehenden lokalen Änderungen/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Wiederherstellungssicherung/)).toBeInTheDocument();
    expect(connection.resolveConflict).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Serverversion übernehmen' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('server'));
  });

  it('lets writers resend local changes after a conflict', async () => {
    connection.get.mockResolvedValue({ ...reader, role: 'admin', syncStatus: 'conflict', pendingChanges: 2 });
    renderPage();
    expect(await screen.findByText(/Administration/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lokale Änderungen erneut senden/ }));
    const dialog = screen.getByRole('dialog', { name: 'Lokale Änderungen erneut senden?' });
    expect(within(dialog).getByText(/weiterhin abgelehnt werden/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lokale Änderungen erneut senden' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('local'));
  });

  it('asks for a new sign-in first when the session expired with waiting changes', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'auth-required', pendingChanges: 2 });
    renderPage();
    await screen.findByRole('button', { name: /Erneut anmelden/ });
    const rows = screen.getAllByRole('button').filter((button) => button.classList.contains('cd-item'));
    expect(rows[0]).toHaveTextContent('Erneut anmelden');
    expect(screen.getByRole('alert')).toHaveTextContent('2 Änderungen warten');
    fireEvent.click(rows[0]);
    const dialog = screen.getByRole('dialog', { name: 'Erneut anmelden' });
    expect(within(dialog).getByLabelText('Benutzername')).toHaveValue('maria');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: /Serverversion übernehmen/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Serverversion übernehmen' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('server'));
  });

  it('does not offer to discard anything when no changes are waiting', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'auth-required', pendingChanges: 0 });
    renderPage();
    await screen.findByText('Anmeldung erforderlich');
    expect(screen.queryByRole('button', { name: /Serverversion übernehmen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lokale Änderungen erneut senden/ })).not.toBeInTheDocument();
  });

  it('polls connection state every three seconds while mounted', async () => {
    vi.useFakeTimers();
    try {
      connection.get.mockResolvedValue(reader);
      renderPage();
      expect(connection.get).toHaveBeenCalledOnce();
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
      expect(connection.get).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('warns about waiting changes before switching back to the local workspace', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'pending', pendingChanges: 1 });
    connection.local.mockResolvedValue(undefined);
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Zum lokalen Bestand wechseln/ }));
    const dialog = screen.getByRole('dialog', { name: 'Zum lokalen Bestand wechseln?' });
    expect(within(dialog).getByText(/1 Änderung wartet noch auf Übertragung/)).toBeInTheDocument();
    expect(connection.local).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lokalen Bestand öffnen' }));
    await waitFor(() => expect(connection.local).toHaveBeenCalledOnce());
    expect(changed).toHaveBeenCalledOnce();
  });
});

describe('Updates', () => {
  const openUpdateSource = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Update-Quelle ändern/ }));
    return screen.getByRole('dialog', { name: 'Update-Quelle' });
  };

  it('saves the URL and an optional token without keeping it on screen', async () => {
    updates.savePreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/example/private-app', hasToken: true });
    const { notice } = renderPage();
    const dialog = await openUpdateSource();
    expect(within(dialog).getByLabelText('Persönlicher Zugriffstoken')).toHaveAttribute('type', 'password');
    fireEvent.change(within(dialog).getByLabelText('GitHub-Repository'), { target: { value: 'https://github.com/example/private-app' } });
    fireEvent.change(within(dialog).getByLabelText('Persönlicher Zugriffstoken'), { target: { value: 'synthetic-token' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(notice).toHaveBeenCalledWith('Update-Quelle gespeichert.'));
    expect(updates.savePreferences).toHaveBeenCalledWith({ repositoryUrl: 'https://github.com/example/private-app', token: 'synthetic-token' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('github.com/example/private-app · Token gespeichert')).toBeInTheDocument();
    expect(screen.queryByText('synthetic-token')).not.toBeInTheDocument();
  });

  it('keeps a saved token when the field stays empty and removes it explicitly', async () => {
    updates.getPreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/Rasalas/employee-db', hasToken: true });
    updates.savePreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/Rasalas/employee-db', hasToken: true });
    renderPage();
    let dialog = await openUpdateSource();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(updates.savePreferences).toHaveBeenCalledWith({ repositoryUrl: 'https://github.com/Rasalas/employee-db' }));

    updates.savePreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/Rasalas/employee-db', hasToken: false });
    dialog = await openUpdateSource();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Token entfernen' }));
    await waitFor(() => expect(updates.savePreferences).toHaveBeenLastCalledWith({ repositoryUrl: 'https://github.com/Rasalas/employee-db', token: '' }));
  });

  it('shows cleaned API errors inside the dialog', async () => {
    updates.savePreferences.mockRejectedValue(
      new Error('Error invoking remote method "updates.savePreferences": Error: Die Repository-URL ist ungültig.'),
    );
    renderPage();
    const dialog = await openUpdateSource();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Die Repository-URL ist ungültig.');
  });
});
