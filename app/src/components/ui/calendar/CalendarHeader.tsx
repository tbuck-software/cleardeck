import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { CalendarView } from '../../../types/ui';

type CalendarHeaderProps = {
  periodLabel: string;
  view: CalendarView;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
};

const CalendarHeader = ({
  periodLabel,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: CalendarHeaderProps) => {
  return (
    <div className="calendar-header">
      <div className="calendar-nav">
        <button className="ghost-button icon-button" onClick={onPrev} title="Zurück">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <span className="calendar-period-label">{periodLabel}</span>
        <button className="ghost-button icon-button" onClick={onNext} title="Weiter">
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <div className="calendar-controls">
        <div className="calendar-view-switcher">
          <button
            className={`view-btn ${view === 'month' ? 'active' : ''}`}
            onClick={() => onViewChange('month')}
          >
            Monat
          </button>
          <button
            className={`view-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => onViewChange('week')}
          >
            Woche
          </button>
          <button
            className={`view-btn ${view === 'year' ? 'active' : ''}`}
            onClick={() => onViewChange('year')}
          >
            Jahr
          </button>
        </div>
        <button className="ghost-button" onClick={onToday}>
          Heute
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
