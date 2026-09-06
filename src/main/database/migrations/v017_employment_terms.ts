import type { Migration } from './index';

export const v017_employment_terms: Migration = {
  version: 17,
  description: 'Preserve effective employment terms and flag legacy values for verification',
  up: (db) => {
    db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS employment_terms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periodId INTEGER NOT NULL REFERENCES employment_periods(id) ON DELETE CASCADE,
        effectiveFrom TEXT NOT NULL,
        weeklyHours REAL,
        fte REAL NOT NULL CHECK(fte >= 0 AND fte <= 1),
        verified INTEGER NOT NULL DEFAULT 0,
        UNIQUE(periodId, effectiveFrom)
      )`);
      // An explicit exit can close a matching open period. Keep event records
      // as evidence; do not move earlier periods to a later re-entry date.
      const exits = db
        .prepare(
          "SELECT employeeId, eventDate FROM employee_events WHERE type='leave' ORDER BY eventDate",
        )
        .all() as { employeeId: number; eventDate: string }[];
      for (const exit of exits) {
        const matches = db
          .prepare(
            'SELECT id FROM employment_periods WHERE employeeId=? AND startDate<=? AND (endDate IS NULL OR endDate>=?) ORDER BY startDate DESC',
          )
          .all(exit.employeeId, exit.eventDate, exit.eventDate) as { id: number }[];
        if (matches.length === 1)
          db.prepare('UPDATE employment_periods SET endDate=? WHERE id=?').run(
            exit.eventDate,
            matches[0].id,
          );
      }
      const joins = db
        .prepare(
          "SELECT employeeId, eventDate FROM employee_events WHERE type='join' ORDER BY eventDate",
        )
        .all() as { employeeId: number; eventDate: string }[];
      for (const join of joins) {
        const match = db
          .prepare(
            'SELECT id FROM employment_periods WHERE employeeId=? AND startDate<=? AND (endDate IS NULL OR endDate>=?)',
          )
          .get(join.employeeId, join.eventDate, join.eventDate);
        const previous = db
          .prepare(
            'SELECT qualification FROM employment_periods WHERE employeeId=? AND endDate<? ORDER BY endDate DESC LIMIT 1',
          )
          .get(join.employeeId, join.eventDate) as { qualification: string } | undefined;
        if (!match && previous)
          db.prepare(
            'INSERT INTO employment_periods(employeeId,startDate,qualification,note) VALUES (?,?,?,?)',
          ).run(
            join.employeeId,
            join.eventDate,
            previous.qualification,
            'Aus bisherigem Eintrittsereignis übernommen. Qualifikation und Stunden prüfen.',
          );
      }
      // Old releases did not preserve effective dates. Retain their values as
      // unverified, rather than inventing historical certainty or deleting them.
      db.exec(`INSERT OR IGNORE INTO employment_terms(periodId,effectiveFrom,weeklyHours,fte,verified)
        SELECT p.id,p.startDate,e.weeklyHours,MAX(0,MIN(1,COALESCE(e.fte,0))),0
        FROM employment_periods p JOIN employees e ON e.id=p.employeeId`);
    })();
  },
};
