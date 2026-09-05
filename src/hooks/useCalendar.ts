import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type { UpcomingEvent, UnifiedEventType, PatientBirthdayEvent, PatientVisitEvent } from '../shared/types';
import type { CalendarView } from '../types/ui';

type UseCalendarParams = {
  handleError: (err: unknown) => void;
  hiddenEventTypes: UnifiedEventType[];
  enabled?: boolean;
};

/**
 * Get the start and end dates for a given view and date
 */
const getDateRange = (date: Date, view: CalendarView): { startDate: string; endDate: string } => {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (view === 'year') {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  if (view === 'week') {
    // Get Monday of the current week
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: monday.toISOString().slice(0, 10),
      endDate: sunday.toISOString().slice(0, 10),
    };
  }

  // Month view - include days from previous/next month that appear in the grid
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

  return {
    startDate: gridStart.toISOString().slice(0, 10),
    endDate: gridEnd.toISOString().slice(0, 10),
  };
};

/**
 * Format date range for display
 */
export const formatPeriodLabel = (date: Date, view: CalendarView): string => {
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  if (view === 'year') {
    return `${date.getFullYear()}`;
  }

  if (view === 'week') {
    const { startDate, endDate } = getDateRange(date, 'week');
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate ISO week number
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = monthNames[start.getMonth()].slice(0, 3);
    const endMonth = monthNames[end.getMonth()].slice(0, 3);

    if (start.getMonth() === end.getMonth()) {
      return `KW ${weekNum} (${startDay}.–${endDay}. ${startMonth})`;
    }
    return `KW ${weekNum} (${startDay}. ${startMonth} – ${endDay}. ${endMonth})`;
  }

  // Month view
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

const CALENDAR_VIEW_KEY = 'calendarView';

const useCalendar = ({ handleError, hiddenEventTypes, enabled = true }: UseCalendarParams) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>(() => {
    const saved = localStorage.getItem(CALENDAR_VIEW_KEY);
    if (saved && ['month', 'week', 'year'].includes(saved)) {
      return saved as CalendarView;
    }
    return 'month';
  });
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Save view preference when it changes
  const changeView = useCallback((newView: CalendarView) => {
    setView(newView);
    localStorage.setItem(CALENDAR_VIEW_KEY, newView);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(currentDate, view);
      const [employeeEvents, patientBirthdays, patientVisits] = await Promise.all([
        api.events.listRange(startDate, endDate),
        api.patients.listBirthdays(startDate, endDate),
        api.patients.listVisitsInRange(startDate, endDate),
      ]);

      // Transform patient birthdays to calendar events
      const birthdayEvents: UpcomingEvent[] = patientBirthdays.map((item: PatientBirthdayEvent): UpcomingEvent => {
        let details: string | undefined;
        if (item.hasKnownYear) {
          const birthYear = parseInt(item.birthDate.slice(0, 4), 10);
          const eventYear = new Date(item.date).getFullYear();
          const age = eventYear - birthYear;
          details = `${age}. Geburtstag`;
        }
        return {
          id: 0,
          employeeId: undefined,
          eventDate: item.date,
          type: 'patient-birthday' as const,
          title: 'Geburtstag',
          details,
          employeeName: item.patientName,
          patientId: item.patientId,
          patientName: item.patientName,
        };
      });

      // Transform patient visits to calendar events
      const visitEvents: UpcomingEvent[] = patientVisits.map((item: PatientVisitEvent): UpcomingEvent => ({
        id: item.visitId,
        employeeId: undefined,
        eventDate: item.visitDate,
        type: 'patient-visit' as const,
        title: `QPR-Visite (${item.qprRating})`,
        details: item.comment,
        employeeName: item.patientName,
        patientId: item.patientId,
        patientName: item.patientName,
      }));

      setEvents([...employeeEvents, ...birthdayEvents, ...visitEvents]);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, view, handleError]);

  // Load events when date or view changes (only if enabled)
  useEffect(() => {
    if (enabled) {
      loadEvents();
    }
  }, [loadEvents, enabled]);

  const nextPeriod = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === 'year') {
        next.setFullYear(prev.getFullYear() + 1);
      } else if (view === 'week') {
        next.setDate(prev.getDate() + 7);
      } else {
        next.setMonth(prev.getMonth() + 1);
      }
      return next;
    });
  }, [view]);

  const prevPeriod = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === 'year') {
        next.setFullYear(prev.getFullYear() - 1);
      } else if (view === 'week') {
        next.setDate(prev.getDate() - 7);
      } else {
        next.setMonth(prev.getMonth() - 1);
      }
      return next;
    });
  }, [view]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToMonth = useCallback((year: number, month: number) => {
    setCurrentDate(new Date(year, month, 1));
    setView('month');
    localStorage.setItem(CALENDAR_VIEW_KEY, 'month');
  }, []);

  // Filter events based on hidden types
  const filteredEvents = events.filter(
    (event) => !hiddenEventTypes.includes(event.type),
  );

  // Group events by date for easy lookup
  const eventsByDate = filteredEvents.reduce<Record<string, UpcomingEvent[]>>((acc, event) => {
    const date = event.eventDate;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {});

  return {
    state: {
      currentDate,
      view,
      events: filteredEvents,
      eventsByDate,
      loading,
      periodLabel: formatPeriodLabel(currentDate, view),
    },
    actions: {
      setView: changeView,
      nextPeriod,
      prevPeriod,
      goToToday,
      goToMonth,
      loadEvents,
    },
  };
};

export default useCalendar;
