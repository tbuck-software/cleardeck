import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen,
  faPlus,
  faGraduationCap,
  faClock,
  faChartPie,
  faUserTag,
  faArrowRightToBracket,
  faArrowRightFromBracket,
  faSignature,
  faStickyNote,
  faStethoscope,
  faKitMedical,
  faCalendarDay,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type {
  EmployeeCompetency,
  EmployeeEvent,
  EmployeeEventType,
  EmployeeInstruction,
  EmployeeWithPeriod,
  EmploymentPeriod,
} from '../../shared/types';
import type { TimelineItem } from '../../types/ui';
import { fteHelp } from '../../constants';
import Badge from '../ui/Badge';
import { formatDateDE } from '../../utils/dateFormat';

type EmployeeDetailProps = {
  employee: EmployeeWithPeriod;
  employeeCompetencies: EmployeeCompetency[];
  employeeInstructions: EmployeeInstruction[];
  canAddCompetency: boolean;
  canAddInstruction: boolean;
  suggestedCompetencyCount: number;
  displayStart: string;
  timelineItems: TimelineItem[];
  onAddCompetency: () => void;
  onAddInstruction: () => void;
  onAddSuggestedCompetencies: () => void;
  onOpenEditModal: () => void;
  onStartNewPeriod: () => void;
  onSelectCompetency: (entry: EmployeeCompetency) => void;
  onSelectInstruction: (entry: EmployeeInstruction) => void;
  onSelectPeriod: (period: EmploymentPeriod) => void;
  onSelectEvent: (event: EmployeeEvent) => void;
};

type DiffLine = { text: string; kind: 'del' | 'add' | 'same' };

const typeLabels: Record<EmployeeEventType, string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'fte-change': 'VZÄ-Änderung',
  'weekly-hours-change': 'Wochenstundenänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
};

const typeIcons: Record<EmployeeEventType, IconDefinition> = {
  join: faArrowRightToBracket,
  leave: faArrowRightFromBracket,
  'name-change': faSignature,
  'note-change': faStickyNote,
  'fte-change': faChartPie,
  'weekly-hours-change': faClock,
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
};

const competencyLevelLabels: Record<number, string> = {
  1: '1 - Unterwiesen',
  2: '2 - Beobachtet',
  3: '3 - Unter Aufsicht',
  4: '4 - Selbstständig',
  5: '5 - Kann anleiten',
};

const formatCompetencyLevel = (level?: number | null): string =>
  level ? competencyLevelLabels[level] ?? `Stufe ${level}` : 'Noch offen';

const buildNoteDiff = (prev: string, next: string): DiffLine[] => {
  const left = prev.split('\n');
  const right = next.split('\n');
  const max = Math.max(left.length, right.length);
  const rows: DiffLine[] = [];
  for (let i = 0; i < max; i += 1) {
    const a = left[i] ?? '';
    const b = right[i] ?? '';
    if (a === b) {
      if (a.trim().length > 0) {
        rows.push({ text: a, kind: 'same' });
      }
    } else {
      if (a) rows.push({ text: a, kind: 'del' });
      if (b) rows.push({ text: b, kind: 'add' });
    }
  }
  return rows.length > 0 ? rows : [{ text: 'Keine Änderungen', kind: 'same' }];
};

