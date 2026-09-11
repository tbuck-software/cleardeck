import React from 'react';
import Avatar from './Avatar';

export type DataTableColumn<Row, Key extends string = string> = {
  key: Key;
  label: string;
  align?: 'right';
  nowrap?: boolean;
  /** Kopfzelle ohne Sortierung. */
  sortable?: boolean;
  /** Erklärung an der Kopfzelle, wenn die Sortierung nicht offensichtlich ist. */
  title?: string;
  /** Auch in der kompakten Karte sichtbar. */
  compact?: boolean;
  cell: (row: Row) => React.ReactNode;
};

export type DataTableSort<Key extends string> = { key: Key; dir: 1 | -1 };

export type DataTableProps<Row, Key extends string> = {
  rows: Row[];
  rowKey: (row: Row) => React.Key;
  rowClassName?: (row: Row) => string | undefined;
  /** Erste Spalte: Avatar mit Initialen, Name und einzeilige Unterzeile. */
  person: {
    key: Key;
    label?: string;
    name: (row: Row) => string;
    subline?: (row: Row) => React.ReactNode;
  };
  /** Fachspalten zwischen Person und Status. */
  columns: DataTableColumn<Row, Key>[];
  /** Letzte Spalte: Status und Kennzeichen der Zeile. */
  status: {
    key: Key;
    label?: string;
    sortable?: boolean;
    cell: (row: Row) => React.ReactNode;
  };
  sort: DataTableSort<Key>;
  onSort: (key: Key) => void;
  onOpen: (row: Row) => void;
  /** Schmale Fenster zeigen dieselben Zellen als Karten. */
  compact?: boolean;
  /** Summenzeile; die Beschriftung füllt die Spalten bis zur ersten Summe. */
  footer?: {
    label: React.ReactNode;
    cells: Partial<Record<Key, React.ReactNode>>;
  };
  /** Fußzeile der kompakten Kartenliste. */
  compactFooter?: React.ReactNode;
};

const DataTable = <Row, Key extends string>({
  rows,
  rowKey,
  rowClassName,
  person,
  columns,
  status,
  sort,
  onSort,
  onOpen,
  compact = false,
  footer,
  compactFooter,
}: DataTableProps<Row, Key>) => {
  const head = (
    key: Key,
    label: string,
    options: { align?: 'right'; sortable?: boolean; title?: string } = {},
  ) => {
    const sortable = options.sortable !== false;
    const active = sort.key === key;
    return (
      <th
        key={key}
        className="cd-th"
        style={{ textAlign: options.align ?? 'left' }}
        aria-sort={
          sortable ? (active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none') : undefined
        }
      >
        {sortable ? (
          <button
            type="button"
            className="cd-sort-button"
            title={options.title}
            onClick={() => onSort(key)}
          >
            {label}{' '}
            <span aria-hidden="true" className="cd-sort-mark">
              {active ? (sort.dir === 1 ? '↑' : '↓') : ''}
            </span>
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  const personCell = (row: Row) => {
    const name = person.name(row);
    const subline = person.subline?.(row);
    return (
      <span className="cd-person">
        <Avatar name={name} />
        <span className="cd-person-copy">
          <span className="cd-person-name">{name}</span>
          {subline != null && subline !== '' && <span className="cd-person-sub">{subline}</span>}
        </span>
      </span>
    );
  };

  if (compact) {
    const metaColumns = columns.filter((column) => column.compact);
    return (
      <div className="cd-list">
        {rows.map((row) => (
          <button
            key={rowKey(row)}
            type="button"
            className={`cd-data-card${rowClassName?.(row) ? ` ${rowClassName(row)}` : ''}`}
            onClick={() => onOpen(row)}
          >
            {personCell(row)}
            {metaColumns.length > 0 && (
              <span className="cd-data-card-meta">
                {metaColumns.map((column) => (
                  <span key={column.key}>{column.cell(row)}</span>
                ))}
              </span>
            )}
            <span className="cd-data-card-tag">{status.cell(row)}</span>
          </button>
        ))}
        {compactFooter != null && <div className="cd-panel-foot">{compactFooter}</div>}
      </div>
    );
  }

  // Die Beschriftung der Summenzeile reicht bis zur ersten Spalte mit Summe.
  const firstSum = footer ? columns.findIndex((column) => footer.cells[column.key] != null) : -1;
  const summed = firstSum < 0 ? [] : columns.slice(firstSum);

  return (
    <div className="cd-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            {head(person.key, person.label ?? 'Name')}
            {columns.map((column) =>
              head(column.key, column.label, {
                align: column.align,
                sortable: column.sortable,
                title: column.title,
              }),
            )}
            {head(status.key, status.label ?? 'Status', {
              sortable: status.sortable,
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={`cd-row${rowClassName?.(row) ? ` ${rowClassName(row)}` : ''}`}
              onClick={() => onOpen(row)}
            >
              <td>{personCell(row)}</td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    textAlign: column.align ?? 'left',
                    whiteSpace: column.nowrap ? 'nowrap' : undefined,
                  }}
                >
                  {column.cell(row)}
                </td>
              ))}
              <td>{status.cell(row)}</td>
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot className="cd-table-foot">
            <tr>
              <td colSpan={1 + (firstSum < 0 ? columns.length : firstSum)}>{footer.label}</td>
              {summed.map((column) => (
                <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                  {footer.cells[column.key]}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default DataTable;
