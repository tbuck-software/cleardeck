import type { CareLevel } from '../shared/types';

/**
 * Pflegegrad values stored on a patient.
 *
 * A missing database value remains unknown. Zero is the explicit answer that
 * no Pflegegrad exists, while one through five are the assigned grades.
 */
export const CARE_LEVEL_LABELS: Record<CareLevel, string> = {
  0: 'Kein Pflegegrad',
  1: 'PG 1',
  2: 'PG 2',
  3: 'PG 3',
  4: 'PG 4',
  5: 'PG 5',
};

/** In Bedienelementen steht der Bezug in der Beschriftung daneben. */
export const UNKNOWN_CARE_LEVEL_LABEL = 'Unbekannt';
/** In Listenzeilen ohne sichtbare Beschriftung. */
export const UNKNOWN_CARE_LEVEL_SHORT_LABEL = 'Pflegegrad unbekannt';

export const CARE_LEVEL_OPTIONS: { value: CareLevel; label: string }[] = [
  { value: 0, label: CARE_LEVEL_LABELS[0] },
  { value: 1, label: 'Pflegegrad 1' },
  { value: 2, label: 'Pflegegrad 2' },
  { value: 3, label: 'Pflegegrad 3' },
  { value: 4, label: 'Pflegegrad 4' },
  { value: 5, label: 'Pflegegrad 5' },
];

export const isCareLevel = (value: unknown): value is CareLevel =>
  value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

export const careLevelLabel = (value?: CareLevel | null): string =>
  value == null ? UNKNOWN_CARE_LEVEL_SHORT_LABEL : CARE_LEVEL_LABELS[value];
