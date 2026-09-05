import React from 'react';
import Icon from '../ui/Icon';
import Segmented from '../ui/Segmented';
import MonthView from '../ui/calendar/MonthView';
import WeekView from '../ui/calendar/WeekView';
import YearView from '../ui/calendar/YearView';
import { EVENT_GROUPS, type EventGroup } from '../../utils/eventStyle';
import type { CalendarView } from '../../types/ui';
import type { UpcomingEvent } from '../../shared/types';

type CalendarPageProps = {
  currentDate: Date;
  view: CalendarView;
  eventsByDate: Record<string, UpcomingEvent[]>;
  periodLabel: string;
  loading: boolean;
  hiddenGroups: EventGroup[];
  onToggleGroup: (group: EventGroup) => void;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMonthClick: (year: number, month: number) => void;
  onEventClick: (event: UpcomingEvent) => void;
  onDayClick: (date: string) => void;
};

const CalendarPage = ({
  currentDate,
  view,
  eventsByDate,
  periodLabel,
  loading,
  hiddenGroups,
  onToggleGroup,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onMonthClick,
  onEventClick,
  onDayClick,
}: CalendarPageProps) => (
  <div className="cd-page">
    <header className="cd-page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Zurück" onClick={onPrev}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <h1 className="cd-h1" style={{ margin: '0 10px', minWidth: 240 }}>
          {periodLabel}
        </h1>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Weiter" onClick={onNext}>
          <Icon name="chevronRight" size={16} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToday}>
          Heute
        </button>
      </div>
      <Segmented
        ariaLabel="Ansicht"
        options={[
          { value: 'month' as CalendarView, label: 'Monat' },
          { value: 'week' as CalendarView, label: 'Woche' },
          { value: 'year' as CalendarView, label: 'Jahr' },
        ]}
        value={view}
        onChange={onViewChange}
      />
    </header>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {EVENT_GROUPS.map((group) => {
        const hidden = hiddenGroups.includes(group.key);
        return (
          <button
            key={group.key}
            type="button"
            className={`tag ${hidden ? 'tag-outline' : 'tag-neutral'} cd-filter-chip`}
            aria-pressed={!hidden}
            onClick={() => onToggleGroup(group.key)}
          >
            <span className="cd-dot" style={{ background: group.dot }} />
            {group.label}
          </button>
        );
      })}
    </div>

    <div style={{ opacity: loading ? 0.5 : 1 }}>
      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          eventsByDate={eventsByDate}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />
      )}
      {view === 'week' && (
        <WeekView currentDate={currentDate} eventsByDate={eventsByDate} onEventClick={onEventClick} />
      )}
      {view === 'year' && (
        <YearView currentDate={currentDate} eventsByDate={eventsByDate} onMonthClick={onMonthClick} />
      )}
    </div>
  </div>
);

export default CalendarPage;
