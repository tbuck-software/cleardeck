import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightToBracket,
  faArrowRightFromBracket,
  faSignature,
  faStickyNote,
  faStethoscope,
  faKitMedical,
  faCalendarDay,
  faFilter,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { UpcomingEvent, EmployeeEventType } from '../../shared/types';

type UpcomingEventsListProps = {
  events: UpcomingEvent[];
  hiddenEventTypes: EmployeeEventType[];
  onEventClick: (event: UpcomingEvent) => void;
  onToggleFilter: (type: EmployeeEventType) => void;
  onShowAll: () => void;
  onHideAll: () => void;
};

const typeLabels: Record<UpcomingEvent['type'], string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
};

const typeIcons: Record<UpcomingEvent['type'], IconDefinition> = {
  join: faArrowRightToBracket,
  leave: faArrowRightFromBracket,
  'name-change': faSignature,
  'note-change': faStickyNote,
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
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

const allEventTypes: EmployeeEventType[] = [
  'join',
  'leave',
  'care-visit',
  'emergency-training',
  'custom',
];

const UpcomingEventsList = ({
  events,
  hiddenEventTypes,
  onEventClick,
  onToggleFilter,
  onShowAll,
  onHideAll,
}: UpcomingEventsListProps) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasActiveFilters = hiddenEventTypes.length > 0;
  const allHidden = hiddenEventTypes.length === allEventTypes.length;

  return (
    <div className="upcoming-events-container">
      <div className="upcoming-events-toolbar">
        <div className="filter-dropdown-container">
          <button
            className={`ghost-button small filter-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={() => setFilterOpen(!filterOpen)}
            title="Filter"
          >
            <FontAwesomeIcon icon={faFilter} />
            {hasActiveFilters && (
              <span className="filter-badge">{hiddenEventTypes.length}</span>
            )}
          </button>
          {filterOpen && (
            <div className="filter-dropdown">
              <div className="filter-dropdown-header">Anzeigen:</div>
              {allEventTypes.map((type) => {
                const isHidden = hiddenEventTypes.includes(type);
                return (
                  <button
                    key={type}
                    className={`filter-option ${isHidden ? 'hidden' : ''}`}
                    onClick={() => onToggleFilter(type)}
                  >
                    <span className={`filter-check ${isHidden ? '' : 'active'}`}>
                      {!isHidden && <FontAwesomeIcon icon={faCheck} />}
                    </span>
                    <FontAwesomeIcon
                      icon={typeIcons[type]}
                      className={`filter-icon event-${type}`}
                    />
                    <span>{typeLabels[type]}</span>
                  </button>
                );
              })}
              <div className="filter-dropdown-actions">
                <button
                  className="filter-action-btn"
                  onClick={onShowAll}
                  disabled={!hasActiveFilters}
                >
                  Alle anzeigen
                </button>
                <button
                  className="filter-action-btn"
                  onClick={onHideAll}
                  disabled={allHidden}
                >
                  Alle ausblenden
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="empty">
          {hasActiveFilters
            ? 'Keine Ereignisse mit diesen Filtern.'
            : 'Keine bevorstehenden Ereignisse.'}
        </div>
      ) : (
        <div className="upcoming-events-list">
      {events.map((event) => {
        const daysUntil = getDaysUntil(event.eventDate);
        const isToday = daysUntil === 0;
        const isTomorrow = daysUntil === 1;

        return (
          <button
            key={event.id}
            className="upcoming-event-item"
            onClick={() => onEventClick(event)}
          >
            <div className={`upcoming-event-icon event-${event.type}`}>
              <FontAwesomeIcon icon={typeIcons[event.type]} />
            </div>
            <div className="upcoming-event-content">
              <div className="upcoming-event-header">
                <span className="upcoming-event-type">{typeLabels[event.type]}</span>
                <span className="upcoming-event-date">
                  {isToday ? 'Heute' : isTomorrow ? 'Morgen' : formatDate(event.eventDate)}
                </span>
              </div>
              <div className="upcoming-event-employee">{event.employeeName}</div>
              {event.title && event.title !== typeLabels[event.type] && (
                <div className="upcoming-event-title muted">{event.title}</div>
              )}
            </div>
            {!isToday && !isTomorrow && daysUntil <= 7 && (
              <div className="upcoming-event-badge">In {daysUntil} Tagen</div>
            )}
          </button>
        );
      })}
        </div>
      )}
    </div>
  );
};

export default UpcomingEventsList;
