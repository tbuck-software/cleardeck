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
    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));
    expect(onToggleActive).toHaveBeenCalledWith(4, false);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
