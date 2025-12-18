/**
 * Dashboard Repository
 *
 * Data access functions for dashboard widgets:
 * - Expiring trainings/certifications
 * - Department statistics
 * - Birthdays and anniversaries
 */

import type {
  ExpiringTraining,
  BirthdayAnniversary,
} from '../../shared/types';

import { getDb } from '../database/connection';

/**
 * Get trainings/certifications that are expiring soon
 */
export const getExpiringTrainings = (
  withinDays = 90,
  limit = 10
): ExpiringTraining[] => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + withinDays);
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  const rows = db
    .prepare(
      `
      SELECT
        e.id,
        e.employeeId,
        emp.name as employeeName,
        e.type,
        e.title,
        e.eventDate,
        e.expiresAt
      FROM employee_events e
      INNER JOIN employees emp ON e.employeeId = emp.id
      INNER JOIN employment_periods p ON p.employeeId = emp.id
      WHERE e.expiresAt IS NOT NULL
        AND date(e.expiresAt) >= date(?)
        AND date(e.expiresAt) <= date(?)
        AND (p.endDate IS NULL OR date(p.endDate) >= date(?))
      GROUP BY e.id
      ORDER BY date(e.expiresAt) ASC
      LIMIT ?
    `
    )
    .all(today, futureDateStr, today, limit) as {
    id: number;
    employeeId: number;
    employeeName: string;
    type: string;
    title: string;
    eventDate: string;
    expiresAt: string;
  }[];

  return rows.map((row) => {
    const expiresDate = new Date(row.expiresAt);
    const todayDate = new Date(today);
    const daysUntilExpiry = Math.ceil(
      (expiresDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      type: row.type as ExpiringTraining['type'],
      title: row.title,
      eventDate: row.eventDate,
      expiresAt: row.expiresAt,
      daysUntilExpiry,
    };
  });
};

/**
 * Get upcoming birthdays and work anniversaries
 */
export const getBirthdaysAndAnniversaries = (
  withinDays = 30,
  limit = 10
): BirthdayAnniversary[] => {
  const db = getDb();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentYear = today.getFullYear();

  // Get active employees with birthDate or startDate
  const rows = db
    .prepare(
      `
      SELECT DISTINCT
        emp.id as employeeId,
        emp.name as employeeName,
        emp.birthDate,
        MIN(p.startDate) as startDate
      FROM employees emp
      INNER JOIN employment_periods p ON p.employeeId = emp.id
      WHERE (p.endDate IS NULL OR date(p.endDate) >= date(?))
      GROUP BY emp.id
    `
    )
    .all(todayStr) as {
    employeeId: number;
    employeeName: string;
    birthDate: string | null;
    startDate: string;
  }[];

  const results: BirthdayAnniversary[] = [];

  for (const row of rows) {
    // Check birthday
    if (row.birthDate) {
      const birthDate = new Date(row.birthDate);
      const birthYear = parseInt(row.birthDate.slice(0, 4), 10);
      const hasKnownYear = birthYear > 0;

      const thisYearBirthday = new Date(
        currentYear,
        birthDate.getMonth(),
        birthDate.getDate()
      );

      // If birthday has passed this year, check next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(currentYear + 1);
      }

      const daysUntil = Math.ceil(
        (thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil >= 0 && daysUntil <= withinDays) {
        const entry: BirthdayAnniversary = {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          type: 'birthday',
          date: thisYearBirthday.toISOString().slice(0, 10),
          displayDate: `${birthDate.getDate()}.${birthDate.getMonth() + 1}.`,
        };

        // Only include age if birth year is known
        if (hasKnownYear) {
          entry.age = thisYearBirthday.getFullYear() - birthYear;
        }

        results.push(entry);
      }
    }

    // Check work anniversary
    if (row.startDate) {
      const startDate = new Date(row.startDate);
      const yearsWorked = currentYear - startDate.getFullYear();

      // Only show anniversaries for 1+ years
      if (yearsWorked >= 1) {
        const thisYearAnniversary = new Date(
          currentYear,
          startDate.getMonth(),
          startDate.getDate()
        );

        // If anniversary has passed this year, check next year
        let anniversaryYear = currentYear;
        if (thisYearAnniversary < today) {
          thisYearAnniversary.setFullYear(currentYear + 1);
          anniversaryYear = currentYear + 1;
        }

        const daysUntil = Math.ceil(
          (thisYearAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntil >= 0 && daysUntil <= withinDays) {
          const years = anniversaryYear - startDate.getFullYear();
          results.push({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            type: 'anniversary',
            date: thisYearAnniversary.toISOString().slice(0, 10),
            displayDate: `${startDate.getDate()}.${startDate.getMonth() + 1}.`,
            years,
          });
        }
      }
    }
  }

  // Sort by date and limit
  results.sort((a, b) => a.date.localeCompare(b.date));
  return results.slice(0, limit);
};
