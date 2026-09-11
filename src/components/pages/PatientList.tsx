import HelpPopover from '../ui/HelpPopover';
import { localDate, validDate } from '../../utils/calendarDate';
import React, { useMemo, useState } from 'react';
import Icon from '../ui/Icon';
import Segmented from '../ui/Segmented';
import { formatDateDE } from '../../utils/dateFormat';
import {
  TEILGRUPPE_SHORT,
  teilgruppeOf,
  hkpCodesOf,
  needsAssessment,
  visitDue,
} from '../../utils/qpr';
import type { PatientVisit, PatientWithLatestVisit } from '../../shared/types';
import type { TeilgruppeFilter } from '../../types/ui';
import { careLevelLabel } from '../../utils/careLevel';

type SortKey = 'name' | 'diagnosis' | 'group' | 'visits' | 'latest' | 'due';
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'diagnosis', label: 'Diagnose' },
  { key: 'group', label: 'Teilgruppe' },
  { key: 'visits', label: 'Visiten' },
  { key: 'latest', label: 'Letzte Visite' },
  { key: 'due', label: 'Nächste fällig' },
];
const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

export const dueColor = (daysUntilDue: number): string =>
  daysUntilDue < 0
    ? 'var(--bad-800)'
    : daysUntilDue <= 14
      ? 'var(--color-accent-700)'
      : 'var(--color-neutral-700)';

type PatientListProps = {
  search: string;
  groupFilter: TeilgruppeFilter;
  patients: PatientWithLatestVisit[];
  /** Recent visits per patient, newest last — drives the little trend bars. */
  visitTrends: Record<number, PatientVisit[]>;
  visitIntervalDays: number;
  wideTable: boolean;
  onSearchChange: (value: string) => void;
  onGroupChange: (value: TeilgruppeFilter) => void;
  onCreate: () => void;
  onSelect: (patient: PatientWithLatestVisit) => void | Promise<void>;
};

