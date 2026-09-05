import React from 'react';
import Icon from '../ui/Icon';
import Segmented from '../ui/Segmented';
import { formatDateDE } from '../../utils/dateFormat';
import {
  TEILGRUPPE_SHORT,
  teilgruppeOf,
  visitDue,
} from '../../utils/qpr';
import type { PatientVisit, PatientWithLatestVisit } from '../../shared/types';
import type { TeilgruppeFilter } from '../../types/ui';

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
  const today = new Date().toISOString().slice(0, 10);

  const rows = patients.map((patient) => {
    const group = teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
    const due = visitDue(
      { latestVisitDate: patient.latestVisitDate, admissionDate: patient.admissionDate },
      today,
      visitIntervalDays,
    );
    return { patient, group, due };
  });

  const counts = {
    A: rows.filter((row) => row.group === 'A').length,
    B: rows.filter((row) => row.group === 'B').length,
    C: rows.filter((row) => row.group === 'C').length,
    D: rows.filter((row) => row.patient.hkpCode != null).length,
  };
  const visitsDue = rows.filter((row) => row.due.overdue || row.due.daysUntilDue <= 14).length;
  const actionNeeded = rows.filter((row) => row.patient.latestActionNeeded).length;

  return (
    <div className="cd-page">
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            Patient:innen
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            {patients.length} Personen · {visitsDue} Visiten fällig · {actionNeeded} mit Handlungsbedarf · Gruppen A{' '}
            {counts.A} · B {counts.B} · C {counts.C} · D {counts.D}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          <Icon name="plus" size={16} />
          Patient:in anlegen
        </button>
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
            { value: 'all' as TeilgruppeFilter, label: 'Alle Gruppen' },
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
            <button key={patient.id} type="button" className="cd-item" onClick={() => void onSelect(patient)}>
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
                  {group ? TEILGRUPPE_SHORT[group] : 'Gutachten-Daten fehlen'}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 'none', color: dueColor(due.daysUntilDue) }}>
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
                <th>Name</th>
                <th>Diagnose</th>
                <th>Teilgruppe</th>
                <th>Visiten</th>
                <th>Letzte Visite</th>
                <th>Nächste fällig</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ patient, group, due }) => {
                const trend = (visitTrends[patient.id ?? -1] ?? []).slice(-4);
                return (
                  <tr key={patient.id} className="cd-row" onClick={() => void onSelect(patient)}>
                    <td>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {patient.name}
                        {patient.latestActionNeeded && (
                          <span className="tag tag-accent" style={{ fontSize: 10 }}>
                            Handlungsbedarf
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                        geb. {formatDateDE(patient.birthDate)}
                        {patient.careLevel ? ` · PG ${patient.careLevel}` : ''}
                      </div>
                    </td>
                    <td>{patient.diagnosis || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                            HKP {patient.hkpCode}
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
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: dueColor(due.daysUntilDue) }}>
                      {due.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="cd-muted-13" style={{ margin: 0 }}>
        Teilgruppen der MD-Stichprobe: A Mobilität &amp; Kognition beeinträchtigt · B nur Mobilität · C nur Kognition
        (Gutachten Modul 1/2, ≤ 1 Jahr, sonst eigene Einschätzung) · D zusätzlich bei aufwändiger HKP nach Ziffer 6, 8,
        29 oder 31a. Visiten-Punkte: orange = Handlungsbedarf. Intervall {visitIntervalDays} Tage.
      </p>
    </div>
  );
};

export default PatientList;
