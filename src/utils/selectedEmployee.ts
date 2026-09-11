import type { EmployeeWithPeriod, YearDataset } from '../shared/types';
import type { FormState } from '../types/ui';

/**
 * Re-select the same person after a save.
 *
 * The refreshed year dataset does not always contain the period that was just
 * written — a departed or historical period drops out of the year view — so
 * callers pass the lookup to use for that case.
 */
export const reselectEmployee = async (
  dataset: YearDataset | null,
  match: (employee: EmployeeWithPeriod) => boolean,
  fallback: () => Promise<EmployeeWithPeriod | undefined>,
): Promise<EmployeeWithPeriod | undefined> =>
  dataset?.employees.find(match) ?? (await fallback());

/** Move the selection and the employee form onto the given period together. */
export const applySelectedEmployee = (
  employee: EmployeeWithPeriod,
  setSelectedEmployee: (value: EmployeeWithPeriod | null) => void,
  setForm: (updater: (previous: FormState) => FormState) => void,
): void => {
  setSelectedEmployee(employee);
  setForm((previous) => ({
    ...previous,
    periodId: employee.periodId,
    qualification: employee.qualification,
    startDate: employee.startDate,
    endDate: employee.endDate ?? '',
    weeklyHours: employee.weeklyHours ?? null,
    fte: employee.fte,
  }));
};
