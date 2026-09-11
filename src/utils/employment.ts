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
