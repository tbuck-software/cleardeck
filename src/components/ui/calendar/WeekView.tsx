import React from 'react';
import { dateKey, styleOfEvent } from '../../../utils/eventStyle';
import type { UpcomingEvent } from '../../../shared/types';

type WeekViewProps = {
  currentDate: Date;
  eventsByDate: Record<string, UpcomingEvent[]>;
  onEventClick: (event: UpcomingEvent) => void;
};

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const weekDays = (date: Date): Date[] => {
  const monday = new Date(date);
  monday.setDate(date.getDate() + (date.getDay() === 0 ? -6 : 1 - date.getDay()));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
};

const WeekView = ({ currentDate, eventsByDate, onEventClick }: WeekViewProps) => {
  const days = weekDays(currentDate);
  const today = dateKey(new Date());

  return (
    <div className="calendar-week">
      {days.map((day, index) => {
        const key = dateKey(day);
        const events = eventsByDate[key] ?? [];
        return (
          <div key={key} className={`calendar-week-day ${key === today ? 'today' : ''}`}>
            <div className="calendar-week-day-header">
              <span className="calendar-week-day-name">{WEEKDAYS[index]}</span>
              <span className="calendar-week-day-number">{day.getDate()}</span>
            </div>
            <div className="calendar-week-events">
              {events.map((event) => {
                const style = styleOfEvent(event.type);
                const who = event.patientName ?? event.employeeName ?? '';
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="cd-day-event"
                    style={{ background: style.bg, color: style.fg, whiteSpace: 'normal' }}
                    onClick={() => onEventClick(event)}
                  >
                    <strong>{who}</strong>
                    {who && ' · '}
                    {event.title}
                  </button>
                );
              })}
              {events.length === 0 && <div className="cd-muted-13">Keine Termine</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WeekView;
