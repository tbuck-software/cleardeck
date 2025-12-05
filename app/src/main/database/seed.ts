/**
 * Database Seed Data
 *
 * Seeds the database with example data if no employees exist.
 * This is only run on fresh databases for demonstration purposes.
 */

import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Seed the database with example employees if empty
 */
export const seedDatabase = (db: DatabaseType): void => {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM employees').get() as { cnt: number };

  if (row.cnt > 0) {
    return; // Database already has data
  }

  const seed = db.transaction(() => {
    const emp = db.prepare(
      'INSERT INTO employees (name, qualification, dataSource, note, documentPath) VALUES (@name, @qualification, @dataSource, @note, @documentPath)',
    );
    const period = db.prepare(
      'INSERT INTO employment_periods (employeeId, startDate, endDate, fte, weeklyHours, qualification) VALUES (?, ?, ?, ?, ?, ?)',
    );

    // Example employee 1: Full-time team lead
    const anna = emp.run({
      name: 'Anna Beispiel',
      qualification: '3-jährig examiniert',
      dataSource: 'Verwaltungssoftware',
      note: 'Teamleitung 1',
      documentPath: '',
    }).lastInsertRowid as number;
    period.run(anna, '2021-05-01', null, 1.0, 36, '3-jährig examiniert');

    // Example employee 2: Part-time, left
    const max = emp.run({
      name: 'Max Mustermann',
      qualification: 'Pflegekraft/-helfer',
      dataSource: 'NAS',
      note: 'Teilzeit',
      documentPath: '',
    }).lastInsertRowid as number;
    period.run(max, '2020-03-15', '2024-03-31', 0.6, 21.6, 'Pflegekraft/-helfer');

    // Example employee 3: Part-time, active
    const lisa = emp.run({
      name: 'Lisa Referenz',
      qualification: '1-jährig examiniert',
      dataSource: 'Verwaltungssoftware',
      note: 'Fortbildung Wundmanagement',
      documentPath: '',
    }).lastInsertRowid as number;
    period.run(lisa, '2023-11-01', null, 0.8, 28.8, '1-jährig examiniert');
  });

  seed();
};
