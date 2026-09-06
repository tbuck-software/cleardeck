/** Local reporting convention confirmed by the product owner: 36h or more = 1.0. */
export const deriveFteFromWeeklyHours = (weeklyHours: number, baseHours: number): number => {
  if (
    !Number.isFinite(weeklyHours) ||
    weeklyHours < 0 ||
    !Number.isFinite(baseHours) ||
    baseHours <= 0
  )
    return 0;
  return weeklyHours >= 36 ? 1 : Number(Math.min(1, weeklyHours / baseHours).toFixed(2));
};

export const deriveWeeklyHoursFromFte = (fte: number, baseHours: number): number => {
  if (!Number.isFinite(fte) || !Number.isFinite(baseHours) || baseHours <= 0) return 0;
  return Number((Math.max(0, Math.min(1, fte)) * baseHours).toFixed(1));
};
