/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AdminListPage from '../AdminListPage';

const renderPage = (
  overrides: Partial<React.ComponentProps<typeof AdminListPage>> = {},
): ReturnType<typeof render> =>
  render(
    <AdminListPage
      title="Leistungen"
      subtitle="Katalog"
      items={[
        {
          id: 4,
          title: 'Große Grundpflege',
          note: 'Körperbezogene Pflege nach § 36 SGB XI',
          tags: [],
          usage: '1 aktive Person',
          active: true,
        },
      ]}
      emptyLabel="Keine Leistungen"
      onCreate={vi.fn()}
      onEdit={vi.fn()}
      onReorder={vi.fn()}
      {...overrides}
    />,
  );

describe('Katalogliste der Verwaltung', () => {
  it('zeigt Titel, Unterzeile und Zähler in einer Listenzeile', () => {
    renderPage();

    const row = screen.getByText('Große Grundpflege').closest('.cd-listrow') as HTMLElement;
    expect(row).toHaveTextContent('Körperbezogene Pflege nach § 36 SGB XI');
    expect(row).toHaveTextContent('1 aktive Person');
    expect(row.querySelector('.cd-listrow-chevron')).not.toBeNull();
  });

  it('öffnet den Bearbeitungsdialog über die ganze Zeile', () => {
    const onEdit = vi.fn();
    renderPage({ onEdit });

    fireEvent.click(screen.getByRole('button', { name: 'Große Grundpflege bearbeiten' }));
    expect(onEdit).toHaveBeenCalledWith(4);
  });

  it('führt keine Aktionen in der Zeile, die in den Dialog gehören', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: 'Deaktivieren' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zuordnen' })).not.toBeInTheDocument();
  });

  it('blendet deaktivierte Einträge zurückhaltend ein und behält den Status-Tag', () => {
    renderPage({
      items: [
        {
          id: 4,
          title: 'Alte Leistung',
          tags: ['deaktiviert'],
          usage: '0 aktive Personen',
          active: false,
        },
      ],
    });

    expect(screen.getByText('Alte Leistung').closest('.cd-listrow')).toHaveClass('cd-row-departed');
    expect(screen.getByText('deaktiviert')).toBeInTheDocument();
  });

  it('sortiert per Ziehen auf eine andere Zeile', () => {
    const onReorder = vi.fn();
    const { container } = renderPage({
      items: [
        { id: 1, title: 'Erste', tags: [], usage: '0 zugeordnet' },
        { id: 2, title: 'Zweite', tags: [], usage: '0 zugeordnet' },
      ],
      onReorder,
    });
    const rows = container.querySelectorAll('.cd-listrow');

    fireEvent.dragStart(rows[1]);
    fireEvent.drop(rows[0]);

    expect(onReorder).toHaveBeenCalledWith(2, 0);
  });

  it('zeigt den leeren Zustand', () => {
    renderPage({ items: [] });

    expect(screen.getByText('Keine Leistungen')).toBeInTheDocument();
  });
});
