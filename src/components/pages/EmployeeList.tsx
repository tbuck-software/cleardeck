import { localDate } from '../../utils/calendarDate';
import React, { useMemo, useState } from 'react';
import Icon, { MoreIcon } from '../ui/Icon';
import Segmented from '../ui/Segmented';
import Avatar from '../ui/Avatar';
import { formatDateDE } from '../../utils/dateFormat';
import type { EmployeeWithPeriod, QualificationType } from '../../shared/types';

type SortKey =
  | 'name'
  | 'qualification'
  | 'startDate'
  | 'endDate'
  | 'weeklyHours'
  | 'fte'
  | 'status';

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Name' },
  { key: 'qualification', label: 'Qualifikation' },
  { key: 'startDate', label: 'Eintritt' },
  { key: 'endDate', label: 'Austritt' },
  { key: 'weeklyHours', label: 'Std./Wo.', align: 'right' },
  { key: 'fte', label: 'VZÄ', align: 'right' },
  { key: 'status', label: 'Status' },
];

const fte2 = (value: number | null | undefined) =>
  value == null ? '—' : value.toFixed(2).replace('.', ',');

/** "leaving" is not a stored status — it is an active person with an end date ahead. */
const statusTag = (employee: EmployeeWithPeriod, today: string): [string, string] => {
  if (employee.status === 'left') return ['tag-neutral', 'ausgeschieden'];
  if (employee.endDate && employee.endDate >= today)
    return ['tag-accent', `Austritt ${formatDateDE(employee.endDate)}`];
  return ['tag-accent-2', 'aktiv'];
};

type EmployeeListProps = {
  year: number;
  years: number[];
  directoryMode?: boolean;
  onDirectoryModeChange?: (value: boolean) => void;
  search: string;
  statusFilter: 'all' | EmployeeWithPeriod['status'];
  qualificationFilter: string;
  qualifications: QualificationType[];
  filteredEmployees: EmployeeWithPeriod[];
  totalFte: number;
  wideTable: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: 'all' | EmployeeWithPeriod['status']) => void;
  onQualificationChange: (value: string) => void;
  onYearChange: (year: number) => void;
  onImport?: () => void;
  onExport: (format: 'csv' | 'xlsx') => void | Promise<void>;
  onOpenReport: () => void;
  onCreate: () => void;
  onSelect: (employee: EmployeeWithPeriod) => void | Promise<void>;
};

