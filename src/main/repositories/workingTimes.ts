import { getDb } from '../database/connection';
import { localDate, requireDate, shiftDays } from '../../utils/calendarDate';
import type { SaveWorkingTimeInput, WorkingTime } from '../../shared/types';

export const listWorkingTimes = (employeeId: number): WorkingTime[] => {
  const rows = getDb().prepare(`
    SELECT t.id,t.periodId,t.effectiveFrom,t.weeklyHours,t.fte,p.endDate AS periodEnd
    FROM employment_terms t JOIN employment_periods p ON p.id=t.periodId
    WHERE p.employeeId=? ORDER BY t.effectiveFrom,t.id
  `).all(employeeId) as (Omit<WorkingTime, 'effectiveUntil'> & { periodEnd: string | null })[];
  return rows.map((row, index) => {
    const next = rows[index + 1];
    const end = next && next.periodId === row.periodId
      ? shiftDays(next.effectiveFrom, -1)
      : row.periodEnd;
    return {
      id: row.id, periodId: row.periodId, effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.periodEnd && end && row.periodEnd < end ? row.periodEnd : end,
      weeklyHours: row.weeklyHours, fte: row.fte,
    };
  }).reverse();
};

/** Correct one working-time entry without editing employment or qualification. */
export const saveWorkingTime = (input: SaveWorkingTimeInput): void => {
  requireDate(input.effectiveFrom, 'Gültig ab');
  if (!Number.isInteger(input.employeeId) || input.employeeId <= 0)
    throw new Error('Person nicht gefunden.');
  if (!Number.isFinite(input.fte) || input.fte < 0 || input.fte > 1)
    throw new Error('VZÄ muss zwischen 0 und 1 liegen.');
  if (input.weeklyHours !== null &&
      (!Number.isFinite(input.weeklyHours) || input.weeklyHours < 0 || input.weeklyHours > 168))
    throw new Error('Wochenstunden müssen zwischen 0 und 168 liegen.');
  const db = getDb();
  db.transaction(() => {
    const previous = input.id == null ? undefined : db.prepare(`
      SELECT t.* FROM employment_terms t JOIN employment_periods p ON p.id=t.periodId
      WHERE t.id=? AND p.employeeId=?
    `).get(input.id, input.employeeId) as {
      id: number; periodId: number; effectiveFrom: string; weeklyHours: number | null;
      fte: number; verified: number; sourceRef: string | null;
    } | undefined;
    if (input.id != null && !previous) throw new Error('Arbeitszeitstand nicht gefunden.');
    const periods = db.prepare(`SELECT id FROM employment_periods
      WHERE employeeId=? AND startDate<=? AND (endDate IS NULL OR endDate>=?)
    `).all(input.employeeId, input.effectiveFrom, input.effectiveFrom) as { id: number }[];
    if (periods.length !== 1)
      throw new Error('Das Datum muss innerhalb einer Beschäftigungsperiode liegen.');
    const periodId = periods[0].id;
    const collision = db.prepare(`SELECT id FROM employment_terms
      WHERE periodId=? AND effectiveFrom=? AND id<>?
    `).get(periodId, input.effectiveFrom, input.id ?? -1);
    if (collision) throw new Error('Für dieses Datum gibt es bereits einen Arbeitszeitstand. Bitte diesen bearbeiten.');
    if (previous && previous.periodId === periodId && previous.effectiveFrom === input.effectiveFrom &&
        previous.weeklyHours === input.weeklyHours && previous.fte === input.fte && previous.verified === 1) return;
    if (previous) {
      db.prepare('UPDATE employment_terms SET periodId=?,effectiveFrom=?,weeklyHours=?,fte=?,verified=1 WHERE id=?')
        .run(periodId, input.effectiveFrom, input.weeklyHours, input.fte, previous.id);
    } else {
      db.prepare('INSERT INTO employment_terms(periodId,effectiveFrom,weeklyHours,fte,verified) VALUES (?,?,?,?,1)')
        .run(periodId, input.effectiveFrom, input.weeklyHours, input.fte);
    }
    db.prepare(`INSERT INTO employment_term_history(periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef)
      VALUES (?,?,?,?,1,?)`).run(periodId, input.effectiveFrom, input.weeklyHours, input.fte, previous?.sourceRef ?? null);
    const current = db.prepare(`SELECT t.fte,t.weeklyHours FROM employment_terms t
      JOIN employment_periods p ON p.id=t.periodId WHERE p.employeeId=? AND t.effectiveFrom<=?
      ORDER BY t.effectiveFrom DESC LIMIT 1`).get(input.employeeId, localDate()) as
      { fte: number; weeklyHours: number | null } | undefined;
    if (current) db.prepare('UPDATE employees SET fte=?,weeklyHours=? WHERE id=?')
      .run(current.fte, current.weeklyHours, input.employeeId);
  })();
};
