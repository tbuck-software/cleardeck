import { useCallback, useState } from 'react';
import api from '../services/api';
import type { EmployeeWithPeriod, YearDataset } from '../shared/types';
import type { FormState } from '../types/ui';
import type { EmploymentActionInput, EmploymentActionMode } from '../components/modals/EmploymentActionModal';

type Params = {
  year: number;
  selectedEmployee: EmployeeWithPeriod | null;
  setDataset: (updater: YearDataset | null | ((prev: YearDataset | null) => YearDataset | null)) => void;
  setSelectedEmployee: (employee: EmployeeWithPeriod | null) => void;
  setForm: (updater: (prev: FormState) => FormState) => void;
  loadHistory: (employeeId: number) => Promise<void>;
  setLoading: (value: boolean) => void;
  setToast: (message: string | null, timeout?: number) => void;
  datasetMode: 'year' | 'directory';
};

const useEmploymentActions = ({
  year,
  selectedEmployee,
  setDataset,
  setSelectedEmployee,
  setForm,
  loadHistory,
  setLoading,
  setToast,
  datasetMode,
}: Params) => {
  const [state, setState] = useState<{ open: boolean; mode: EmploymentActionMode }>({
    open: false,
    mode: 'departure',
  });

  const open = useCallback((mode: EmploymentActionMode) => {
    setState({ open: true, mode });
  }, []);
  const close = useCallback(() => setState((previous) => ({ ...previous, open: false })), []);

  const refreshSelected = useCallback(async (updated: YearDataset, employee: EmployeeWithPeriod) => {
    const current = updated.employees.find(
      (entry) => entry.id === employee.id && entry.periodId === employee.periodId,
    );
    const directory = current ?? (await api.employees.list(year, 'directory')).employees.find(
      (entry) => entry.id === employee.id,
    );
    if (!directory) return;
    setSelectedEmployee(directory);
    setForm((previous) => ({
      ...previous,
      periodId: directory.periodId,
      qualification: directory.qualification,
      startDate: directory.startDate,
      endDate: directory.endDate ?? '',
      weeklyHours: directory.weeklyHours ?? null,
      fte: directory.fte,
    }));
  }, [setForm, setSelectedEmployee, year]);

  const save = useCallback(async (input: EmploymentActionInput) => {
    if (!selectedEmployee?.id) throw new Error('Person nicht gefunden.');
    setLoading(true);
    try {
      if (input.mode === 'departure') {
        await api.employees.recordDeparture({
            employeeId: selectedEmployee.id,
            periodId: input.periodId,
            endDate: input.endDate,
            year,
          });
      } else {
        await api.employees.switchQualification({
            employeeId: selectedEmployee.id,
            periodId: input.periodId,
            effectiveFrom: input.effectiveFrom,
            qualification: input.qualification,
            year,
          });
      }
      const refreshedDataset = await api.employees.list(year, datasetMode);
      setDataset(refreshedDataset);
      await refreshSelected(refreshedDataset, selectedEmployee);
      await loadHistory(selectedEmployee.id);
      setToast(input.mode === 'departure' ? 'Austritt erfasst.' : 'Qualifikation gewechselt.');
    } finally {
      setLoading(false);
    }
  }, [datasetMode, loadHistory, refreshSelected, selectedEmployee, setDataset, setLoading, setToast, year]);

  return { state, actions: { open, close, save } };
};

export default useEmploymentActions;
