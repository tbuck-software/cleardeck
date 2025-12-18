const FULL_TIME_THRESHOLD = 36;

export const deriveFteFromWeeklyHours = (weeklyHours: number, baseHours: number): number => {
  if (!weeklyHours || Number.isNaN(weeklyHours)) return 0;
  if (weeklyHours >= FULL_TIME_THRESHOLD) return 1;
  const divisor = baseHours || FULL_TIME_THRESHOLD;
  const raw = weeklyHours / divisor;
  return Math.min(1, Number(raw.toFixed(2)));
};

export const deriveWeeklyHoursFromFte = (fte: number, baseHours: number): number => {
  if (!fte || Number.isNaN(fte)) return 0;
  const divisor = baseHours || 36;
  const hours = fte >= 1 ? divisor : fte * divisor;
  return Number(hours.toFixed(1));
};
