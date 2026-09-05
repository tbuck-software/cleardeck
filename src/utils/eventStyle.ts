/**
 * Calendar colour groups. The many event types collapse into five buckets the
 * user actually filters by, so the legend stays readable.
 */

import type { UnifiedEventType } from '../shared/types';

export type EventGroup = 'birthday' | 'patient-birthday' | 'visit' | 'instruction' | 'hr';

export const EVENT_GROUPS: { key: EventGroup; label: string; dot: string; bg: string; fg: string }[] = [
  {
    key: 'birthday',
    label: 'Geburtstage',
    dot: 'var(--color-accent-2-500)',
    bg: 'var(--color-accent-2-100)',
    fg: 'var(--color-accent-2-800)',
  },
  {
    key: 'patient-birthday',
    label: 'Patient:innen-Geburtstage',
    dot: 'var(--color-accent-2-300)',
    bg: 'var(--color-accent-2-100)',
    fg: 'var(--color-accent-2-800)',
  },
  {
    key: 'visit',
    label: 'Pflegevisiten',
    dot: 'var(--color-accent-500)',
    bg: 'var(--color-accent-100)',
    fg: 'var(--color-accent-800)',
  },
  {
    key: 'instruction',
    label: 'Einweisungen',
    dot: 'var(--bad-800)',
    bg: 'var(--bad-100)',
    fg: 'var(--bad-800)',
  },
  {
    key: 'hr',
    label: 'Personal',
    dot: 'var(--color-neutral-600)',
    bg: 'var(--color-neutral-200)',
    fg: 'var(--color-neutral-800)',
  },
];

export const groupOfEvent = (type: UnifiedEventType | string): EventGroup => {
  switch (type) {
    case 'birthday':
      return 'birthday';
    case 'patient-birthday':
      return 'patient-birthday';
    case 'patient-visit':
    case 'care-visit':
      return 'visit';
    case 'certificate-expiry':
    case 'emergency-training':
      return 'instruction';
    default:
      return 'hr';
  }
};

export const styleOfEvent = (type: UnifiedEventType | string) => {
  const group = groupOfEvent(type);
  return EVENT_GROUPS.find((entry) => entry.key === group) ?? EVENT_GROUPS[4];
};

/**
 * Local calendar date key. Deliberately not toISOString(), which converts to
 * UTC and moves local midnight onto the previous day east of Greenwich.
 */
export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
