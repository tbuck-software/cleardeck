/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AdminListPage from '../AdminListPage';

describe('Leistungskatalog-Liste', () => {
  it('zeigt den Status und schaltet eine Leistung ohne den Edit-Dialog zu öffnen', () => {
    const onEdit = vi.fn();
    const onToggleActive = vi.fn();
    render(
      <AdminListPage
        title="Leistungen"
        subtitle="Katalog"
        items={[
          {
            id: 4,
            title: 'Große Grundpflege',
            note: 'Körperbezogene Pflege nach § 36 SGB XI',
            tags: ['aktiv'],
            usage: '1 Zuordnung',
            active: true,
          },
        ]}
        emptyLabel="Keine Leistungen"
        onCreate={vi.fn()}
        onEdit={onEdit}
        onReorder={vi.fn()}
        onToggleActive={onToggleActive}
        toggleActiveLabel={(active) => (active ? 'Deaktivieren' : 'Aktivieren')}
      />,
    );

    expect(screen.getByText('1 Zuordnung')).toBeInTheDocument();
    expect(screen.getByText('Große Grundpflege').closest('.cd-item')).not.toHaveClass(
      'cd-row-departed',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));
    expect(onToggleActive).toHaveBeenCalledWith(4, false);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('blendet deaktivierte Leistungen zurückhaltend ein', () => {
    render(
      <AdminListPage
        title="Leistungen"
        subtitle="Katalog"
        items={[
          {
            id: 4,
            title: 'Alte Leistung',
            tags: ['deaktiviert'],
            usage: '0 aktive Personen',
            active: false,
          },
        ]}
        emptyLabel="Keine Leistungen"
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggleActive={vi.fn()}
        toggleActiveLabel={(active) => (active ? 'Deaktivieren' : 'Aktivieren')}
      />,
    );

    expect(screen.getByText('Alte Leistung').closest('.cd-item')).toHaveClass('cd-row-departed');
    expect(screen.getByRole('button', { name: 'Aktivieren' })).toBeInTheDocument();
  });
});
