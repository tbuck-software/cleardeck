import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsConnection from '../settings/SettingsConnection';

const connection = vi.hoisted(() => ({ get: vi.fn(), connect: vi.fn(), local: vi.fn(), refresh: vi.fn() }));
vi.mock('../../../services/api', () => ({ default: { connection } }));

beforeEach(() => {
  vi.resetAllMocks();
  connection.get.mockResolvedValue({ mode: 'local', connected: false });
  connection.connect.mockResolvedValue({ mode: 'server', connected: true });
});

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Mit einem Server verbinden' }));
  fireEvent.change(screen.getByLabelText('Serveradresse'), { target: { value: 'https://example.org' } });
  fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'maria' } });
  fireEvent.change(screen.getByLabelText('Serverpasswort'), { target: { value: 'personal-password' } });
  fireEvent.change(screen.getByLabelText('Datenschlüssel'), { target: { value: 'shared-key' } });
}

it('starts locally without contacting a server or offering transfer on a locked device', async () => {
  render(<SettingsConnection />);
  await openForm();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(connection.connect).not.toHaveBeenCalled();
});

it('connects to an existing workspace without implicitly uploading local data', async () => {
  const changed = vi.fn();
  render(<SettingsConnection allowTransfer onChanged={changed} />);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(connection.connect).toHaveBeenCalledWith({ url: 'https://example.org', username: 'maria', password: 'personal-password', dataKey: 'shared-key', initialize: false });
  expect(screen.getByLabelText('Serverpasswort')).toHaveValue('');
});

it('requires separate transfer and key preservation acknowledgements', async () => {
  render(<SettingsConnection allowTransfer onChanged={vi.fn()} />);
  await openForm();
  fireEvent.click(screen.getByRole('checkbox', { name: /gesamten lokalen Bestand/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Übertragen und verbinden' }));
  expect(connection.connect).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('sicher ablegen');
  fireEvent.click(screen.getByRole('checkbox', { name: /sicher abgelegt/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Übertragen und verbinden' }));
  await waitFor(() => expect(connection.connect).toHaveBeenCalledWith(expect.objectContaining({ initialize: true })));
});

it('keeps the local selection when connecting fails', async () => {
  connection.connect.mockRejectedValue(new Error('Anmeldung fehlgeschlagen'));
  const changed = vi.fn();
  render(<SettingsConnection onChanged={changed} />);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen');
  expect(changed).not.toHaveBeenCalled();
  expect(connection.local).not.toHaveBeenCalled();
});

it('offers explicit refresh and a return to local storage for a reader', async () => {
  connection.get.mockResolvedValue({ mode: 'server', connected: true, role: 'reader', username: 'maria', url: 'https://example.org' });
  connection.refresh.mockResolvedValue(undefined);
  const changed = vi.fn();
  render(<SettingsConnection onChanged={changed} />);
  expect(await screen.findByText(/Nur lesen/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zum lokalen Bestand wechseln' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Serverbestand neu laden' }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(connection.refresh).toHaveBeenCalledOnce();
});
