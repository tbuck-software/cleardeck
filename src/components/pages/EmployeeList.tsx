import { annualFteLabel, type AnnualFteMethod } from '../../shared/annualFte';
import { localDate } from '../../utils/calendarDate';
import React, { useMemo, useState } from 'react';
import Icon, { MoreIcon } from '../ui/Icon';
import Segmented from '../ui/Segmented';
import ActionMenu from '../ui/ActionMenu';
import DataTable, { type DataTableColumn } from '../ui/DataTable';
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
  annualFteMethod?: AnnualFteMethod;
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
  annualFteMethod,
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
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const today = localDate();

  const rows = useMemo(() => {
    const value = (employee: EmployeeWithPeriod): string | number => {
      switch (sort.key) {
        case 'fte':
          return (directoryMode ? employee.fte : employee.annualFte ?? employee.fte) ?? -1;
        case 'weeklyHours':
          return employee.weeklyHours ?? -1;
        case 'startDate':
          return employee.employmentStartDate;
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
  }, [filteredEmployees, sort, directoryMode]);

  const columns: DataTableColumn<EmployeeWithPeriod, SortKey>[] = [
    {
      key: 'qualification',
      label: 'Qualifikation',
      compact: true,
      cell: (employee) => <span title={directoryMode ? undefined : "Letzter Stand im Jahr"}>{employee.qualification}</span>,
    },
    {
      key: 'startDate',
      label: 'Eintritt',
      nowrap: true,
      cell: (employee) => formatDateDE(employee.employmentStartDate),
    },
    {
      key: 'endDate',
      label: 'Austritt',
      nowrap: true,
      cell: (employee) =>
        employee.endDate ? (
          <span
            style={{
              color: employee.status === 'active' ? 'var(--color-accent-700)' : 'inherit',
            }}
          >
            {formatDateDE(employee.endDate)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'weeklyHours',
      label: 'Std./Wo.',
      align: 'right',
      cell: (employee) => <span title={directoryMode ? undefined : "Letzter Stand im Jahr"}>{employee.weeklyHours ?? '—'}</span>,
    },
    {
      key: 'fte',
      label: directoryMode ? 'VZÄ' : 'Jahres-VZÄ',
      align: 'right',
      compact: true,
      cell: (employee) => {
        const missing = directoryMode ? employee.hoursMissing : employee.annualFteMissing ?? employee.hoursMissing;
        const value = directoryMode ? employee.fte : employee.annualFte ?? employee.fte;
        return <strong title={missing ? 'Unvollständig: Stellenanteile fehlen im Jahresverlauf.' : undefined}>{missing ? '—' : fte2(value)}</strong>;
      },
    },
  ];

  const totalHours = rows.reduce((sum, employee) => sum + (employee.weeklyHours ?? 0), 0);
  const shownFte = rows.reduce((sum, employee) => sum + ((directoryMode ? employee.fte : employee.annualFte ?? employee.fte) ?? 0), 0);

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
              : `${filteredEmployees.length} Personen im Jahr ${year} · ${fte2(totalFte)} Jahres-VZÄ gesamt`}
          </p>
          {!directoryMode && annualFteMethod && (
            <p className="cd-muted-13" style={{ margin: '6px 0 0' }}>
              {annualFteLabel(annualFteMethod)}
              {filteredEmployees.some(e => e.annualFteMissing || e.annualFteVerified === false) &&
                ' · Vorläufig: Stellenanteile fehlen oder sind unbestätigt.'}
            </p>
          )}
        </div>
        <div className="cd-actions">
          <ActionMenu
            ariaLabel="Weitere Aktionen"
            triggerClassName="btn btn-secondary btn-icon"
            items={[
              { label: 'Jahresnachweis erstellen…', onSelect: onOpenReport },
              ...(onImport
                ? [{ label: 'Mitarbeiterliste übernehmen (Excel / CSV)…', onSelect: onImport }]
                : []),
              { label: 'Als Excel exportieren', onSelect: () => void onExport('xlsx') },
              { label: 'Als CSV exportieren', onSelect: () => void onExport('csv') },
            ]}
          >
            <MoreIcon />
          </ActionMenu>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <Icon name="plus" size={16} />
            Person anlegen
          </button>
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

      {rows.length > 0 && (
        <DataTable<EmployeeWithPeriod, SortKey>
          rows={rows}
          rowKey={(employee) => employee.id ?? employee.name}
          rowClassName={(employee) => (employee.status === 'left' ? 'cd-row-departed' : undefined)}
          person={{
            key: 'name',
            name: (employee) => employee.name,
            subline: (employee) => employee.note,
          }}
          columns={columns}
          status={{
            key: 'status',
            label: 'Status',
            cell: (employee) => {
              const [tagClass, label] = statusTag(employee, today);
              return <span className={`tag ${tagClass}`}>{label}</span>;
            },
          }}
          sort={sort}
          onSort={toggleSort}
          onOpen={(employee) => void onSelect(employee)}
          compact={!wideTable}
          footer={
            directoryMode
              ? undefined
              : {
                  label: `Summe über ${rows.length} Personen`,
                  cells: {
                    weeklyHours: <strong>{totalHours || '—'}</strong>,
                    fte: <strong>{fte2(shownFte)}</strong>,
                  },
                }
          }
          compactFooter={
            <>
              <span>{rows.length} Personen</span>
              <strong>{directoryMode ? 'Letzter Stand je Person' : `${fte2(shownFte)} Jahres-VZÄ`}</strong>
            </>
          }
        />
      )}
    </div>
  );
};

export default EmployeeList;
