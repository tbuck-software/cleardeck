import type { Migration } from './index';

// Per period, because trainees change qualification by starting a new period.
// No backfill: existing totals only change after an explicit choice.
export const v025_fte_total_exclusion: Migration = {
  version: 25,
  description: 'Allow employment periods to be left out of the FTE total',
  up: (db) => {
    const columns = db.prepare("PRAGMA table_info('employment_periods')").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'excludeFromFteTotal'))
      db.exec('ALTER TABLE employment_periods ADD COLUMN excludeFromFteTotal INTEGER NOT NULL DEFAULT 0');
  },
};
