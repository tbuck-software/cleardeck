import React from 'react';
import { dateKey, styleOfEvent } from '../../../utils/eventStyle';
import type { UpcomingEvent } from '../../../shared/types';

type MonthViewProps = {
  currentDate: Date;
  eventsByDate: Record<string, UpcomingEvent[]>;
  onEventClick: (event: UpcomingEvent) => void;
  onDayClick: (date: string) => void;
};

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Full weeks, Monday-first, covering the whole month. */
const monthGrid = (date: Date): Date[] => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - offset);

  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const MonthView = ({ currentDate, eventsByDate, onEventClick, onDayClick }: MonthViewProps) => {
  const days = monthGrid(currentDate);
  const month = currentDate.getMonth();
  const today = dateKey(new Date());

  return (
    <div className="cd-calendar-grid">
      {WEEKDAYS.map((day) => (
        <div key={day} className="cd-weekday">
          {day}
        </div>
      ))}

      {days.map((day) => {
        const key = dateKey(day);
        const events = eventsByDate[key] ?? [];
        const isToday = key === today;
        return (
          <div
            key={key}
            className="cd-day cd-row"
            style={{ opacity: day.getMonth() === month ? 1 : 0.45 }}
            role="button"
            tabIndex={0}
            aria-label={`${day.getDate()}. — ${events.length} Termine`}
            onClick={() => onDayClick(key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onDayClick(key);
              }
            }}
          >
            <span
              className="cd-day-num"
              style={{
                background: isToday ? 'var(--color-accent)' : 'transparent',
                color: isToday ? '#fff' : 'inherit',
              }}
            >
              {day.getDate()}
            </span>
            {events.slice(0, 3).map((event) => {
              const style = styleOfEvent(event.type);
              const who = event.patientName ?? event.employeeName ?? '';
              return (
                <button
                  key={event.id}
                  type="button"
                  className="cd-day-event"
                  style={{ background: style.bg, color: style.fg }}
                  title={`${who} — ${event.title}`}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEventClick(event);
                  }}
                >
                  {who ? `${who.split(' ')[0]} · ` : ''}
                  {event.title}
                </button>
              );
            })}
            {events.length > 3 && <div className="cd-day-more">+{events.length - 3} weitere</div>}
          </div>
        );
      })}
    </div>
  );
};

export default MonthView;
