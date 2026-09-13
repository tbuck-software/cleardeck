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

const fillCredentials = async (dialog: HTMLElement): Promise<HTMLElement> => {
  const name = dialog.getAttribute('aria-label') ?? '';
  fireEvent.click(within(dialog).getByRole('button', { name: /Server (einrichten|ändern)/ }));
  const addressDialog = await screen.findByRole('dialog', { name: /Server.*(einrichten|ändern)/i });
  fireEvent.change(within(addressDialog).getByLabelText('Serveradresse'), { target: { value: 'https://example.org' } });
  fireEvent.click(within(addressDialog).getByRole('button', { name: 'Übernehmen' }));
  const activeDialog = await screen.findByRole('dialog', { name });
  fireEvent.change(within(activeDialog).getByLabelText('Benutzername'), { target: { value: 'maria' } });
  fireEvent.change(within(activeDialog).getByLabelText('Passwort'), { target: { value: 'personal-password' } });
  return activeDialog;
};

beforeEach(() => {
  vi.resetAllMocks();
  connection.get.mockResolvedValue({ mode: 'local', connected: false });
  connection.connect.mockResolvedValue({ mode: 'server', connected: true });
  connection.resolveConflict.mockResolvedValue(undefined);
  updates.getPreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/Rasalas/employee-db', hasToken: false });
});

describe('Datenablage', () => {
  it('opens an existing workspace with credentials and no shared data key', async () => {
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    let dialog = screen.getByRole('dialog', { name: 'Serverbestand öffnen' });
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Datenschlüssel')).not.toBeInTheDocument();
    dialog = await fillCredentials(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: false,
    });
  });

  it('transfers after credentials without generating or acknowledging a key', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Lokalen Bestand auf Server übertragen/ }));
    let dialog = screen.getByRole('dialog', { name: 'Lokalen Bestand übertragen' });
    dialog = await fillCredentials(dialog);
    const submit = within(dialog).getByRole('button', { name: 'Übertragen und verbinden' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(connection.connect).toHaveBeenCalledWith({
      url: 'https://example.org',
      username: 'maria',
      password: 'personal-password',
      initialize: true,
    }));
    expect(connection.connect.mock.calls[0][0]).not.toHaveProperty('dataKey');
  });

  it('does not render key generation, copy, or acknowledgement controls', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Lokalen Bestand auf Server übertragen/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/Datenschlüssel/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Kopieren' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Neu erzeugen' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps the dialog open with a cleaned error when connecting fails', async () => {
    connection.connect.mockRejectedValue(new Error('Anmeldung fehlgeschlagen'));
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    let dialog = screen.getByRole('dialog');
    dialog = await fillCredentials(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen');
    expect(within(dialog).getByLabelText('Passwort')).toHaveValue('');
    expect(changed).not.toHaveBeenCalled();
  });

  it('shows pending state and synchronizes in place without reloading the app', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'pending', pendingChanges: 2, lastSyncedAt: '2026-09-13T10:00:00.000Z' });
    connection.refresh.mockResolvedValue(undefined);
    const { changed } = renderPage();
    expect(await screen.findByText('Ausstehende Änderungen')).toBeInTheDocument();
    expect(screen.getByText('2 ausstehende lokale Änderungen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Jetzt synchronisieren/ }));
    await waitFor(() => expect(connection.refresh).toHaveBeenCalledOnce());
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Anmeldung ändern/ }));
    expect(screen.getByText('example.org')).toBeInTheDocument();
    expect(screen.getByLabelText('Benutzername')).toHaveValue('maria');
  });

  it('offers conflict resolution only for conflicts and confirms the full queue impact', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'conflict', pendingChanges: 3 });
    renderPage();
    expect(await screen.findByText('Konflikt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Serverversion übernehmen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Serverversion übernehmen?' });
    expect(within(dialog).getByText(/ALLE ausstehenden lokalen Änderungen/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Wiederherstellungssicherung/)).toBeInTheDocument();
    expect(connection.resolveConflict).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Serverversion übernehmen' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('server'));
  });

  it('explains that local conflict replay can still be rejected', async () => {
    connection.get.mockResolvedValue({ ...reader, role: 'editor', syncStatus: 'conflict', pendingChanges: 3 });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Lokale Änderungen erneut senden/ }));
    const dialog = screen.getByRole('dialog', { name: 'Lokale Änderungen erneut senden?' });
    expect(within(dialog).getByText(/neuesten Serverversionen erneut ein/)).toBeInTheDocument();
    expect(within(dialog).getByText(/weiterhin abgelehnt werden/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lokale Änderungen erneut senden' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('local'));
  });

  it('allows a reader with a retained queue to explicitly adopt the server state', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'auth-required', pendingChanges: 2 });
    renderPage();
    const action = await screen.findByRole('button', { name: /Serverstand übernehmen/ });
    fireEvent.click(action);
    const dialog = screen.getByRole('dialog', { name: 'Serverversion übernehmen?' });
    expect(within(dialog).getByText(/ALLE ausstehenden lokalen Änderungen/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Serverversion übernehmen' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('server'));
    expect(screen.queryByRole('button', { name: /Lokale Änderungen erneut senden/ })).not.toBeInTheDocument();
  });

  it('labels admins clearly and allows them to replay the retained queue', async () => {
    connection.get.mockResolvedValue({ ...reader, role: 'admin', syncStatus: 'conflict', pendingChanges: 2 });
    renderPage();
    expect(await screen.findByText(/Administration/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lokale Änderungen erneut senden/ }));
    const dialog = screen.getByRole('dialog', { name: 'Lokale Änderungen erneut senden?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lokale Änderungen erneut senden' }));
    await waitFor(() => expect(connection.resolveConflict).toHaveBeenCalledWith('local'));
  });

  it('does not offer queue discard or replay when auth is required without pending changes', async () => {
    connection.get.mockResolvedValue({ ...reader, syncStatus: 'auth-required', pendingChanges: 0 });
    renderPage();
    await screen.findByText('Anmeldung erforderlich');
    expect(screen.queryByRole('button', { name: /Serverstand übernehmen/ })).not.toBeInTheDocument();
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

  it('confirms before switching back to the local workspace', async () => {
    connection.get.mockResolvedValue(reader);
    connection.local.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Zum lokalen Bestand wechseln/ }));
    expect(screen.getByText(/Serverdaten werden nicht in den lokalen Bestand übertragen/)).toBeInTheDocument();
    expect(connection.local).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lokalen Bestand öffnen' }));
    await waitFor(() => expect(connection.local).toHaveBeenCalledOnce());
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
