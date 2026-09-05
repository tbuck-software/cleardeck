import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiagnosticsPanel from '../DiagnosticsPanel';
const mocks = vi.hoisted(() => ({ read: vi.fn(), export: vi.fn(), copy: vi.fn() }));
vi.mock('../../../services/api', () => ({ default: { diagnostics: mocks } }));
const entry = { at: '2026-09-05T18:24:14.060Z', level: 'error', source: 'Updates', message: 'Signaturprüfung fehlgeschlagen.' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({ entries: [entry] });
  mocks.copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } });
});
describe('diagnostic settings', () => {
  it('shows timestamps and severity, refreshes and copies only after a click', async () => {
    render(<DiagnosticsPanel />);
    await screen.findByText(entry.message);
    expect(screen.getByText('Fehler')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('dateTime', entry.at);
    expect(mocks.copy).not.toHaveBeenCalled();
    expect(mocks.export).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose kopieren' }));
    await screen.findByText(/Diagnose kopiert/);
    expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining(`${entry.at} [ERROR] Updates: ${entry.message}`));
    mocks.read.mockResolvedValue({ entries: [{ ...entry, message: 'Download abgeschlossen.' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await screen.findByText('Download abgeschlossen.');
    expect(screen.queryByText(entry.message)).not.toBeInTheDocument();
  });
  it('allows optional local export, including cancel and failure without false success', async () => {
    render(<DiagnosticsPanel />);
    await screen.findByText(entry.message);
    mocks.export.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnosedatei speichern' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Diagnosedatei speichern' })).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    mocks.export.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnosedatei speichern' }));
    await screen.findByText(/Diagnosedatei gespeichert/);
    mocks.export.mockRejectedValue(new Error('private/path/token'));
    fireEvent.click(screen.getByRole('button', { name: 'Diagnosedatei speichern' }));
    await screen.findByText(/konnte nicht gespeichert werden/);
    expect(screen.queryByText(/private\/path/)).not.toBeInTheDocument();
  });
  it('shows a recoverable read error and an honest clipboard fallback', async () => {
    mocks.read.mockRejectedValueOnce(new Error('secret'));
    render(<DiagnosticsPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Diagnose konnte nicht geladen werden');
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await screen.findByText(entry.message);
    mocks.copy.mockRejectedValue(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose kopieren' }));
    await screen.findByText(/Kopieren nicht möglich/);
  });
});
