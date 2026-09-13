/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  connection: { get: vi.fn(), connect: vi.fn(), local: vi.fn(), refresh: vi.fn() },
  updates: { getPreferences: vi.fn(), savePreferences: vi.fn() },
}));
vi.mock('../../../../services/api', () => ({ api: apiMock, default: apiMock }));

import SettingsConnections from '../SettingsConnections';

const { connection, updates } = apiMock;
const reader = { mode: 'server', connected: true, role: 'reader', username: 'maria', url: 'https://example.org' };

const renderPage = () => {
  const changed = vi.fn();
  const notice = vi.fn();
  render(<SettingsConnections onNotice={notice} onDataSourceChanged={changed} />);
  return { changed, notice };
};

const fillCredentials = (dialog: HTMLElement) => {
  fireEvent.change(within(dialog).getByLabelText('Serveradresse'), { target: { value: 'https://example.org' } });
  fireEvent.change(within(dialog).getByLabelText('Benutzername'), { target: { value: 'maria' } });
  fireEvent.change(within(dialog).getByLabelText('Serverpasswort'), { target: { value: 'personal-password' } });
};

beforeEach(() => {
  vi.resetAllMocks();
  connection.get.mockResolvedValue({ mode: 'local', connected: false });
  connection.connect.mockResolvedValue({ mode: 'server', connected: true });
  updates.getPreferences.mockResolvedValue({ repositoryUrl: 'https://github.com/Rasalas/employee-db', hasToken: false });
});

describe('Datenablage', () => {
  it('opens an existing workspace from its own dialog without uploading local data', async () => {
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Serverbestand öffnen' });
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    fillCredentials(dialog);
    fireEvent.change(within(dialog).getByLabelText('Datenschlüssel'), { target: { value: 'shared-key' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(connection.connect).toHaveBeenCalledWith({ url: 'https://example.org', username: 'maria', password: 'personal-password', dataKey: 'shared-key', initialize: false });
  });

  it('only transfers after the generated key was acknowledged', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Lokalen Bestand auf Server übertragen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Lokalen Bestand übertragen' });
    fillCredentials(dialog);
    const submit = within(dialog).getByRole('button', { name: 'Übertragen und verbinden' });
    expect(submit).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /sicher abgelegt/ }));
    fireEvent.click(submit);
    await waitFor(() => expect(connection.connect).toHaveBeenCalledWith(expect.objectContaining({ initialize: true })));
    expect(connection.connect.mock.calls[0][0].dataKey).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  });

  it('forgets secrets and consent when the dialog is closed', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Lokalen Bestand auf Server übertragen/ }));
    let dialog = screen.getByRole('dialog');
    fillCredentials(dialog);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /sicher abgelegt/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: /Lokalen Bestand auf Server übertragen/ }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Serverpasswort')).toHaveValue('');
    expect(within(dialog).getByRole('checkbox', { name: /sicher abgelegt/ })).not.toBeChecked();
  });

  it('keeps the dialog open with a cleaned error when connecting fails', async () => {
    connection.connect.mockRejectedValue(new Error('Anmeldung fehlgeschlagen'));
    const { changed } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Serverbestand öffnen/ }));
    const dialog = screen.getByRole('dialog');
    fillCredentials(dialog);
    fireEvent.change(within(dialog).getByLabelText('Datenschlüssel'), { target: { value: 'shared-key' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verbinden' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen');
    expect(within(dialog).getByLabelText('Serverpasswort')).toHaveValue('');
    expect(changed).not.toHaveBeenCalled();
  });

  it('shows the server account and offers refresh and sign-in changes', async () => {
    connection.get.mockResolvedValue(reader);
    connection.refresh.mockResolvedValue(undefined);
    const { changed } = renderPage();
    expect(await screen.findByText('example.org · maria · Nur lesen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Serverbestand neu laden/ }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: /Anmeldung ändern/ }));
    expect(screen.getByLabelText('Serveradresse')).toHaveValue('https://example.org');
    expect(screen.getByLabelText('Benutzername')).toHaveValue('maria');
  });

  it('confirms before switching back to the local workspace', async () => {
    connection.get.mockResolvedValue(reader);
    connection.local.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Zum lokalen Bestand wechseln/ }));
    expect(screen.getByText(/Änderungen vom Server werden nicht übernommen/)).toBeInTheDocument();
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