const PatientList = ({
  search,
  groupFilter,
  patients,
  visitTrends,
  visitIntervalDays,
  wideTable,
  onSearchChange,
  onGroupChange,
  onCreate,
  onSelect,
}: PatientListProps) => {
  const today = localDate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });

  const rows = useMemo(
    () =>
      patients
        .map((patient) => {
          const group = needsAssessment(patient, today)
            ? null
            : teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
          const due = visitDue(
            { latestVisitDate: patient.latestVisitDate, admissionDate: patient.admissionDate },
            today,
            visitIntervalDays,
          );
          const dateValue = (value?: string | null) => (value && validDate(value) ? value : null);
          const values: Record<SortKey, string | number | null> = {
            name: patient.name.trim() || null,
            diagnosis: patient.diagnosis?.trim() || null,
            group,
            visits: patient.visitCount ?? visitTrends[patient.id ?? -1]?.length ?? null,
            latest: dateValue(patient.latestVisitDate),
            due: dateValue(due.dueDate),
          };
          return { patient, group, due, value: values[sort.key] };
        })
        .sort((a, b) => {
          // Missing values stay last in both directions; ties keep a stable name order.
          if (a.value == null && b.value != null) return 1;
          if (a.value != null && b.value == null) return -1;
          const compared =
            a.value == null || b.value == null
              ? 0
              : typeof a.value === 'number' && typeof b.value === 'number'
                ? a.value - b.value
                : collator.compare(String(a.value), String(b.value));
          return (
            compared * sort.dir ||
            collator.compare(a.patient.name, b.patient.name) ||
            (a.patient.id ?? 0) - (b.patient.id ?? 0)
          );
        }),
    [patients, visitTrends, today, visitIntervalDays, sort],
  );

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({ key, dir: current.key === key && current.dir === 1 ? -1 : 1 }));

  const counts = {
    A: rows.filter((row) => row.group === 'A').length,
    B: rows.filter((row) => row.group === 'B').length,
    C: rows.filter((row) => row.group === 'C').length,
    D: rows.filter((row) => row.patient.hkpCode != null).length,
  };
  const visitsDue = rows.filter(
    (row) => !row.due.missingAnchor && (row.due.overdue || row.due.daysUntilDue <= 14),
  ).length;
  const actionNeeded = rows.filter((row) => row.patient.latestActionNeeded).length;

  return (
    <div className="cd-page">
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            Patient:innen
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            {patients.length} Personen · {visitsDue} Visiten fällig · {actionNeeded} mit
            Handlungsbedarf · Gruppen A {counts.A} · B {counts.B} · C {counts.C} · D {counts.D}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HelpPopover
            heading="Patient:innen"
            entries={[
              {
                title: 'Teilgruppen der MD-Stichprobe',
                body: 'A Mobilität & Kognition beeinträchtigt · B nur Mobilität · C nur Kognition (Gutachten Modul 1/2, ≤ 1 Jahr, sonst eigene Einschätzung) · D zusätzlich bei aufwändiger HKP nach Ziffer 6, 8, 29 oder 31a.',
              },
              {
                title: 'Visiten',
                body: `Orange markierte Punkte stehen für Handlungsbedarf. Das Visitenintervall beträgt ${visitIntervalDays} Tage.`,
              },
            ]}
          />
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <Icon name="plus" size={16} />
            Patient:in anlegen
          </button>
        </div>
      </header>

      <div className="cd-filters">
        <div className="cd-search">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Suchen"
            aria-label="Patient:innen durchsuchen"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Segmented
          ariaLabel="Teilgruppe"
          options={[
            { value: 'all' as TeilgruppeFilter, label: 'Aktive' },
            { value: 'archived' as TeilgruppeFilter, label: 'Archiv' },
            { value: 'A' as TeilgruppeFilter, label: 'A' },
            { value: 'B' as TeilgruppeFilter, label: 'B' },
            { value: 'C' as TeilgruppeFilter, label: 'C' },
            { value: 'D' as TeilgruppeFilter, label: 'D' },
          ]}
          value={groupFilter}
          onChange={onGroupChange}
        />
      </div>

      {rows.length === 0 && (
        <div className="cd-panel">
          <div className="cd-empty">Keine Patient:innen gefunden.</div>
        </div>
      )}

      {rows.length > 0 && !wideTable && (
        <div className="cd-panel">
          {rows.map(({ patient, group, due }) => (
            <button
              key={patient.id}
              type="button"
              className="cd-item"
              onClick={() => void onSelect(patient)}
            >
              <span
                className={`tag ${group ? 'tag-accent-2' : 'tag-neutral'}`}
                style={{ flex: 'none', fontWeight: 700, width: 34, justifyContent: 'center' }}
              >
                {group && group !== 'none' ? group : '–'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{patient.name}</div>
                <div className="cd-muted-13">
                  {patient.diagnosis || 'Ohne Diagnose'} ·{' '}
                  {group ? TEILGRUPPE_SHORT[group] : 'Gutachten-Daten fehlen'} ·{' '}
                  {careLevelLabel(patient.careLevel)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  flex: 'none',
                  color: dueColor(due.daysUntilDue),
                }}
              >
                {due.label}
              </span>
            </button>
          ))}
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
                    aria-sort={
                      sort.key === column.key
                        ? sort.dir === 1
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="cd-sort-button"
                      onClick={() => toggleSort(column.key)}
                      title={
                        column.key === 'visits'
                          ? 'Nach Anzahl erfasster Visiten sortieren'
                          : undefined
                      }
                    >
                      {column.label}{' '}
                      <span aria-hidden="true" style={{ color: 'var(--color-accent)' }}>
                        {sort.key === column.key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ patient, group, due }) => {
                const trend = (visitTrends[patient.id ?? -1] ?? []).slice(-4);
                return (
                  <tr key={patient.id} className="cd-row" onClick={() => void onSelect(patient)}>
                    <td>
                      <div
                        style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        {patient.name}
                        {patient.latestActionNeeded && (
                          <span className="tag tag-accent" style={{ fontSize: 10 }}>
                            Handlungsbedarf
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                        geb. {formatDateDE(patient.birthDate)}
                        {` · ${careLevelLabel(patient.careLevel)}`}
                      </div>
                    </td>
                    <td>{patient.diagnosis || '—'}</td>
                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        <span
                          className={`tag ${group ? 'tag-accent-2' : 'tag-neutral'}`}
                          style={{ fontWeight: 700 }}
                        >
                          {group && group !== 'none' ? group : '–'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                          {group ? TEILGRUPPE_SHORT[group] : 'Gutachten-Daten fehlen'}
                        </span>
                        {patient.hkpCode && (
                          <span className="tag tag-accent" style={{ fontSize: 10 }}>
                            HKP {hkpCodesOf(patient).join(', ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {trend.map((visit) => (
                          <span
                            key={visit.id}
                            title={`${formatDateDE(visit.visitDate)}${visit.actionNeeded ? ' · Handlungsbedarf' : ''}`}
                            className="cd-trend-bar"
                            style={{
                              background: visit.actionNeeded
                                ? 'var(--color-accent-500)'
                                : 'var(--color-accent-2-300)',
                            }}
                          />
                        ))}
                        {trend.length === 0 && <span className="cd-muted-13">—</span>}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {patient.latestVisitDate ? formatDateDE(patient.latestVisitDate) : 'keine'}
                    </td>
                    <td
                      style={{
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        color: dueColor(due.daysUntilDue),
                      }}
                    >
                      {due.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PatientList;
