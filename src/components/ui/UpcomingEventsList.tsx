import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightToBracket,
  faArrowRightFromBracket,
  faChartPie,
  faClock,
  faSignature,
  faStickyNote,
  faStethoscope,
  faKitMedical,
  faCalendarDay,
  faCakeCandles,
  faAward,
  faCertificate,
  faExclamationTriangle,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { UnifiedEvent, UnifiedEventType } from '../../shared/types';

type UpcomingEventsListProps = {
  events: UnifiedEvent[];
  hasActiveFilters: boolean;
  onEventClick: (event: UnifiedEvent) => void;
};

const typeLabels: Record<UnifiedEventType, string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'fte-change': 'VZÄ-Änderung',
  'weekly-hours-change': 'Wochenstundenänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
  birthday: 'Geburtstag',
  anniversary: 'Jubiläum',
  'certificate-expiry': 'Zertifikat',
  'patient-birthday': 'Patient:in Geb.',
  'patient-visit': 'QPR-Visite',
};

const typeIcons: Record<UnifiedEventType, IconDefinition> = {
  join: faArrowRightToBracket,
  leave: faArrowRightFromBracket,
  'name-change': faSignature,
  'note-change': faStickyNote,
  'fte-change': faChartPie,
  'weekly-hours-change': faClock,
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
  birthday: faCakeCandles,
  anniversary: faAward,
  'certificate-expiry': faCertificate,
  'patient-birthday': faCakeCandles,
  'patient-visit': faClipboardList,
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getDaysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr);
  eventDate.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const UpcomingEventsList = ({
  events,
  hasActiveFilters,
  onEventClick,
}: UpcomingEventsListProps) => {
  if (events.length === 0) {
    return (
      <div className="upcoming-events-container">
        <div className="empty">
          {hasActiveFilters
            ? 'Keine Ereignisse mit diesen Filtern.'
            : 'Keine bevorstehenden Ereignisse.'}
        </div>
      </div>
    );
  }

  return (
    <div className="upcoming-events-container">
      <div className="upcoming-events-list">
        {events.map((event) => {
          const daysUntil = getDaysUntil(event.date);
          const isToday = daysUntil === 0;
          const isTomorrow = daysUntil === 1;
          const urgencyClass = event.urgency || 'normal';
          const showWarningIcon = event.urgency === 'urgent';

          return (
            <button
              key={event.id}
              className={`upcoming-event-item ${urgencyClass !== 'normal' ? urgencyClass : ''}`}
              onClick={() => onEventClick(event)}
            >
              <div className={`upcoming-event-icon event-${event.type} ${urgencyClass}`}>
                {showWarningIcon ? (
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                ) : (
                  <FontAwesomeIcon icon={typeIcons[event.type]} />
                )}
              </div>
              <div className="upcoming-event-content">
                <div className="upcoming-event-header">
                  <span className="upcoming-event-type">{typeLabels[event.type]}</span>
                  <span className={`upcoming-event-date ${urgencyClass}`}>
                    {isToday ? 'Heute' : isTomorrow ? 'Morgen' : formatDate(event.date)}
                  </span>
                </div>
                <div className="upcoming-event-employee">{event.patientName ?? event.employeeName}</div>
                {event.subtitle && (
                  <div className="upcoming-event-title muted">{event.subtitle}</div>
                )}
              </div>
              {!isToday && !isTomorrow && daysUntil <= 7 && (
                <div className={`upcoming-event-badge ${urgencyClass}`}>In {daysUntil} Tagen</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingEventsList;
