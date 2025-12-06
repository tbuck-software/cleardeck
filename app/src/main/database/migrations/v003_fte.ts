/**
 * Migration v003: Add FTE to employees
 *
 * Adds the fte column to employees table and calculates FTE
 * using the 36-hour threshold rule:
 * - weeklyHours >= 36 = 1.0 FTE
 * - weeklyHours < 36 = weeklyHours / baseHours (capped at 1.0)
 */

import type { Migration } from './index';

const FULL_TIME_THRESHOLD = 36;

export const v003_fte: Migration = {
  version: 3,
  description: 'Add FTE column to employees and calculate from weeklyHours',
  up: (db) => {
    // Get baseHours setting
    const baseHoursRow = db
      .prepare("SELECT value FROM settings WHERE key = 'baseHours'")
      .get() as { value?: string } | undefined;
    const baseHours = baseHoursRow?.value ? Number(baseHoursRow.value) || 36 : 36;

    // 1. Add fte column to employees if missing
    try {
      db.prepare('ALTER TABLE employees ADD COLUMN fte REAL').run();
    } catch {
      /* column already exists */
    }

    // 2. Ensure weeklyHours column exists in employees (for very old DBs)
    try {
      db.prepare('ALTER TABLE employees ADD COLUMN weeklyHours REAL').run();
    } catch {
      /* column already exists */
    }

    // 3. Calculate FTE for all employees where weeklyHours is set
    db.prepare(
      `
      UPDATE employees
      SET fte = CASE
        WHEN weeklyHours >= ? THEN 1.0
        ELSE MIN(1.0, ROUND(weeklyHours / ?, 2))
      END
      WHERE weeklyHours IS NOT NULL
    `,
    ).run(FULL_TIME_THRESHOLD, baseHours);

    // 4. Default FTE to 1.0 where still NULL
    db.prepare(`UPDATE employees SET fte = 1.0 WHERE fte IS NULL`).run();
  },
};
