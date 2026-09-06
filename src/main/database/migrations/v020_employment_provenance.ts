import type { Migration } from './index';
export const v020_employment_provenance: Migration = {
  version: 20,
  description: 'Record employment evidence and correction history',
  up: (db) =>
    db.transaction(() => {
      db.exec('ALTER TABLE employment_terms ADD COLUMN sourceRef TEXT');
      db.exec(`CREATE TABLE employment_term_history (
      id INTEGER PRIMARY KEY,periodId INTEGER NOT NULL REFERENCES employment_periods(id) ON DELETE CASCADE,
      effectiveFrom TEXT NOT NULL,weeklyHours REAL,fte REAL,verified INTEGER,sourceRef TEXT,
      changedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
      db.exec(`INSERT INTO employment_term_history(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
      SELECT periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms`);
    })(),
};
