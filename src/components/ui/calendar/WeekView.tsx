import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightToBracket,
  faArrowRightFromBracket,
  faStethoscope,
  faKitMedical,
  faCalendarDay,
  faCakeCandles,
  faAward,
  faCertificate,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { UpcomingEvent, UnifiedEventType } from '../../../shared/types';

type WeekViewProps = {
  currentDate: Date;
  eventsByDate: Record<string, UpcomingEvent[]>;
  onEventClick: (event: UpcomingEvent) => void;
};

const typeIcons: Record<UnifiedEventType, IconDefinition> = {
  join: faArrowRightToBracket,
  leave: faArrowRightFromBracket,
  'name-change': faArrowRightToBracket,
  'note-change': faArrowRightToBracket,
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
  birthday: faCakeCandles,
  anniversary: faAward,
  'certificate-expiry': faCertificate,
  'patient-birthday': faCakeCandles,
  'patient-visit': faClipboardList,
};

const typeLabels: Record<UnifiedEventType, string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
  birthday: 'Geburtstag',
  anniversary: 'Jubiläum',
  'certificate-expiry': 'Zertifikat',
  'patient-birthday': 'Patient:in Geb.',
  'patient-visit': 'QPR-Visite',
};

const weekDaysFull = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/**
 * Get the 7 days of the current week (Monday to Sunday)
 */
const getWeekDays = (date: Date): Date[] => {
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
};

const formatDateKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const WeekView = ({ currentDate, eventsByDate, onEventClick }: WeekViewProps) => {
  const days = getWeekDays(currentDate);

  return (
    <div className="calendar-week">
      <div className="calendar-week-grid">
        {days.map((day, index) => {
          const dateKey = formatDateKey(day);
          const dayEvents = eventsByDate[dateKey] || [];
          const isTodayDate = isToday(day);

          return (
            <div key={dateKey} className={`calendar-week-day ${isTodayDate ? 'today' : ''}`}>
              <div className="calendar-week-day-header">
                <span className="calendar-week-day-name">{weekDaysFull[index]}</span>
                <span className={`calendar-week-day-number ${isTodayDate ? 'today-badge' : ''}`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="calendar-week-day-events">
                {dayEvents.map((event) => {
                  const displayName = event.patientName ?? event.employeeName;
                  return (
                    <button
                      key={event.id}
                      className={`calendar-week-event event-${event.type}`}
                      onClick={() => onEventClick(event)}
                    >
                      <div className="calendar-week-event-header">
                        <FontAwesomeIcon icon={typeIcons[event.type]} className="calendar-week-event-icon" />
                        <span className="calendar-week-event-type">{typeLabels[event.type]}</span>
                      </div>
                      <div className="calendar-week-event-name">{displayName}</div>
                      {event.title && event.title !== typeLabels[event.type] && (
                        <div className="calendar-week-event-title">{event.title}</div>
                      )}
                    </button>
                  );
                })}
                {dayEvents.length === 0 && (
                  <div className="calendar-week-empty">Keine Termine</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeekView;
