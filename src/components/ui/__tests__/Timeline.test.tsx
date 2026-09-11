/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import Timeline from '../Timeline';

const items = [
  {
    key: 'a',
    date: '24.09.2026',
    title: 'Reanimationstraining',
    subline: 'Pflichttraining für Leitung und Bezugspflege.',
    color: 'var(--color-accent-500)',
  },
  {
    key: 'b',
    date: '19.07.2024',
    title: 'Beschäftigungsperiode',
    subline: '3-jährig examiniert',
    color: 'var(--color-accent-2-500)',
    tag: <span className="tag tag-neutral">Abschnitt</span>,
  },
];

describe('Timeline', () => {
  it('stellt Datum, Punkt, Titel, Unterzeile und Tag dar', () => {
    const { container } = render(<Timeline items={items} />);

    const rows = container.querySelectorAll('.cd-timeline-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('24.09.2026');
    expect(rows[0]).toHaveTextContent('Reanimationstraining');
    expect(rows[0]).toHaveTextContent('Pflichttraining für Leitung und Bezugspflege.');
    expect(rows[1]).toHaveTextContent('Abschnitt');
    expect(
      (rows[1].querySelector('.cd-timeline-rail span') as HTMLElement).style.background,
    ).toBe('var(--color-accent-2-500)');
  });

  it('zeigt den leeren Zustand statt einer Linie ohne Einträge', () => {
    render(<Timeline items={[]} empty="Keine Einträge." />);

    expect(screen.getByText('Keine Einträge.')).toBeInTheDocument();
  });

  it('macht nur Zeilen mit onOpen klickbar', () => {
    const onOpen = vi.fn();
    render(
      <Timeline
        items={[
          items[0],
          { ...items[1], ariaLabel: 'Beschäftigungsperiode ab 19.07.2024 bearbeiten', onOpen },
        ]}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Beschäftigungsperiode ab 19.07.2024 bearbeiten' }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('öffnet auch beim Klick auf die Unterzeile', () => {
    const onOpen = vi.fn();
    render(<Timeline items={[{ ...items[0], onOpen }]} />);

    fireEvent.click(screen.getByText('Pflichttraining für Leitung und Bezugspflege.'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
