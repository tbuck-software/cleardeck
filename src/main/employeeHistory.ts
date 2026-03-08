import type { EmployeeEventType } from '../shared/types';

type EmployeeChangeSnapshot = {
  fte?: number | null;
  weeklyHours?: number | null;
};

type EmployeeChangeEvent = {
  eventDate: string;
  type: EmployeeEventType;
  title: string;
  previousValue: string | null;
  newValue: string | null;
};

const normalizeNumber = (value?: number | null): number | null => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  return Number(value);
};

const sameNumber = (left?: number | null, right?: number | null): boolean => {
  const a = normalizeNumber(left);
  const b = normalizeNumber(right);
  if (a === null || b === null) {
    return a === b;
  }
  return a === b;
};

const formatFte = (value?: number | null): string | null => {
  const normalized = normalizeNumber(value);
  return normalized === null ? null : normalized.toFixed(2);
};

const formatWeeklyHours = (value?: number | null): string | null => {
  const normalized = normalizeNumber(value);
  return normalized === null ? null : `${normalized.toFixed(1)} h`;
};

export const buildEmployeeChangeEvents = (input: {
  previous: EmployeeChangeSnapshot;
  next: EmployeeChangeSnapshot;
  eventDate: string;
}): EmployeeChangeEvent[] => {
  const events: EmployeeChangeEvent[] = [];

  if (!sameNumber(input.previous.fte, input.next.fte)) {
    events.push({
      eventDate: input.eventDate,
      type: 'fte-change',
      title: 'VZÄ-Änderung',
      previousValue: formatFte(input.previous.fte),
      newValue: formatFte(input.next.fte),
    });
  }

  if (!sameNumber(input.previous.weeklyHours, input.next.weeklyHours)) {
    events.push({
      eventDate: input.eventDate,
      type: 'weekly-hours-change',
      title: 'Wochenstundenänderung',
      previousValue: formatWeeklyHours(input.previous.weeklyHours),
      newValue: formatWeeklyHours(input.next.weeklyHours),
    });
  }

  return events;
};
