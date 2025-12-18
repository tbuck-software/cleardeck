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

type MonthViewProps = {
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

const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Generate all days to display in the month grid
 */
const getMonthDays = (date: Date): Date[] => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get Monday of the first week
  const firstDayOfWeek = firstDay.getDay();
  const mondayOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() + mondayOffset);

  // Get Sunday of the last week
  const lastDayOfWeek = lastDay.getDay();
  const sundayOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + sundayOffset);

  const days: Date[] = [];
  const current = new Date(gridStart);

  while (current <= gridEnd) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
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

const MonthView = ({ currentDate, eventsByDate, onEventClick }: MonthViewProps) => {
  const days = getMonthDays(currentDate);
  const currentMonth = currentDate.getMonth();

  return (
    <div className="calendar-month">
      <div className="calendar-weekdays">
        {weekDays.map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-days">
        {days.map((day) => {
          const dateKey = formatDateKey(day);
          const dayEvents = eventsByDate[dateKey] || [];
          const isOtherMonth = day.getMonth() !== currentMonth;
          const isTodayDate = isToday(day);

          return (
            <div
              key={dateKey}
              className={`calendar-day ${isOtherMonth ? 'other-month' : ''} ${isTodayDate ? 'today' : ''}`}
            >
              <div className="calendar-day-header">
                <span className={`calendar-day-number ${isTodayDate ? 'today-badge' : ''}`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="calendar-day-events">
                {dayEvents.slice(0, 3).map((event) => {
                  const displayName = event.patientName ?? event.employeeName;
                  return (
                    <button
                      key={event.id}
                      className={`calendar-event event-${event.type}`}
                      onClick={() => onEventClick(event)}
                      title={`${event.title} - ${displayName}`}
                    >
                      <FontAwesomeIcon icon={typeIcons[event.type]} className="calendar-event-icon" />
                      <span className="calendar-event-name">{displayName}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="calendar-day-more">+{dayEvents.length - 3} weitere</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
