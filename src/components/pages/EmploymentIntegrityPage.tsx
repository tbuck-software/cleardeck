import React, { useState } from 'react';
import type { EmploymentIntegrityOverview } from '../../shared/types';
import { employmentFindingCopy } from '../../utils/dashboardTasks';
import { formatDateDE } from '../../utils/dateFormat';
import ListPanel from '../ui/ListPanel';
import ListRow from '../ui/ListRow';
import Segmented from '../ui/Segmented';

type Props = {
  overview: EmploymentIntegrityOverview;
  status: 'loading' | 'ready' | 'error';
  onRefresh: () => void;
  onOpenEmployee: (id: number) => void;
};

const EmploymentIntegrityPage = ({ overview, status, onRefresh, onOpenEmployee }: Props) => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [search, setSearch] = useState('');
  const employeeById = new Map(overview.employees.map((employee) => [employee.id, employee]));
  const periodById = new Map(overview.periods.map((period) => [period.id, period]));
  // The scan emits same-name pairs in both directions for the per-person panel.
  const issues = overview.issues.filter((issue) =>
    issue.kind !== 'same-name' || issue.relatedEmployeeId == null || issue.employeeId < issue.relatedEmployeeId,
  ).sort((a, b) =>
    (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) ||
    (employeeById.get(a.employeeId)?.name ?? '').localeCompare(employeeById.get(b.employeeId)?.name ?? '', 'de'),
  );
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const visible = issues.filter((issue) => {
    const names = [employeeById.get(issue.employeeId)?.name, employeeById.get(issue.relatedEmployeeId ?? -1)?.name];
    return (filter === 'all' || issue.severity === filter) &&
      names.join(' ').toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de'));
  });
  const personLabel = (id: number) => {
    const employee = employeeById.get(id);
    return `${employee?.name ?? 'Unbekannte Person'} · ${employee?.birthDate ? `geb. ${formatDateDE(employee.birthDate)}` : 'Geburtsdatum fehlt'}`;
  };

  return (
    <div className="cd-page cd-medium" style={{ gap: 22 }}>
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>Datenprüfung</h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            Beschäftigungsdaten aller Personen und Jahre, einschließlich ausgeschiedener Personen.
            Einen Fund öffnen, um ihn in der Historie zu prüfen und zu korrigieren.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" disabled={status === 'loading'} onClick={onRefresh}>
          Erneut prüfen
        </button>
      </header>
      {status === 'loading' && <p role="status">Beschäftigungsdaten werden geprüft …</p>}
      {status === 'error' && (
        <p role="alert" className="cd-notice cd-notice-bad">
          Die Datenprüfung konnte nicht geladen werden. Bitte erneut prüfen.
        </p>
      )}
      {status === 'ready' && <>
        <div className="cd-filters">
          <Segmented
            ariaLabel="Art des Fundes"
            wrap
            options={[
              { value: 'all', label: 'Alle', count: issues.length },
              { value: 'error', label: 'Fehler', count: errors },
              { value: 'warning', label: 'Prüfhinweise', count: issues.length - errors },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <input className="input" type="search" aria-label="Person suchen" placeholder="Person suchen …"
            value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <p className="cd-muted" style={{ margin: 0 }}>
          Überschneidungen und vertauschte Datumsgrenzen sind Fehler. Gleiche Namen und auffällige
          Übernahmen sind Prüfhinweise. Aufeinanderfolgende Arbeitszeitstände sind kein Fehler.
        </p>
        <ListPanel>
          {visible.length === 0 && <div className="cd-empty">
            {issues.length === 0
              ? 'Keine Auffälligkeiten in den geprüften Beschäftigungsdaten gefunden. Nicht erfasste oder gelöschte Zeiträume lassen sich damit nicht erkennen.'
              : 'Keine Funde für diese Auswahl.'}
          </div>}
          {visible.map((issue) => {
            const person = employeeById.get(issue.employeeId);
            const other = employeeById.get(issue.relatedEmployeeId ?? -1);
            const copy = employmentFindingCopy(issue.kind, other?.name ?? 'unbekannte Person');
            return <ListRow
              key={`${issue.kind}-${issue.employeeId}-${issue.relatedEmployeeId}-${issue.periodIds.join('-')}`}
              title={`${person?.name ?? 'Unbekannte Person'} · ${copy.label}`}
              subline={<>
                <span style={{ display: 'block' }}>{copy.sub}</span>
                {issue.kind === 'same-name' && <span style={{ display: 'block' }}>
                  {personLabel(issue.employeeId)} / {personLabel(issue.relatedEmployeeId ?? -1)}
                </span>}
                {issue.periodIds.map((id) => {
                  const period = periodById.get(id);
                  return period && <span key={id} style={{ display: 'block' }}>
                    {formatDateDE(period.startDate)} bis {period.endDate ? formatDateDE(period.endDate) : 'offen'}
                    {period.qualification ? ` · ${period.qualification}` : ''}
                  </span>;
                })}
              </>}
              tag={<span className={`tag ${issue.severity === 'error' ? 'tag-bad' : 'tag-accent'}`}>
                {issue.severity === 'error' ? 'Fehler' : 'Prüfhinweis'}
              </span>}
              ariaLabel={`${person?.name ?? 'Unbekannte Person'}: ${copy.label}. In Historie prüfen`}
              onOpen={() => onOpenEmployee(issue.employeeId)}
            />;
          })}
        </ListPanel>
      </>}
    </div>
  );
};

export default EmploymentIntegrityPage;
