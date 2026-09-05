/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import CommandPalette, { type PaletteResult } from '../CommandPalette';

const runTeam = vi.fn();
const runPage = vi.fn();

const results = (query: string): PaletteResult[] =>
  [
    { id: 'employee-1', kind: 'Team', title: 'Anna Berger', sub: '3-jährig', run: runTeam },
    { id: 'page-audit', kind: 'Seite', title: 'MD-Prüfung', run: runPage },
  ].filter((entry) => entry.title.toLowerCase().includes(query.toLowerCase()));

describe('CommandPalette', () => {
  beforeEach(() => {
    runTeam.mockClear();
    runPage.mockClear();
  });

  it('rendert nichts, solange sie geschlossen ist', () => {
    render(<CommandPalette open={false} results={results} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('filtert nach der Eingabe', () => {
    render(<CommandPalette open results={results} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Suchbegriff'), { target: { value: 'prüf' } });

    expect(screen.getByText('MD-Prüfung')).toBeInTheDocument();
    expect(screen.queryByText('Anna Berger')).not.toBeInTheDocument();
  });

  it('führt den ersten Treffer mit Enter aus und schließt', () => {
    const onClose = vi.fn();
    render(<CommandPalette open results={results} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });

    expect(runTeam).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blättert mit den Pfeiltasten', () => {
    render(<CommandPalette open results={results} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter' });

    expect(runPage).toHaveBeenCalledTimes(1);
    expect(runTeam).not.toHaveBeenCalled();
  });

  it('schließt mit Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette open results={results} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zeigt einen leeren Zustand', () => {
    render(<CommandPalette open results={() => []} onClose={vi.fn()} />);

    expect(screen.getByText('Nichts gefunden.')).toBeInTheDocument();
  });
});
