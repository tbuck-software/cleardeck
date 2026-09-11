/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import Checkbox from '../Checkbox';
import ListRow from '../ListRow';

const chevron = (container: HTMLElement): Element | null =>
  container.querySelector('.cd-listrow-chevron');

describe('ListRow', () => {
  it('zeigt die feste Anatomie aus Titel, Unterzeile, Meta und Tag', () => {
    render(
      <ListRow
        leading={<span className="cd-code">K01</span>}
        title="Subkutane Injektion"
        subline="Behandlungspflege · bestätigt 12.03.2024"
        meta="zuletzt 27.08.2026"
        tag={<span className="tag tag-accent">Stufe 5</span>}
      />,
    );

    expect(screen.getByText('K01')).toBeInTheDocument();
    expect(screen.getByText('Subkutane Injektion')).toBeInTheDocument();
    expect(screen.getByText('Behandlungspflege · bestätigt 12.03.2024')).toBeInTheDocument();
    expect(screen.getByText('zuletzt 27.08.2026')).toBeInTheDocument();
    expect(screen.getByText('Stufe 5')).toBeInTheDocument();
  });

  it('lässt Unterzeile, Meta und Tag weg, wenn sie fehlen', () => {
    const { container } = render(<ListRow title="Nur ein Titel" />);

    expect(container.querySelector('.cd-listrow-sub')).toBeNull();
    expect(container.querySelector('.cd-listrow-meta')).toBeNull();
    expect(container.querySelector('.cd-listrow-tag')).toBeNull();
    expect(container.querySelector('.cd-listrow-lead')).toBeNull();
  });

  it('wird genau mit onOpen zur Schaltfläche mit Chevron', () => {
    const onOpen = vi.fn();
    const { container, rerender } = render(<ListRow title="Brandschutz" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(chevron(container)).toBeNull();

    rerender(<ListRow title="Brandschutz" onOpen={onOpen} />);
    expect(chevron(container)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Brandschutz' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('öffnet auch beim Klick auf Unterzeile, Meta oder Tag', () => {
    const onOpen = vi.fn();
    render(
      <ListRow
        title="Brandschutz"
        subline="ArbSchG §12"
        meta="fällig 01.01.2026"
        tag={<span className="tag tag-bad">überfällig</span>}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByText('ArbSchG §12'));
    fireEvent.click(screen.getByText('fällig 01.01.2026'));
    fireEvent.click(screen.getByText('überfällig'));
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('wählt mit onSelect ohne Chevron aus', () => {
    const onSelect = vi.fn();
    const { container } = render(<ListRow title="Erstgespräch" onSelect={onSelect} />);

    expect(chevron(container)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erstgespräch' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('markiert die Auswahl an der ganzen Zeile', () => {
    const { container, rerender } = render(<ListRow title="Hygiene" />);
    const row = container.querySelector('.cd-listrow') as HTMLElement;

    expect(row).not.toHaveAttribute('data-selected');

    rerender(<ListRow title="Hygiene" selected />);
    expect(row).toHaveAttribute('data-selected', 'true');
  });

  it('hält den Auswahlhaken im Vorspann außerhalb der Schaltfläche', () => {
    const onOpen = vi.fn();
    const onChange = vi.fn();
    render(
      <ListRow
        leading={<Checkbox aria-label="Hygiene auswählen" checked={false} onChange={onChange} />}
        title="Hygiene"
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByLabelText('Hygiene auswählen'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('nutzt ein eigenes aria-label für die Zeile', () => {
    render(<ListRow title="12.11.2025" ariaLabel="Prüfung vom 12.11.2025 öffnen" onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Prüfung vom 12.11.2025 öffnen' })).toBeInTheDocument();
  });
});
