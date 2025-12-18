/**
 * Departments Repository
 *
 * Data access functions for department entities.
 */

import type { Department } from '../../shared/types';

import { getDb } from '../database/connection';

/**
 * List all departments
 */
export const listDepartments = (): Department[] => {
  const db = getDb();
  return db
    .prepare('SELECT id, name, sortOrder, note FROM departments ORDER BY sortOrder ASC')
    .all() as Department[];
};

/**
 * Add a new department
 */
export const addDepartment = (name: string, note?: string | null): Department[] => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Abteilungsname darf nicht leer sein.');
  }
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM departments').get() as {
    mx: number | null;
  };
  const nextSort = (maxSort.mx ?? 0) + 1;
  db.prepare(
    'INSERT INTO departments (name, sortOrder, note) VALUES (@name, @sortOrder, @note)',
  ).run({ name: trimmed, sortOrder: nextSort, note: note ?? null });
  return listDepartments();
};

/**
 * Update a department
 */
export const updateDepartment = (
  id: number,
  name: string,
  note?: string | null,
): Department[] => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Abteilungsname darf nicht leer sein.');
  }

  // Get the old name before updating
  const oldDept = db.prepare('SELECT name FROM departments WHERE id = ?').get(id) as { name: string } | undefined;
  const oldName = oldDept?.name;

  // Update the department
  db.prepare('UPDATE departments SET name = @name, note = @note WHERE id = @id').run({
    id,
    name: trimmed,
    note: note ?? null,
  });

  // Update all employees that reference the old department name
  if (oldName && oldName !== trimmed) {
    db.prepare('UPDATE employees SET department = ? WHERE department = ?').run(trimmed, oldName);
  }

  return listDepartments();
};

/**
 * Reorder departments
 */
export const reorderDepartments = (orderedIds: number[]): Department[] => {
  const db = getDb();
  const update = db.prepare('UPDATE departments SET sortOrder = ? WHERE id = ?');
  orderedIds.forEach((id, idx) => update.run(idx, id));
  return listDepartments();
};

/**
 * Delete a department
 */
export const deleteDepartment = (id: number): Department[] => {
  const db = getDb();

  // Get the department name before deleting
  const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(id) as { name: string } | undefined;

  // Clear department from employees that reference it
  if (dept?.name) {
    db.prepare('UPDATE employees SET department = NULL WHERE department = ?').run(dept.name);
  }

  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  return listDepartments();
};
