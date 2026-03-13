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
  onOpenSuggestedCompetencies: () => void;
  onOpenEditModal: () => void;
  onStartNewPeriod: () => void;
  onSelectCompetency: (entry: EmployeeCompetency) => void;
  onSelectInstruction: (entry: EmployeeInstruction) => void;
  onSelectPeriod: (period: EmploymentPeriod) => void;
  onSelectEvent: (event: EmployeeEvent) => void;
};

type DiffLine = { text: string; kind: 'del' | 'add' | 'same' };
type DetailSection = 'overview' | 'competencies' | 'instructions' | 'history';

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
  onOpenSuggestedCompetencies,
  onOpenEditModal,
  onStartNewPeriod,
  onSelectCompetency,
  onSelectInstruction,
  onSelectPeriod,
  onSelectEvent,
}: EmployeeDetailProps) => {
  const [activeSection, setActiveSection] = React.useState<DetailSection>('overview');
  const handleOpenEditModal = () => onOpenEditModal();
  const today = new Date().toISOString().slice(0, 10);

  const handleEnterSpace = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenEditModal();
    }
  };

  const openCompetencies = employeeCompetencies.filter((entry) => !entry.level);
  const approvedCompetencies = employeeCompetencies.filter(
    (entry) => Boolean(entry.approvedAt) || (entry.level ?? 0) >= 4,
  );
  const pendingInstructions = employeeInstructions.filter((entry) => !entry.completedAt);
  const overdueInstructions = pendingInstructions.filter(
    (entry) => entry.dueDate && entry.dueDate < today,
  );
  const nextInstructionItems = [...pendingInstructions]
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'))
    .slice(0, 5);
  const focusCompetencyItems = [...employeeCompetencies]
    .sort((a, b) => {
      const aScore = a.level ?? 0;
      const bScore = b.level ?? 0;
      if (aScore !== bScore) return aScore - bScore;
      return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
    })
    .slice(0, 6);
  const historyPreview = timelineItems.slice(0, 4);

  const sectionButtons: Array<{ id: DetailSection; label: string; count?: number }> = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'competencies', label: 'Kompetenzen', count: employeeCompetencies.length },
    { id: 'instructions', label: 'Einweisungen', count: employeeInstructions.length },
    { id: 'history', label: 'Historie', count: timelineItems.length },
  ];

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

          <div className="detail-section-tabs">
            {sectionButtons.map((section) => (
              <button
                key={section.id}
                className={`ghost-button detail-tab${activeSection === section.id ? ' active' : ''}`}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                <span>{section.label}</span>
                {typeof section.count === 'number' && (
                  <span className="detail-tab-count">{section.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeSection === 'overview' && (
        <div className="detail-panels-grid">
          <div className="card detail-panel">
            <div className="detail-panel-header">
              <div>
                <h3>Kompetenzen</h3>
                <p className="subtitle small">Schneller Überblick über offene und freigegebene Themen.</p>
              </div>
              <button className="ghost-button" onClick={() => setActiveSection('competencies')}>
                Matrix öffnen
              </button>
            </div>
            <div className="detail-stat-row">
              <div className="detail-stat">
                <strong>{employeeCompetencies.length}</strong>
                <span>zugeordnet</span>
              </div>
              <div className="detail-stat warning">
                <strong>{openCompetencies.length}</strong>
                <span>offen</span>
              </div>
              <div className="detail-stat success">
                <strong>{approvedCompetencies.length}</strong>
                <span>freigegeben</span>
              </div>
            </div>
            <div className="detail-mini-list">
              {focusCompetencyItems.length > 0 ? (
                focusCompetencyItems.map((entry) => (
                  <button
                    key={`${entry.competencyDefinitionId}-${entry.id ?? 'new'}`}
                    className="detail-mini-item"
                    onClick={() => onSelectCompetency(entry)}
                  >
                    <div>
                      <strong>{entry.competencyName}</strong>
                      <span className="muted">
                        {(entry.category ?? 'Allgemein')} · {formatCompetencyLevel(entry.level)}
                      </span>
                    </div>
                    <span className="detail-mini-tag">{entry.relevance ?? 'Alle'}</span>
                  </button>
                ))
              ) : (
                <div className="empty compact-empty">Noch keine Kompetenzen zugeordnet.</div>
              )}
            </div>
          </div>

          <div className="card detail-panel">
            <div className="detail-panel-header">
              <div>
                <h3>Einweisungen</h3>
                <p className="subtitle small">Pflichtunterweisungen und fällige Themen im Blick.</p>
              </div>
              <button className="ghost-button" onClick={() => setActiveSection('instructions')}>
                Liste öffnen
              </button>
            </div>
            <div className="detail-stat-row">
              <div className="detail-stat">
                <strong>{employeeInstructions.length}</strong>
                <span>zugeordnet</span>
              </div>
              <div className="detail-stat warning">
                <strong>{pendingInstructions.length}</strong>
                <span>offen</span>
              </div>
              <div className="detail-stat danger">
                <strong>{overdueInstructions.length}</strong>
                <span>überfällig</span>
              </div>
            </div>
            <div className="detail-mini-list">
              {nextInstructionItems.length > 0 ? (
                nextInstructionItems.map((entry) => (
                  <button
                    key={`${entry.instructionDefinitionId}-${entry.id ?? 'new'}`}
                    className="detail-mini-item"
                    onClick={() => onSelectInstruction(entry)}
                  >
                    <div>
                      <strong>{entry.instructionName}</strong>
                      <span className="muted">
                        {entry.dueDate ? `Fällig bis ${formatDateDE(entry.dueDate)}` : 'Noch ohne Termin'}
                      </span>
                    </div>
                    <span className="detail-mini-tag">{entry.legalBasis ?? 'Intern'}</span>
                  </button>
                ))
              ) : (
                <div className="empty compact-empty">Noch keine Einweisungen zugeordnet.</div>
              )}
            </div>
          </div>

          <div className="card detail-panel detail-panel-wide">
            <div className="detail-panel-header">
              <div>
                <h3>Historie</h3>
                <p className="subtitle small">Letzte Einträge aus Beschäftigungs- und Ereignishistorie.</p>
              </div>
              <button className="ghost-button" onClick={() => setActiveSection('history')}>
                Chronik öffnen
              </button>
            </div>
            <div className="detail-mini-list">
              {historyPreview.length > 0 ? (
                historyPreview.map((item) =>
                  item.kind === 'period' ? (
                    <button
                      key={`preview-period-${item.record.id ?? item.record.startDate}`}
                      className="detail-mini-item"
                      onClick={() => onSelectPeriod(item.record)}
                    >
                      <div>
                        <strong>{item.record.qualification ?? employee.qualification}</strong>
                        <span className="muted">
                          {formatDateDE(item.record.startDate)} –{' '}
                          {item.record.endDate ? formatDateDE(item.record.endDate) : 'aktuell'}
                        </span>
                      </div>
                      <span className="detail-mini-tag">Beschäftigung</span>
                    </button>
                  ) : (
                    <button
                      key={`preview-event-${item.record.id ?? item.record.eventDate}`}
                      className="detail-mini-item"
                      onClick={() => onSelectEvent(item.record)}
                    >
                      <div>
                        <strong>{typeLabels[item.record.type as EmployeeEventType]}</strong>
                        <span className="muted">{formatDateDE(item.record.eventDate)}</span>
                      </div>
                      <span className="detail-mini-tag">{item.record.title}</span>
                    </button>
                  ),
                )
              ) : (
                <div className="empty compact-empty">Keine Historie vorhanden.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'competencies' && (
        <div className="card">
          <div className="form-header">
            <div>
              <h3>Kompetenzen</h3>
              <p className="subtitle small">Kompetenzmatrix mit Stufe, Relevanz und fachlicher Freigabe.</p>
            </div>
            <div className="detail-actions">
              {suggestedCompetencyCount > 0 && (
                <button className="ghost-button" onClick={onOpenSuggestedCompetencies}>
                  <FontAwesomeIcon icon={faPlus} /> Vorschläge aus Qualifikation
                  <span className="detail-tab-count">{suggestedCompetencyCount}</span>
                </button>
              )}
              <button className="primary" onClick={onAddCompetency} disabled={!canAddCompetency}>
                <FontAwesomeIcon icon={faPlus} /> Kompetenz hinzufügen
              </button>
            </div>
          </div>
          <div className="detail-stat-row detail-summary-row">
            <div className="detail-stat">
              <strong>{employeeCompetencies.length}</strong>
              <span>gesamt</span>
            </div>
            <div className="detail-stat warning">
              <strong>{openCompetencies.length}</strong>
              <span>noch offen</span>
            </div>
            <div className="detail-stat success">
              <strong>{approvedCompetencies.length}</strong>
              <span>freigegeben</span>
            </div>
          </div>
          <div className="table-wrapper detail-table-wrapper">
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
      )}

      {activeSection === 'instructions' && (
        <div className="card">
          <div className="form-header">
            <div>
              <h3>Einweisungen</h3>
              <p className="subtitle small">
                Unterweisungen, Pflichtfortbildungen und interne Einweisungen pro Teammitglied.
              </p>
            </div>
            <div className="detail-actions">
              <button className="primary" onClick={onAddInstruction} disabled={!canAddInstruction}>
                <FontAwesomeIcon icon={faPlus} /> Einweisung hinzufügen
              </button>
            </div>
          </div>
          <div className="detail-stat-row detail-summary-row">
            <div className="detail-stat">
              <strong>{employeeInstructions.length}</strong>
              <span>gesamt</span>
            </div>
            <div className="detail-stat warning">
              <strong>{pendingInstructions.length}</strong>
              <span>offen</span>
            </div>
            <div className="detail-stat danger">
              <strong>{overdueInstructions.length}</strong>
              <span>überfällig</span>
            </div>
          </div>
          <div className="table-wrapper detail-table-wrapper">
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
      )}

      {activeSection === 'history' && (
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
                        <span className="timeline-date">
                          {formatDateDE(p.startDate)} – {p.endDate ? formatDateDE(p.endDate) : 'aktuell'}
                        </span>
                      </div>
                      {p.note && <div className="timeline-note muted">{p.note}</div>}
                    </div>
                  </button>
                );
              }
              const ev = item.record;
              const prevFallback =
                ev.previousValue ??
                (ev.meta && (ev.meta as { from?: unknown }).from
                  ? String((ev.meta as { from?: unknown }).from)
                  : undefined);
              const newFallback =
                ev.newValue ??
                (ev.meta && (ev.meta as { to?: unknown }).to
                  ? String((ev.meta as { to?: unknown }).to)
                  : undefined);
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
                            {line.kind === 'del'
                              ? `-${line.text}`
                              : line.kind === 'add'
                                ? `+${line.text}`
                                : line.text}
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
      )}
    </div>
  );
};

export default EmployeeDetail;
