/// <reference types="vitest/globals" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UpdateErrorDetails from '../UpdateErrorDetails';

describe('UpdateErrorDetails', () => {
  const message = 'Cannot find asset "ClearDeck-1.8.0-Setup.exe" in: ' + 'long release metadata '.repeat(1000);

  afterEach(() => vi.unstubAllGlobals());

  it('keeps the entire error selectable in a read-only text box and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<UpdateErrorDetails message={message} />);
    const details = screen.getByRole('textbox', { name: 'Update-Fehlerdetails' });
    expect(details).toHaveValue(message);
    expect(details).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Fehler kopieren' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(message));
    expect(await screen.findByText('Kopiert')).toBeInTheDocument();
  });

  it('selects the text for manual copying if clipboard access fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    render(<UpdateErrorDetails message={message} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fehler kopieren' }));
    expect(await screen.findByText('Text markiert. Bitte mit Strg+C oder ⌘C kopieren.')).toBeInTheDocument();
    const details = screen.getByRole('textbox', { name: 'Update-Fehlerdetails' }) as HTMLTextAreaElement;
    expect(details.selectionEnd - details.selectionStart).toBe(message.length);
  });
});
