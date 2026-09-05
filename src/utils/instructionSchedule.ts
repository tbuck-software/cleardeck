/**
 * Wiedervorlage von Einweisungen.
 *
 * Rules and their sources: docs/adr/0002 and the research it cites. The two
 * that shape this module: an interval belongs to the instruction, not the app,
 * and JArbSchG § 29 Abs. 2 shortens *every* interval for someone under 18.
 */

/** Where a stored interval comes from — a norm, or the service's own choice. */
export type IntervalSource = 'norm' | 'betrieblich';

/** JArbSchG § 29 Abs. 2: "mindestens aber halbjährlich". */
export const MINOR_MAX_INTERVAL_MONTHS = 6;

const addMonths = (isoDate: string, months: number): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  // 31.01. + 1 Monat rolls into March; clamp back to the last day of the month.
  if (date.getDate() < day) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isUnderEighteenOn = (birthDate: string, on: string): boolean => {
  const eighteenth = addMonths(birthDate, 18 * 12);
  return on < eighteenth;
};

/**
 * The interval that actually applies to one person.
 *
 * The age is taken at the completion date, because § 29 Abs. 2 requires the
 * repetition *while* the person is a minor. Reading the age at the due date
 * instead would let a sixteen-year-old go a full 24 months on a two-year topic
 * — the very gap the rule exists to close.
 */
export const effectiveIntervalMonths = (
  intervalMonths: number | null | undefined,
  birthDate: string | null | undefined,
  completedAt: string,
): number | null => {
  if (intervalMonths == null) return null;
  if (!birthDate || birthDate.startsWith('0000')) return intervalMonths;
  if (!isUnderEighteenOn(birthDate, completedAt)) return intervalMonths;

  return Math.min(intervalMonths, MINOR_MAX_INTERVAL_MONTHS);
};

/**
 * When the same instruction is next due, or null when it has no fixed
 * interval — which is a valid state, not a missing value.
 */
export const nextDueDate = (
  intervalMonths: number | null | undefined,
  birthDate: string | null | undefined,
  completedAt: string,
): string | null => {
  const months = effectiveIntervalMonths(intervalMonths, birthDate, completedAt);
  return months == null ? null : addMonths(completedAt, months);
};

export const describeInterval = (
  intervalMonths: number | null | undefined,
  source?: IntervalSource | null,
): string => {
  if (intervalMonths == null) return 'kein festes Intervall';
  const label =
    intervalMonths === 12
      ? 'jährlich'
      : intervalMonths === 24
        ? 'alle zwei Jahre'
        : intervalMonths === 6
          ? 'halbjährlich'
          : `alle ${intervalMonths} Monate`;
  return source === 'norm' ? `${label} · aus der Rechtsgrundlage` : `${label} · betriebliche Festlegung`;
};
