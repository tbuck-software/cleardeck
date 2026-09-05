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
  EmployeeDashboardStats,
  OpenInstruction,
  DefinitionUsage,
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

export const getEmployeeDashboardStats = (dueSoonDays = 30, limit = 5): EmployeeDashboardStats => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const dueSoonDate = new Date();
  dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);
  const dueSoonDateStr = dueSoonDate.toISOString().slice(0, 10);

  const activeEmployeesCte = `
    WITH active_employees AS (
      SELECT DISTINCT emp.id, emp.name
      FROM employees emp
      INNER JOIN employment_periods p ON p.employeeId = emp.id
      WHERE date(p.startDate) <= date(?)
        AND (p.endDate IS NULL OR date(p.endDate) >= date(?))
    )
  `;

  const instructionSummary = db
    .prepare(
      `
      ${activeEmployeesCte}
      SELECT
        COUNT(ei.id) as totalAssigned,
        SUM(CASE WHEN ei.completedAt IS NULL AND ei.dueDate IS NOT NULL AND date(ei.dueDate) < date(?) THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN ei.completedAt IS NULL AND ei.dueDate IS NOT NULL AND date(ei.dueDate) >= date(?) AND date(ei.dueDate) <= date(?) THEN 1 ELSE 0 END) as dueSoon,
        SUM(CASE WHEN ei.completedAt IS NOT NULL THEN 1 ELSE 0 END) as completedCount
      FROM employee_instructions ei
      INNER JOIN active_employees ae ON ae.id = ei.employeeId
    `
    )
    .get(today, today, today, today, dueSoonDateStr) as {
    totalAssigned: number | null;
    overdue: number | null;
    dueSoon: number | null;
    completedCount: number | null;
  };

  const topOpenEmployees = db
    .prepare(
      `
      ${activeEmployeesCte}
      SELECT
        ae.id as employeeId,
        ae.name as employeeName,
        SUM(CASE WHEN ei.completedAt IS NULL THEN 1 ELSE 0 END) as count
      FROM active_employees ae
      INNER JOIN employee_instructions ei ON ei.employeeId = ae.id
      GROUP BY ae.id, ae.name
      HAVING SUM(CASE WHEN ei.completedAt IS NULL THEN 1 ELSE 0 END) > 0
      ORDER BY count DESC, ae.name ASC
      LIMIT ?
    `
    )
    .all(today, today, limit) as {
    employeeId: number;
    employeeName: string;
    count: number;
  }[];

  const competencySummary = db
    .prepare(
      `
      ${activeEmployeesCte}
      SELECT
        COUNT(ec.id) as totalAssigned,
        SUM(CASE WHEN COALESCE(ec.level, 0) = 0 THEN 1 ELSE 0 END) as open,
        SUM(
          CASE
            WHEN COALESCE(ec.level, 0) > 0
              AND ec.approvedAt IS NULL
              AND COALESCE(ec.level, 0) < 4
            THEN 1
            ELSE 0
          END
        ) as pendingApproval,
        SUM(
          CASE
            WHEN ec.approvedAt IS NOT NULL OR COALESCE(ec.level, 0) >= 4
            THEN 1
            ELSE 0
          END
        ) as approvedCount
      FROM employee_competencies ec
      INNER JOIN active_employees ae ON ae.id = ec.employeeId
    `
    )
    .get(today, today) as {
    totalAssigned: number | null;
    open: number | null;
    pendingApproval: number | null;
    approvedCount: number | null;
  };

  const topGapEmployees = db
    .prepare(
      `
      ${activeEmployeesCte}
      SELECT
        ae.id as employeeId,
        ae.name as employeeName,
        SUM(
          CASE
            WHEN COALESCE(ec.level, 0) = 0
              OR (
                COALESCE(ec.level, 0) > 0
                AND ec.approvedAt IS NULL
                AND COALESCE(ec.level, 0) < 4
              )
            THEN 1
            ELSE 0
          END
        ) as count
      FROM active_employees ae
      INNER JOIN employee_competencies ec ON ec.employeeId = ae.id
      GROUP BY ae.id, ae.name
      HAVING SUM(
        CASE
          WHEN COALESCE(ec.level, 0) = 0
            OR (
              COALESCE(ec.level, 0) > 0
              AND ec.approvedAt IS NULL
              AND COALESCE(ec.level, 0) < 4
            )
          THEN 1
          ELSE 0
        END
      ) > 0
      ORDER BY count DESC, ae.name ASC
      LIMIT ?
    `
    )
    .all(today, today, limit) as {
    employeeId: number;
    employeeName: string;
    count: number;
  }[];

  const instructionTotal = instructionSummary.totalAssigned ?? 0;
  const instructionCompleted = instructionSummary.completedCount ?? 0;
  const competencyTotal = competencySummary.totalAssigned ?? 0;
  const competencyApproved = competencySummary.approvedCount ?? 0;

  return {
    instructions: {
      totalAssigned: instructionTotal,
      overdue: instructionSummary.overdue ?? 0,
      dueSoon: instructionSummary.dueSoon ?? 0,
      completedRate: instructionTotal > 0 ? Math.round((instructionCompleted / instructionTotal) * 100) : 0,
      topOpenEmployees,
    },
    competencies: {
      totalAssigned: competencyTotal,
      open: competencySummary.open ?? 0,
      pendingApproval: competencySummary.pendingApproval ?? 0,
      approvedRate: competencyTotal > 0 ? Math.round((competencyApproved / competencyTotal) * 100) : 0,
      topGapEmployees,
    },
  };
};

/**
 * Open Pflichtunterweisungen with the person attached — the dashboard task list
 * names who has to act, which the aggregate counts in EmployeeDashboardStats
 * deliberately do not.
 */
export const listOpenInstructions = (limit = 20): OpenInstruction[] => {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        ei.id as id,
        ei.employeeId as employeeId,
        e.name as employeeName,
        id_def.topic as topic,
        id_def.legalBasis as legalBasis,
        ei.dueDate as dueDate,
        CAST(julianday(ei.dueDate) - julianday(date('now')) AS INTEGER) as daysUntilDue
      FROM employee_instructions ei
      INNER JOIN employees e ON e.id = ei.employeeId
      INNER JOIN instruction_definitions id_def ON id_def.id = ei.instructionDefinitionId
      WHERE ei.completedAt IS NULL AND ei.dueDate IS NOT NULL
      ORDER BY ei.dueDate ASC
      LIMIT ?
    `,
    )
    .all(limit) as OpenInstruction[];
};

/**
 * How often each catalogue entry is actually assigned. The Verwaltung lists
 * show this so an entry is never deleted without seeing what it would take
 * with it.
 */
export const getDefinitionUsage = (): DefinitionUsage => {
  const db = getDb();
  const tally = (sql: string): Record<number, number> => {
    const rows = db.prepare(sql).all() as { id: number; count: number }[];
    return Object.fromEntries(rows.map((row) => [row.id, row.count]));
  };

  return {
    competencies: tally(
      'SELECT competencyDefinitionId as id, COUNT(*) as count FROM employee_competencies GROUP BY competencyDefinitionId',
    ),
    instructions: tally(
      'SELECT instructionDefinitionId as id, COUNT(*) as count FROM employee_instructions GROUP BY instructionDefinitionId',
    ),
  };
};
