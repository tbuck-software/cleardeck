import type { EmploymentPeriod } from '../shared/types';
import { shiftDays, validDate } from './calendarDate';

/**
 * Find the start of the contiguous employment chain containing a period.
 *
 * Employment periods remain the source of truth for qualification and report
 * boundaries. This helper only derives a display value by walking backwards
 * over periods whose dates touch, including periods from earlier years.
 *
 * Expects the periods of one employee ordered by startDate, as the query in
 * the repository returns them.
 */
export const contiguousEmploymentStart = (
  periods: EmploymentPeriod[],
  selectedPeriodId?: number,
  selectedStartDate?: string,
): string | undefined => {
  const ordered = periods.filter((period) => validDate(period.startDate));
  if (ordered.length === 0) return selectedStartDate;

  let selectedIndex = selectedPeriodId
    ? ordered.findIndex((period) => period.id === selectedPeriodId)
    : -1;
  if (selectedIndex < 0 && selectedStartDate) {
    selectedIndex = ordered.findIndex((period) => period.startDate === selectedStartDate);
  }
  if (selectedIndex < 0) {
    // A report row can be a calculated segment without a period id. Use the
    // latest period that starts no later than that segment.
    if (!selectedStartDate) {
      selectedIndex = ordered.length - 1;
    } else {
      const candidate = ordered.reduce(
        (index, period, candidateIndex) =>
          period.startDate <= selectedStartDate ? candidateIndex : index,
        -1,
      );
      if (candidate < 0) return selectedStartDate;
      selectedIndex = candidate;
    }
  }

  let chainStart = ordered[selectedIndex].startDate;
  for (let index = selectedIndex - 1; index >= 0; index -= 1) {
    const previous = ordered[index];
    const nextStart = ordered[index + 1].startDate;
    const touchesNext =
      previous.endDate != null &&
      validDate(previous.endDate) &&
      previous.endDate >= previous.startDate &&
      shiftDays(previous.endDate, 1) >= nextStart;
    if (!touchesNext) break;
    chainStart = previous.startDate;
  }
  return chainStart;
};

export type PeriodBounds = { startDate: string; endDate?: string | null };

/** A qualification change may continue employment immediately after a closed period. */
export const continuesAfterPeriod = (period: PeriodBounds, effectiveFrom: string): boolean =>
  Boolean(period.endDate && validDate(period.endDate) && validDate(effectiveFrom) &&
    effectiveFrom === shiftDays(period.endDate, 1));

/** Stands in for an open end when comparing ranges. */
const OPEN_END = '9999-12-31';

/** One wording per condition, shared by the repair modules, the repository and the UI. */
export const employmentMessages = {
  reversedInput: 'Das Ende liegt vor dem Beginn.',
  reversedPeriod: 'Ein Beschäftigungszeitraum hat umgekehrte Daten. Bitte zuerst Beginn und Ende prüfen.',
  overlap:
    'Beschäftigungsperioden überschneiden sich. Bitte zuerst das Ende der bisherigen Periode korrigieren oder „Qualifikation wechseln“ verwenden.',
  notAdjacent: 'Die Abschnitte grenzen nicht unmittelbar aneinander.',
  differentEmployees: 'Abschnitte gehören zu verschiedenen Personen.',
  sameSection: 'Bitte zwei verschiedene Abschnitte auswählen.',
} as const;

export const hasReversedDates = (period: PeriodBounds): boolean =>
  Boolean(period.endDate && period.startDate > period.endDate);

/** Reversed dates do not describe a range, so they never count as an overlap. */
export const periodsOverlap = (left: PeriodBounds, right: PeriodBounds): boolean => {
  if (hasReversedDates(left) || hasReversedDates(right)) return false;
  return (
    left.startDate <= (right.endDate ?? OPEN_END) && right.startDate <= (left.endDate ?? OPEN_END)
  );
};

export const orderPeriods = <T extends PeriodBounds>(left: T, right: T): [T, T] =>
  left.startDate <= right.startDate ? [left, right] : [right, left];

export const periodsAdjacent = (left: PeriodBounds, right: PeriodBounds): boolean => {
  const [first, second] = orderPeriods(left, right);
  if (!first.endDate || hasReversedDates(first)) return false;
  return shiftDays(first.endDate, 1) === second.startDate;
};

/** The note v017 writes when it reconstructs a period from an old join event. */
export const MIGRATED_PERIOD_NOTE =
  'Aus bisherigem Eintrittsereignis übernommen. Qualifikation und Stunden prüfen.';

/**
 * Only the migration's own note and an explicit Übernahme/Migration wording count.
 * Anything looser turns every note containing "prüfen" into a permanent warning.
 */
export const looksMigrated = (note: string | null | undefined): boolean =>
  Boolean(note) &&
  (note!.includes(MIGRATED_PERIOD_NOTE) || /(^|\W)(Übernahme|Migration)(\W|$)/i.test(note!));
