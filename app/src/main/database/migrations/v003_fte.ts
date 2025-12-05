/**
 * Migration v003: FTE Recalculation
 *
 * Ensures weeklyHours are properly stored in employment_periods
 * and recalculates FTE using the 36-hour threshold rule:
 * - weeklyHours >= 36 = 1.0 FTE
 * - weeklyHours < 36 = weeklyHours / baseHours (capped at 1.0)
 */

import type { Migration } from './index';

const FULL_TIME_THRESHOLD = 36;

export const v003_fte: Migration = {
  version: 3,
  description: 'Migrate weeklyHours to periods and recalculate FTE with 36h threshold',
  up: (db) => {
    // Get baseHours setting
    const baseHoursRow = db
      .prepare("SELECT value FROM settings WHERE key = 'baseHours'")
      .get() as { value?: string } | undefined;
    const baseHours = baseHoursRow?.value ? Number(baseHoursRow.value) || 36 : 36;

    // 1. Copy weeklyHours from employees to periods where missing
    db.prepare(
      `
      UPDATE employment_periods
      SET weeklyHours = (SELECT e.weeklyHours FROM employees e WHERE e.id = employment_periods.employeeId)
      WHERE weeklyHours IS NULL
    `,
    ).run();

    // 2. If weeklyHours is still NULL but FTE exists, calculate weeklyHours from FTE
    db.prepare(
      `
      UPDATE employment_periods
      SET weeklyHours = CASE
        WHEN fte >= 1.0 THEN ?
        ELSE ROUND(fte * ?, 1)
      END
      WHERE weeklyHours IS NULL AND fte IS NOT NULL
    `,
    ).run(baseHours, baseHours);

    // 3. Recalculate FTE for all periods where weeklyHours is set (using 36h threshold)
    db.prepare(
      `
      UPDATE employment_periods
      SET fte = CASE
        WHEN weeklyHours >= ? THEN 1.0
        ELSE MIN(1.0, ROUND(weeklyHours / ?, 2))
      END
      WHERE weeklyHours IS NOT NULL
    `,
    ).run(FULL_TIME_THRESHOLD, baseHours);
  },
};
