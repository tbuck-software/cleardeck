/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  connection: { connect: vi.fn() },
}));
vi.mock('../../../services/api', () => ({ api: apiMock, default: apiMock }));

import ServerConnectModal, { normalizeServerAddress } from '../ServerConnectModal';

beforeEach(() => {
  vi.resetAllMocks();
  apiMock.connection.connect.mockResolvedValue({ mode: 'server', connected: true });
});

describe('normalizeServerAddress', () => {
  it('keeps only the origin and allows HTTP on this device', () => {
    expect(normalizeServerAddress(' https://example.org/ ')).toBe('https://example.org');
    expect(normalizeServerAddress('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
  });

  it('rejects remote HTTP, paths and credentials', () => {
    expect(() => normalizeServerAddress('http://example.org')).toThrow('HTTPS');
    expect(() => normalizeServerAddress('https://example.org/api')).toThrow('ohne Pfad');
    expect(() => normalizeServerAddress('https://user:pw@example.org')).toThrow('ohne Pfad');
  });
});

describe('ServerConnectModal', () => {
  it('prefills a known account and clears the password when reopened', async () => {
    const { rerender } = render(
      <ServerConnectModal variant="login" initialUrl="https://example.org" initialUsername="maria" onClose={vi.fn()} onConnected={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Anmeldung ändern' });
    expect(within(dialog).getByLabelText('Serveradresse')).toHaveValue('https://example.org');
    expect(within(dialog).getByLabelText('Benutzername')).toHaveValue('maria');
    fireEvent.change(within(dialog).getByLabelText('Passwort'), { target: { value: 'personal-password' } });

    rerender(<ServerConnectModal variant={null} onClose={vi.fn()} onConnected={vi.fn()} />);
    rerender(
      <ServerConnectModal variant="login" initialUrl="https://example.org" initialUsername="maria" onClose={vi.fn()} onConnected={vi.fn()} />,
    );
    expect(screen.getByLabelText('Passwort')).toHaveValue('');
  });

  it('submits with Enter and never sends a data key', async () => {
    const onConnected = vi.fn();
    render(<ServerConnectModal variant="open" onClose={vi.fn()} onConnected={onConnected} />);
    const dialog = screen.getByRole('dialog', { name: 'Serverbestand öffnen' });
    fireEvent.change(within(dialog).getByLabelText('Serveradresse'), { target: { value: 'https://example.org' } });
    fireEvent.change(within(dialog).getByLabelText('Benutzername'), { target: { value: 'maria' } });
    fireEvent.change(within(dialog).getByLabelText('Passwort'), { target: { value: 'personal-password' } });
    fireEvent.submit(within(dialog).getByLabelText('Passwort').closest('form')!);

    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
    expect(apiMock.connection.connect.mock.calls[0][0]).not.toHaveProperty('dataKey');
  });
});