const EmployeeDetail = ({
  employee,
  employeeCompetencies,
  employeeInstructions,
  canAddCompetency,
  canAddInstruction,
  suggestedCompetencyCount,
  displayStart,
  timelineItems,
  onAddCompetency,
  onAddInstruction,
  onAddSuggestedCompetencies,
  onOpenEditModal,
  onStartNewPeriod,
  onSelectCompetency,
  onSelectInstruction,
  onSelectPeriod,
  onSelectEvent,
}: EmployeeDetailProps) => {
  const handleOpenEditModal = () => onOpenEditModal();

  const handleEnterSpace = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenEditModal();
    }
  };

  return (
    <div className="stack">
    <div className="card detail-header">
      <div className="detail-main">
        <div
          role="button"
          tabIndex={0}
          className="detail-name-block"
          onClick={handleOpenEditModal}
          onKeyDown={handleEnterSpace}
          title="Name und Notiz bearbeiten"
        >
          <div className="detail-name-content">
            <h2>{employee.name}</h2>
            <div className="note-inline">
              {employee.note && employee.note.trim().length > 0 ? (
                <span className="note-text-inline">{employee.note}</span>
              ) : (
                <span className="muted">Notiz hinzufügen</span>
              )}
            </div>
          </div>
          <div className="detail-edit-icon">
            <FontAwesomeIcon icon={faPen} />
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item" title="Qualifikation">
            <div className="detail-icon">
              <FontAwesomeIcon icon={faGraduationCap} />
            </div>
            <div className="detail-content">
              <span className="detail-label">Qualifikation</span>
              <span className="detail-value">{employee.qualification}</span>
            </div>
          </div>

          <button
            type="button"
            className="detail-item clickable"
            onClick={handleOpenEditModal}
            onKeyDown={handleEnterSpace}
            title="Wochenstunden bearbeiten"
          >
            <div className="detail-icon">
              <FontAwesomeIcon icon={faClock} />
            </div>
            <div className="detail-content">
              <span className="detail-label">Stunden</span>
              <span className="detail-value">
                {employee.weeklyHours !== null && employee.weeklyHours !== undefined
                  ? `${employee.weeklyHours} h`
                  : '—'}
              </span>
            </div>
          </button>

          <button
            type="button"
            className="detail-item clickable"
            onClick={handleOpenEditModal}
            onKeyDown={handleEnterSpace}
            title="VZÄ bearbeiten"
          >
            <div className="detail-icon">
              <FontAwesomeIcon icon={faChartPie} />
            </div>
            <div className="detail-content">
              <span className="detail-label">
                <abbr className="help" title={fteHelp}>
                  VZÄ
                </abbr>
              </span>
              <span className="detail-value">{employee.fte.toFixed(2)}</span>
            </div>
          </button>

          <div className="detail-item">
            <div className="detail-icon">
              <FontAwesomeIcon icon={faUserTag} />
            </div>
            <div className="detail-content">
              <span className="detail-label">Status</span>
              <div className="detail-value">
                <Badge status={employee.status} />
              </div>
            </div>
          </div>

        </div>

        <div className="detail-footer">
          <span className="muted">
            Im Unternehmen seit: {formatDateDE(displayStart)}{' '}
            {employee.endDate ? `– ausgetreten: ${formatDateDE(employee.endDate)}` : '– heute'}
          </span>
        </div>
      </div>
    </div>

    <div className="card">
      <div className="form-header">
        <div>
          <h3>Kompetenzen</h3>
          <p className="subtitle small">Kompetenzmatrix mit Stufe, Relevanz und fachlicher Freigabe.</p>
        </div>
        <div className="detail-actions">
          {suggestedCompetencyCount > 0 && (
            <button className="ghost-button" onClick={onAddSuggestedCompetencies}>
              <FontAwesomeIcon icon={faPlus} /> {suggestedCompetencyCount} passend zur Qualifikation
            </button>
          )}
          <button className="primary" onClick={onAddCompetency} disabled={!canAddCompetency}>
            <FontAwesomeIcon icon={faPlus} /> Kompetenz hinzufügen
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Kürzel</th>
              <th>Kompetenz</th>
              <th>Kategorie</th>
              <th>Relevanz</th>
              <th>Stufe</th>
              <th>Freigegeben am</th>
              <th>Freigegeben durch</th>
              <th>Notiz</th>
            </tr>
          </thead>
          <tbody>
            {employeeCompetencies.map((entry) => (
              <tr
                key={`${entry.competencyDefinitionId}-${entry.id ?? 'new'}`}
                className="clickable-row"
                onClick={() => onSelectCompetency(entry)}
              >
                <td>{entry.competencyCode ?? '—'}</td>
                <td>{entry.competencyName}</td>
                <td>{entry.category ?? 'Allgemein'}</td>
                <td>{entry.relevance ?? 'Alle'}</td>
                <td>{formatCompetencyLevel(entry.level)}</td>
                <td>{entry.approvedAt ? formatDateDE(entry.approvedAt) : '—'}</td>
                <td>{entry.approvedBy ?? '—'}</td>
                <td className="muted">{entry.note ?? entry.definitionNote ?? '—'}</td>
              </tr>
            ))}
            {employeeCompetencies.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  Noch keine Kompetenzen zugeordnet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="card">
      <div className="form-header">
        <div>
          <h3>Einweisungen</h3>
          <p className="subtitle small">Unterweisungen, Pflichtfortbildungen und interne Einweisungen pro Teammitglied.</p>
        </div>
        <div className="detail-actions">
          <button className="primary" onClick={onAddInstruction} disabled={!canAddInstruction}>
            <FontAwesomeIcon icon={faPlus} /> Einweisung hinzufügen
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Thema</th>
              <th>Grundlage</th>
              <th>Fällig bis</th>
              <th>Durchgeführt am</th>
              <th>Durchgeführt durch</th>
              <th>Notiz</th>
            </tr>
          </thead>
          <tbody>
            {employeeInstructions.map((entry) => (
              <tr
                key={`${entry.instructionDefinitionId}-${entry.id ?? 'new'}`}
                className="clickable-row"
                onClick={() => onSelectInstruction(entry)}
              >
                <td>{entry.instructionName}</td>
                <td>{entry.legalBasis ?? '—'}</td>
                <td>{entry.dueDate ? formatDateDE(entry.dueDate) : '—'}</td>
                <td>{entry.completedAt ? formatDateDE(entry.completedAt) : '—'}</td>
                <td>{entry.conductedBy ?? '—'}</td>
                <td className="muted">{entry.note ?? '—'}</td>
              </tr>
            ))}
            {employeeInstructions.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Noch keine Einweisungen zugeordnet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="card">
      <div className="form-header">
        <h3>Historie</h3>
        <div className="detail-actions">
          <button
            className="primary"
            onClick={() => {
              onStartNewPeriod();
            }}
          >
            <FontAwesomeIcon icon={faPlus} /> Neuer Eintrag
          </button>
        </div>
      </div>
      <div className="timeline">
        {timelineItems.map((item) => {
          if (item.kind === 'period') {
            const p = item.record;
            return (
              <button
                className="timeline-item"
                key={`p-${p.id ?? `${p.startDate}-${p.endDate}`}`}
                onClick={() => onSelectPeriod(p)}
              >
                <div className="timeline-dot period-dot">
                  <FontAwesomeIcon icon={faGraduationCap} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-title">{p.qualification ?? employee.qualification}</span>
                    <span className="timeline-date">{formatDateDE(p.startDate)} – {p.endDate ? formatDateDE(p.endDate) : 'aktuell'}</span>
                  </div>
                  {p.note && <div className="timeline-note muted">{p.note}</div>}
                </div>
              </button>
            );
          }
          const ev = item.record;
          const prevFallback =
            ev.previousValue ?? (ev.meta && (ev.meta as any).from ? String((ev.meta as any).from) : undefined);
          const newFallback =
            ev.newValue ?? (ev.meta && (ev.meta as any).to ? String((ev.meta as any).to) : undefined);
          const hasDiffValues = prevFallback !== undefined || newFallback !== undefined;
          const detail =
            (ev.type === 'name-change' ||
              ev.type === 'fte-change' ||
              ev.type === 'weekly-hours-change') &&
            (prevFallback || newFallback)
              ? `${prevFallback ?? ''} → ${newFallback ?? ''}`
              : ev.details;
          const isDiff = ev.type === 'note-change' && hasDiffValues;
          const prevVal = prevFallback ?? '';
          const newVal = newFallback ?? '';
          const diffLines = isDiff ? buildNoteDiff(prevVal, newVal) : [];
          const evType = ev.type as EmployeeEventType;
          return (
            <button
              className="timeline-item event"
              key={`e-${ev.id ?? `${ev.eventDate}-${ev.title}`}`}
              onClick={() => onSelectEvent(ev)}
            >
              <div className={`timeline-dot event-dot event-${ev.type}`}>
                <FontAwesomeIcon icon={typeIcons[evType]} />
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-title">{typeLabels[evType]}</span>
                  <span className="timeline-date">{formatDateDE(ev.eventDate)}</span>
                </div>
                {detail && !isDiff && <div className="timeline-note muted">{detail}</div>}
                {isDiff && (
                  <pre className="diff-text">
                    {diffLines.map((line, idx) => (
                      <span
                        key={`${line.text}-${idx}`}
                        className={`diff-line ${line.kind === 'del' ? 'diff-del' : ''} ${line.kind === 'add' ? 'diff-add' : ''} ${line.kind === 'same' ? 'diff-same' : ''}`}
                      >
                        {line.kind === 'del' ? `-${line.text}` : line.kind === 'add' ? `+${line.text}` : line.text}
                      </span>
                    ))}
                  </pre>
                )}
              </div>
            </button>
          );
        })}
        {timelineItems.length === 0 && <div className="empty">Keine Historie vorhanden.</div>}
      </div>
    </div>
    </div>
  );
};

export default EmployeeDetail;
