import { useCallback, useState } from 'react';
import api from '../services/api';
import type { EmployeeWithPeriod, EmploymentPeriod, YearDataset } from '../shared/types';
import type { EmploymentActionInput, EmploymentActionMode, FormState } from '../types/ui';

type Params = {
  year: number;
  selectedEmployee: EmployeeWithPeriod | null;
  setDataset: (updater: YearDataset | null | ((prev: YearDataset | null) => YearDataset | null)) => void;
  setSelectedEmployee: (employee: EmployeeWithPeriod | null) => void;
  setForm: (updater: (prev: FormState) => FormState) => void;
  loadHistory: (employeeId: number) => Promise<void>;
  setLoading: (value: boolean) => void;
  setToast: (message: string | null, timeout?: number) => void;
};

type SelectionTarget =
  | { mode: 'departure'; periodId: number }
  | { mode: 'qualification'; effectiveFrom: string; qualification: string };

const findSelectionTarget = (
  dataset: YearDataset,
  employeeId: number,
  target: SelectionTarget,
): EmployeeWithPeriod | undefined =>
  dataset.employees.find((entry) => {
    if (entry.id !== employeeId) return false;
    if (target.mode === 'departure') return entry.periodId === target.periodId;
    return entry.startDate === target.effectiveFrom && entry.qualification === target.qualification;
  });

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
  setLoading,
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
    const current = findSelectionTarget(updated, employee.id ?? 0, target);
    let selected = current;
    if (!selected) {
      const period = findPeriodTarget(
        await api.employees.listPeriods(employee.id ?? 0),
        target,
      );
      if (period?.id != null) {
        selected = await api.employees.getEmployeePeriod(employee.id ?? 0, period.id, year);
      }
    }
    if (!selected) return;
    setSelectedEmployee(selected);
    setForm((previous) => ({
      ...previous,
      periodId: selected.periodId,
      qualification: selected.qualification,
      startDate: selected.startDate,
      endDate: selected.endDate ?? '',
      weeklyHours: selected.weeklyHours ?? null,
      fte: selected.fte,
    }));
  }, [setForm, setSelectedEmployee, year]);

  const save = useCallback(async (input: EmploymentActionInput) => {
    if (!selectedEmployee?.id) throw new Error('Person nicht gefunden.');
    setLoading(true);
    try {
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
      await loadHistory(selectedEmployee.id);
      setToast(input.mode === 'departure' ? 'Austritt erfasst.' : 'Qualifikation gewechselt.');
    } finally {
      setLoading(false);
    }
  }, [loadHistory, refreshSelected, selectedEmployee, setDataset, setLoading, setToast, year]);

  return { state, actions: { open, close, save } };
};

export default useEmploymentActions;
