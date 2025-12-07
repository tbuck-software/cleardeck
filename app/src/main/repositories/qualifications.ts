/**
 * Qualifications Repository
 *
 * Data access functions for qualification types.
 */

import type { QualificationType } from '../../shared/types';

import { getDb } from '../database/connection';

/**
 * List all qualification types
 */
export const listQualifications = (): QualificationType[] => {
  const db = getDb();
  return db
    .prepare('SELECT id, name, sortOrder, note FROM qualification_types ORDER BY sortOrder ASC')
    .all() as QualificationType[];
};

/**
 * Add a new qualification type
 */
export const addQualification = (name: string, note?: string | null): QualificationType[] => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Qualifikationsname darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM qualification_types').get() as {
    mx: number | null;
  };
  const nextSort = (maxSort.mx ?? 0) + 1;
  db.prepare(
    'INSERT INTO qualification_types (name, sortOrder, note) VALUES (@name, @sortOrder, @note)',
  ).run({ name: trimmed, sortOrder: nextSort, note: note ?? null });
  return listQualifications();
};

/**
 * Update a qualification type
 */
export const updateQualification = (
  id: number,
  name: string,
  note?: string | null,
): QualificationType[] => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Qualifikationsname darf nicht leer sein.');
  }
  db.prepare('UPDATE qualification_types SET name = @name, note = @note WHERE id = @id').run({
    id,
    name: trimmed,
    note: note ?? null,
  });
  return listQualifications();
};

/**
 * Reorder qualification types
 */
export const reorderQualifications = (orderedIds: number[]): QualificationType[] => {
  const db = getDb();
  const update = db.prepare('UPDATE qualification_types SET sortOrder = ? WHERE id = ?');
  orderedIds.forEach((id, idx) => update.run(idx, id));
  return listQualifications();
};

/**
 * Delete a qualification type
 */
export const deleteQualification = (id: number): QualificationType[] => {
  const db = getDb();
  db.prepare('DELETE FROM qualification_types WHERE id = ?').run(id);
  return listQualifications();
};

