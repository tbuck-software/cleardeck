import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { EmployeeEvent, EmployeeWithPeriod, EmploymentPeriod } from '../../shared/types';
import type { TimelineItem } from '../../types/ui';
import { statusLabels, fteHelp } from '../../constants';

type EmployeeDetailProps = {
  employee: EmployeeWithPeriod;
  displayStart: string;
  timelineItems: TimelineItem[];
  onOpenEditModal: () => void;
  onStartNewPeriod: () => void;
  onSelectPeriod: (period: EmploymentPeriod) => void;
  onSelectEvent: (event: EmployeeEvent) => void;
};

type DiffLine = { text: string; kind: 'del' | 'add' | 'same' };

const typeLabels: Record<EmployeeEvent['type'], string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
};

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
  displayStart,
  timelineItems,
  onOpenEditModal,
  onStartNewPeriod,
  onSelectPeriod,
  onSelectEvent,
}: EmployeeDetailProps) => (
  <div className="stack">
    <div className="card detail-header">
      <div className="detail-main">
        <div className="detail-name" onClick={onOpenEditModal} title="Name und Notiz bearbeiten">
          <div className="detail-name-title clickable-text">
            <h2>{employee.name}</h2>
            <FontAwesomeIcon icon={faPen} className="edit-inline-icon" />
          </div>
          <div className="note-inline clickable-text">
            {employee.note && employee.note.trim().length > 0 ? (
              <span className="note-text-inline">{employee.note}</span>
            ) : (
              <span className="muted">Notiz hinzufügen</span>
            )}
          </div>
        </div>
        <div className="detail-meta">
          <span className="pill">{employee.qualification}</span>
          {employee.weeklyHours !== null && employee.weeklyHours !== undefined && (
            <span className="pill editable-pill" onClick={onOpenEditModal} title="Name/Notiz bearbeiten">
              Wochenstunden {employee.weeklyHours}
            </span>
          )}
          <span className="pill editable-pill" onClick={onOpenEditModal} title="Name/Notiz bearbeiten">
            <abbr className="help" title={fteHelp}>
              VZÄ
            </abbr>{' '}
            {employee.fte.toFixed(2)}
          </span>
          <span className={`badge badge-${employee.status}`}>{statusLabels[employee.status]}</span>
          <span className="muted">
            {displayStart} – {employee.endDate ?? 'aktuell'}
          </span>
        </div>
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
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <div className="timeline-title">
                    {p.startDate} – {p.endDate ?? 'aktuell'}
                  </div>
                  <div className="timeline-meta">
                    <span className="pill">{p.qualification ?? employee.qualification}</span>
                    <span className="pill">VZÄ {p.fte}</span>
                    {p.note && <span className="muted">{p.note}</span>}
                  </div>
                </div>
              </button>
            );
          }
          const ev = item.record;
          const prevFallback =
            ev.previousValue ?? (ev.meta && (ev.meta as any).from ? String((ev.meta as any).from) : undefined);
          const newFallback = ev.newValue ?? (ev.meta && (ev.meta as any).to ? String((ev.meta as any).to) : undefined);
          const hasDiffValues = prevFallback !== undefined || newFallback !== undefined;
          const detail =
            ev.type === 'name-change' && (prevFallback || newFallback)
              ? `${prevFallback ?? ''} → ${newFallback ?? ''}`
              : ev.details;
          const isDiff = ev.type === 'note-change' && hasDiffValues;
          const prevVal = prevFallback ?? '';
          const newVal = newFallback ?? '';
          const diffLines = isDiff ? buildNoteDiff(prevVal, newVal) : [];
          return (
            <button
              className="timeline-item event"
              key={`e-${ev.id ?? `${ev.eventDate}-${ev.title}`}`}
              onClick={() => onSelectEvent(ev)}
            >
              <div className="timeline-dot event-dot" />
              <div className="timeline-content">
                <div className="timeline-title">
                  {ev.eventDate} · {ev.title}
                </div>
                <div className="timeline-meta">
                  <span className="pill pill-quiet">{typeLabels[ev.type]}</span>
                  {detail &&
                    (isDiff ? (
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
                    ) : (
                      <span className="muted">{detail}</span>
                    ))}
                </div>
              </div>
            </button>
          );
        })}
        {timelineItems.length === 0 && <div className="empty">Keine Historie vorhanden.</div>}
      </div>
    </div>
  </div>
);

export default EmployeeDetail;
