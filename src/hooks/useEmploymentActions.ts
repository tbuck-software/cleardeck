import { useCallback, useState } from 'react';
import api from '../services/api';
import type { EmployeeWithPeriod, EmploymentPeriod, YearDataset } from '../shared/types';
import type { EmploymentActionInput, EmploymentActionMode, FormState } from '../types/ui';
import { applySelectedEmployee, reselectEmployee } from '../utils/selectedEmployee';

type Params = {
  year: number;
  selectedEmployee: EmployeeWithPeriod | null;
  setDataset: (updater: YearDataset | null | ((prev: YearDataset | null) => YearDataset | null)) => void;
  setSelectedEmployee: (employee: EmployeeWithPeriod | null) => void;
  setForm: (updater: (prev: FormState) => FormState) => void;
  loadHistory: (employeeId: number) => Promise<void>;
  setToast: (message: string | null, timeout?: number) => void;
};

type SelectionTarget =
  | { mode: 'departure'; periodId: number }
  | { mode: 'qualification'; effectiveFrom: string; qualification: string };

const matchesSelectionTarget = (
  entry: EmployeeWithPeriod,
  employeeId: number,
  target: SelectionTarget,
): boolean => {
  if (entry.id !== employeeId) return false;
  if (target.mode === 'departure') return entry.periodId === target.periodId;
  return entry.startDate === target.effectiveFrom && entry.qualification === target.qualification;
};

const findPeriodTarget = (
  periods: EmploymentPeriod[],
  target: SelectionTarget,
): EmploymentPeriod | undefined =>
  periods.find((period) => {
    if (target.mode === 'departure') return period.id === target.periodId;
    return period.startDate === target.effectiveFrom && period.qualification === target.qualification;
  });

const useEmploymentActions = ({
  year,
  selectedEmployee,
  setDataset,
  setSelectedEmployee,
  setForm,
  loadHistory,
  setToast,
}: Params) => {
  const [state, setState] = useState<{ open: boolean; mode: EmploymentActionMode }>({
    open: false,
    mode: 'departure',
  });

  const open = useCallback((mode: EmploymentActionMode) => {
    setState({ open: true, mode });
  }, []);
  const close = useCallback(() => setState((previous) => ({ ...previous, open: false })), []);

  const refreshSelected = useCallback(async (
    updated: YearDataset,
    employee: EmployeeWithPeriod,
    target: SelectionTarget,
  ) => {
    const employeeId = employee.id ?? 0;
    const selected = await reselectEmployee(
      updated,
      (entry) => matchesSelectionTarget(entry, employeeId, target),
      async () => {
        const period = findPeriodTarget(await api.employees.listPeriods(employeeId), target);
        return period?.id == null
          ? undefined
          : api.employees.getEmployeePeriod(employeeId, period.id, year);
      },
    );
    if (selected) applySelectedEmployee(selected, setSelectedEmployee, setForm);
  }, [setForm, setSelectedEmployee, year]);

  const save = useCallback(async (input: EmploymentActionInput) => {
    if (!selectedEmployee?.id) throw new Error('Person nicht gefunden.');
    let refreshedDataset: YearDataset;
    if (input.mode === 'departure') {
      refreshedDataset = await api.employees.recordDeparture({
        employeeId: selectedEmployee.id,
        periodId: input.periodId,
        endDate: input.endDate,
        year,
      });
    } else {
      refreshedDataset = await api.employees.switchQualification({
        employeeId: selectedEmployee.id,
        periodId: input.periodId,
        effectiveFrom: input.effectiveFrom,
        qualification: input.qualification,
        year,
      });
    }
    setDataset(refreshedDataset);
    await refreshSelected(
      refreshedDataset,
      selectedEmployee,
      input.mode === 'departure'
        ? { mode: input.mode, periodId: input.periodId }
        : {
            mode: input.mode,
            effectiveFrom: input.effectiveFrom,
            qualification: input.qualification.trim(),
          },
    );
    // A failing history reload must reach the dialog instead of a success toast.
    await loadHistory(selectedEmployee.id);
    setToast(input.mode === 'departure' ? 'Austritt erfasst.' : 'Qualifikation gewechselt.');
  }, [loadHistory, refreshSelected, selectedEmployee, setDataset, setToast, year]);

  return { state, actions: { open, close, save } };
};

export default useEmploymentActions;
