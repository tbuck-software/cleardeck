import React from 'react';
import type { UpcomingEvent } from '../../../shared/types';

type YearViewProps = {
  currentDate: Date;
  eventsByDate: Record<string, UpcomingEvent[]>;
  onMonthClick: (year: number, month: number) => void;
};

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const weekDaysShort = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

/**
 * Get all days for a mini-month grid
 */
const getMiniMonthDays = (year: number, month: number): (number | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Get day of week for first day (0 = Sunday, adjust to Monday start)
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Monday = 0

  const days: (number | null)[] = [];

  // Add empty cells for days before the 1st
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
};

/**
 * Check if a date has events
 */
const hasEvents = (year: number, month: number, day: number, eventsByDate: Record<string, UpcomingEvent[]>): boolean => {
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return Boolean(eventsByDate[dateKey]?.length);
};

/**
 * Check if a date is today
 */
const isToday = (year: number, month: number, day: number): boolean => {
  const today = new Date();
  return (
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()
  );
};

/**
 * Count events in a month
 */
const countMonthEvents = (year: number, month: number, eventsByDate: Record<string, UpcomingEvent[]>): number => {
  let count = 0;
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    count += eventsByDate[dateKey]?.length || 0;
  }

  return count;
};

const YearView = ({ currentDate, eventsByDate, onMonthClick }: YearViewProps) => {
  const year = currentDate.getFullYear();

  return (
    <div className="calendar-year">
      <div className="calendar-year-grid">
        {monthNames.map((name, month) => {
          const days = getMiniMonthDays(year, month);
          const eventCount = countMonthEvents(year, month, eventsByDate);

          return (
            <button
              key={month}
              className="calendar-mini-month"
              onClick={() => onMonthClick(year, month)}
            >
              <div className="calendar-mini-month-header">
                <span className="calendar-mini-month-name">{name}</span>
                {eventCount > 0 && (
                  <span className="calendar-mini-month-badge">{eventCount}</span>
                )}
              </div>
              <div className="calendar-mini-month-weekdays">
                {weekDaysShort.map((day, i) => (
                  <span key={i} className="calendar-mini-weekday">{day}</span>
                ))}
              </div>
              <div className="calendar-mini-month-days">
                {days.map((day, i) => (
                  <span
                    key={i}
                    className={`calendar-mini-day ${
                      day === null ? 'empty' : ''
                    } ${
                      day && hasEvents(year, month, day, eventsByDate) ? 'has-events' : ''
                    } ${
                      day && isToday(year, month, day) ? 'today' : ''
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default YearView;
