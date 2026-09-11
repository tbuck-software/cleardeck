/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import DataTable, { type DataTableColumn, type DataTableProps } from '../DataTable';

type Person = {
  id: number;
  name: string;
  note: string;
  role: string;
  hours: number;
};

const people: Person[] = [
  {
    id: 1,
    name: 'Anna Beispiel',
    note: 'Seit 2022 in leitender Rolle.',
    role: 'Pflege',
    hours: 38,
  },
  {
    id: 2,
    name: 'Bruno Beispiel',
    note: 'Nachtdienst.',
    role: 'Verwaltung',
    hours: 20,
  },
];

type Key = 'name' | 'role' | 'hours' | 'status';

const columns: DataTableColumn<Person, Key>[] = [
  { key: 'role', label: 'Rolle', compact: true, cell: (person) => person.role },
  {
    key: 'hours',
    label: 'Std./Wo.',
    align: 'right',
    cell: (person) => person.hours,
  },
];

const renderTable = (
  overrides: Partial<DataTableProps<Person, Key>> = {},
): ReturnType<typeof render> =>
  render(
    <DataTable<Person, Key>
      rows={people}
      rowKey={(person) => person.id}
      person={{
        key: 'name',
        name: (person) => person.name,
        subline: (person) => person.note,
      }}
      columns={columns}
      status={{
        key: 'status',
        label: 'Status',
        cell: () => <span className="tag tag-accent-2">aktiv</span>,
      }}
      sort={{ key: 'name', dir: 1 }}
      onSort={() => undefined}
      onOpen={() => undefined}
      {...overrides}
    />,
  );

describe('DataTable', () => {
  it('meldet Sortierrichtung und Sortierklick je Spalte', () => {
    const onSort = vi.fn();
    renderTable({ onSort, sort: { key: 'hours', dir: -1 } });

    expect(screen.getByRole('columnheader', { name: 'Std./Wo.' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(screen.getByRole('button', { name: 'Rolle' }));
    expect(onSort).toHaveBeenCalledWith('role');
  });

  it('lässt Spalten ohne Sortierung als reine Kopfzelle stehen', () => {
    renderTable({
      status: {
        key: 'status',
        label: 'Status',
        sortable: false,
        cell: () => null,
      },
    });

    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).not.toHaveAttribute('aria-sort');
  });

  it('öffnet den Datensatz beim Klick irgendwo in der Zeile', () => {
    const onOpen = vi.fn();
    renderTable({ onOpen });

    fireEvent.click(screen.getByText('Bruno Beispiel'));
    expect(onOpen).toHaveBeenCalledWith(people[1]);

    fireEvent.click(screen.getByText('Verwaltung'));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('stellt Person, Fachspalten und Status in fester Reihenfolge dar', () => {
    const { container } = renderTable();

    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.replace(/[↑↓]/g, '').trim());
    expect(headers).toEqual(['Name', 'Rolle', 'Std./Wo.', 'Status']);

    const cells = screen.getByText('Anna Beispiel').closest('tr')!.querySelectorAll('td');
    expect(cells[0].querySelector('.cd-person-sub')).toHaveTextContent(
      'Seit 2022 in leitender Rolle.',
    );
    expect(cells[cells.length - 1].textContent).toBe('aktiv');
    expect(container.querySelector('.cd-listrow-chevron')).toBeNull();
  });

  it('summiert in der Fußzeile ab der ersten Summenspalte', () => {
    renderTable({
      footer: {
        label: 'Summe über 2 Personen',
        cells: { hours: <strong>58</strong> },
      },
    });

    const footerCells = document.querySelectorAll('tfoot td');
    expect(footerCells[0]).toHaveAttribute('colspan', '2');
    expect(footerCells[1].textContent).toBe('58');
    expect(footerCells[2].textContent).toBe('');
  });

  it('baut die kompakte Karte aus denselben Zellen', () => {
    const onOpen = vi.fn();
    renderTable({
      compact: true,
      onOpen,
      compactFooter: <span>2 Personen</span>,
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('2 Personen')).toBeInTheDocument();
    // Nur als kompakt markierte Fachspalten stehen in der Karte.
    expect(screen.getByText('Pflege')).toBeInTheDocument();
    expect(screen.queryByText('38')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Anna Beispiel'));
    expect(onOpen).toHaveBeenCalledWith(people[0]);
  });
});