const EmployeeList = ({
  year,
  years,
  directoryMode = false,
  onDirectoryModeChange,
  search,
  statusFilter,
  qualificationFilter,
  qualifications,
  filteredEmployees,
  totalFte,
  wideTable,
  onSearchChange,
  onStatusChange,
  onQualificationChange,
  onYearChange,
  onExport,
  onImport,
  onOpenReport,
  onCreate,
  onSelect,
}: EmployeeListProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const today = localDate();

  const rows = useMemo(() => {
    const value = (employee: EmployeeWithPeriod): string | number => {
      switch (sort.key) {
        case 'fte':
          return employee.fte ?? -1;
        case 'weeklyHours':
          return employee.weeklyHours ?? -1;
        case 'startDate':
          return employee.employmentStartDate ?? employee.startDate;
        default:
          return String(employee[sort.key] ?? '');
      }
    };
    return [...filteredEmployees].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'de');
      return cmp * sort.dir;
    });
  }, [filteredEmployees, sort]);

  const totalHours = rows.reduce((sum, employee) => sum + (employee.weeklyHours ?? 0), 0);
  const shownFte = rows.reduce((sum, employee) => sum + (employee.fte ?? 0), 0);

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({ key, dir: current.key === key ? ((current.dir * -1) as 1 | -1) : 1 }));

  return (
    <div className="cd-page">
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            Team
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            {directoryMode
              ? `${filteredEmployees.length} jemals beschäftigte Personen · jeweils letzter erfasster Stand`
              : `${filteredEmployees.length} Personen im Jahr ${year} · ${fte2(totalFte)} VZÄ gesamt`}
          </p>
        </div>
        <div className="cd-actions">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label="Weitere Aktionen"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreIcon />
          </button>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <Icon name="plus" size={16} />
            Person anlegen
          </button>
          {menuOpen && (
            <>
              <div className="cd-menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="cd-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenReport();
                  }}
                >
                  Jahresnachweis erstellen…
                </button>
                {onImport && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onImport();
                    }}
                  >
                    Mitarbeiterliste übernehmen (Excel / CSV)…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void onExport('xlsx');
                  }}
                >
                  Als Excel exportieren
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void onExport('csv');
                  }}
                >
                  Als CSV exportieren
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="cd-filters">
        <div className="cd-search">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Suchen"
            aria-label="Team durchsuchen"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Segmented
          ariaLabel="Status"
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'active', label: 'Aktiv' },
            { value: 'left', label: 'Ausgeschieden' },
          ]}
          value={statusFilter}
          onChange={onStatusChange}
        />
        <select
          className="input cd-select"
          aria-label="Qualifikation"
          value={qualificationFilter}
          onChange={(event) => onQualificationChange(event.target.value)}
        >
          <option value="all">Alle Qualifikationen</option>
          {qualifications.map((qualification) => (
            <option key={qualification.id ?? qualification.name} value={qualification.name}>
              {qualification.name}
            </option>
          ))}
        </select>
        <select
          className="input cd-select"
          aria-label="Jahr"
          value={directoryMode ? 'all' : year}
          onChange={(event) =>
            event.target.value === 'all'
              ? onDirectoryModeChange?.(true)
              : onYearChange(Number(event.target.value))
          }
        >
          {onDirectoryModeChange && <option value="all">Gesamtliste aller Beschäftigten</option>}
          {years.map((value) => (
            <option key={value} value={value}>
              Jahr {value}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 && (
        <div className="cd-panel">
          <div className="cd-empty">Keine Personen gefunden.</div>
        </div>
      )}

      {rows.length > 0 && !wideTable && (
        <div className="cd-panel">
          {rows.map((employee) => {
            const [tagClass, label] = statusTag(employee, today);
            return (
              <button
                key={employee.id}
                type="button"
                className={`cd-item${employee.status === 'left' ? ' cd-row-departed' : ''}`}
                onClick={() => void onSelect(employee)}
              >
                <Avatar name={employee.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{employee.name}</div>
                  <div className="cd-muted-13">
                    {employee.qualification} · {employee.weeklyHours ?? '—'} h · seit{' '}
                    {formatDateDE(employee.employmentStartDate ?? employee.startDate)}
                  </div>
                </div>
                <span style={{ fontWeight: 700, flex: 'none' }}>
                  {employee.hoursMissing ? '—' : fte2(employee.fte)}
                </span>
                <span className={`tag ${tagClass}`} style={{ flex: 'none' }}>
                  {label}
                </span>
              </button>
            );
          })}
          <div className="cd-panel-foot">
            <span>{rows.length} Personen</span>
            <strong>{directoryMode ? 'Letzter Stand je Person' : `${fte2(shownFte)} VZÄ`}</strong>
          </div>
        </div>
      )}

      {rows.length > 0 && wideTable && (
        <div className="cd-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="cd-th"
                    style={{ textAlign: column.align ?? 'left' }}
                    aria-sort={
                      sort.key === column.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'
                    }
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.label}{' '}
                    <span style={{ color: 'var(--color-accent)' }}>
                      {sort.key === column.key ? (sort.dir > 0 ? '↑' : '↓') : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => {
                const [tagClass, label] = statusTag(employee, today);
                const leaving = employee.status === 'active' && employee.endDate;
                return (
                  <tr
                    key={employee.id}
                    className={`cd-row${employee.status === 'left' ? ' cd-row-departed' : ''}`}
                    onClick={() => void onSelect(employee)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={employee.name} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{employee.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                            {employee.note || employee.qualification}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{employee.qualification}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDateDE(employee.employmentStartDate ?? employee.startDate)}
                    </td>
                    <td
                      style={{
                        whiteSpace: 'nowrap',
                        color: leaving ? 'var(--color-accent-700)' : 'inherit',
                      }}
                    >
                      {employee.endDate ? formatDateDE(employee.endDate) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{employee.weeklyHours ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {employee.hoursMissing ? '—' : fte2(employee.fte)}
                    </td>
                    <td>
                      <span className={`tag ${tagClass}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!directoryMode && (
              <tfoot>
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: '14px 8px', fontSize: 13, color: 'var(--color-neutral-700)' }}
                  >
                    Summe über {rows.length} Personen
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{totalHours || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fte2(shownFte)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
