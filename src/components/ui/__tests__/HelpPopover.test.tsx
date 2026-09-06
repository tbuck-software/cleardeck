/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import HelpPopover from '../HelpPopover';

const entries = [
  { title: 'Erste Frage', body: 'Erste Antwort.' },
  { title: 'Zweite Frage', body: 'Zweite Antwort.' },
];

describe('HelpPopover', () => {
  it('zeigt die Hinweise erst beim Hovern', () => {
    render(<HelpPopover entries={entries} heading="Testseite" />);

    expect(screen.queryByText('Erste Antwort.')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hilfe' }).parentElement as Element);

    expect(screen.getByText('Erste Antwort.')).toBeInTheDocument();
    expect(screen.getByText('Zweite Antwort.')).toBeInTheDocument();
  });

  it('hält das Popover nach einem Klick offen, bis erneut geklickt wird', () => {
    render(<HelpPopover entries={entries} />);

    const trigger = screen.getByRole('button', { name: 'Hilfe' });
    fireEvent.click(trigger);
    fireEvent.mouseLeave(trigger.parentElement as Element);

    expect(screen.getByText('Erste Antwort.')).toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.queryByText('Erste Antwort.')).not.toBeInTheDocument();
  });

  it('rendert nichts ohne Hinweise', () => {
    render(<HelpPopover entries={[]} />);

    expect(screen.queryByRole('button', { name: 'Hilfe' })).not.toBeInTheDocument();
  });
});
