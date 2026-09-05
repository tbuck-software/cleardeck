import React from 'react';
import Dialog from '../ui/Dialog';
import { styleOfEvent } from '../../utils/eventStyle';
import type { UpcomingEvent } from '../../shared/types';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

type DayModalProps = {
  date: string | null;
  events: UpcomingEvent[];
  onSelectEvent: (event: UpcomingEvent) => void;
  onClose: () => void;
};

const DayModal = ({ date, events, onSelectEvent, onClose }: DayModalProps) => {
  if (!date) return null;

  const day = new Date(`${date}T00:00:00`);
  const title = `${WEEKDAYS[day.getDay()]}, ${day.getDate()}. ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;

  return (
    <Dialog
      open
      width={520}
      title={title}
      subtitle={`${events.length} ${events.length === 1 ? 'Termin' : 'Termine'}`}
      cancelLabel="Schließen"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '0 -8px' }}>
        {events.length === 0 && (
          <div style={{ padding: '18px 10px', color: 'var(--color-neutral-700)' }}>
            Keine Termine an diesem Tag.
          </div>
        )}
        {events.map((event) => {
          const style = styleOfEvent(event.type);
          return (
            <button key={event.id} type="button" className="cd-item" onClick={() => onSelectEvent(event)}>
              <span className="cd-dot-lg" style={{ background: style.dot }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {event.patientName ?? event.employeeName ?? event.title}
                </div>
                <div className="cd-muted-13">{event.title}</div>
              </div>
              <span className="tag tag-neutral" style={{ flex: 'none' }}>
                {style.label}
              </span>
              <span className="cd-arrow">→</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
};

export default DayModal;
