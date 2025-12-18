import React from 'react';
import CalendarHeader from '../ui/calendar/CalendarHeader';
import MonthView from '../ui/calendar/MonthView';
import WeekView from '../ui/calendar/WeekView';
import YearView from '../ui/calendar/YearView';
import type { CalendarView } from '../../types/ui';
import type { UpcomingEvent } from '../../shared/types';

type CalendarPageProps = {
  currentDate: Date;
  view: CalendarView;
  eventsByDate: Record<string, UpcomingEvent[]>;
  periodLabel: string;
  loading: boolean;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMonthClick: (year: number, month: number) => void;
  onEventClick: (event: UpcomingEvent) => void;
};

const CalendarPage = ({
  currentDate,
  view,
  eventsByDate,
  periodLabel,
  loading,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onMonthClick,
  onEventClick,
}: CalendarPageProps) => {
  return (
    <div className="calendar-page">
      <CalendarHeader
        periodLabel={periodLabel}
        view={view}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
        onViewChange={onViewChange}
      />

      <div className={`calendar-content ${loading ? 'loading' : ''}`}>
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            eventsByDate={eventsByDate}
            onEventClick={onEventClick}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            eventsByDate={eventsByDate}
            onEventClick={onEventClick}
          />
        )}
        {view === 'year' && (
          <YearView
            currentDate={currentDate}
            eventsByDate={eventsByDate}
            onMonthClick={onMonthClick}
          />
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
