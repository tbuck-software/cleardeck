/// <reference types="vitest/globals" />

import { act, renderHook } from '@testing-library/react';
import useEmploymentActions from '../useEmploymentActions';
import api from '../../services/api';
import type { EmployeeWithPeriod, EmploymentPeriod, YearDataset } from '../../shared/types';
import type { FormState } from '../../types/ui';

vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    employees: {
      list: vi.fn(),
      listPeriods: vi.fn(),
      recordDeparture: vi.fn(),
      switchQualification: vi.fn(),
    },
  },
}));

const sourcePeriod: EmployeeWithPeriod = {
  id: 7,
  periodId: 10,
  name: 'Synthetic Directory Person',
  qualification: 'Pflegekraft',
  startDate: '2020-01-01',
  endDate: '2024-12-31',
  fte: 1,
  weeklyHours: 36,
  status: 'left',
};
const laterReentry: EmployeeWithPeriod = {
  ...sourcePeriod,
  periodId: 20,
  qualification: 'Pflegefachkraft',
  startDate: '2025-01-01',
  endDate: null,
  status: 'active',
};
const switchedPeriod: EmployeeWithPeriod = {
  ...sourcePeriod,
  periodId: 30,
  qualification: 'Einarbeitung',
  startDate: '2022-06-01',
};
const periodRecord = (employee: EmployeeWithPeriod): EmploymentPeriod => ({
  id: employee.periodId,
  employeeId: employee.id,
  startDate: employee.startDate,
  endDate: employee.endDate,
  qualification: employee.qualification,
});

const dataset = (employees: EmployeeWithPeriod[], reportMode: YearDataset['reportMode']): YearDataset => ({
  employees,
  aggregation: { totalHeadcount: employees.length, totalFte: employees.length, categories: [] },
  reportMode,
});

const createHook = (selectedEmployee: EmployeeWithPeriod = sourcePeriod) => {
  const setDataset = vi.fn();
  const setSelectedEmployee = vi.fn();
  const setForm = vi.fn<(updater: (previous: FormState) => FormState) => void>();
  const loadHistory = vi.fn().mockResolvedValue(undefined);
  const setLoading = vi.fn();
  const setToast = vi.fn();
  const hook = renderHook(() => useEmploymentActions({
    year: 2024,
    selectedEmployee,
    setDataset,
    setSelectedEmployee,
    setForm,
    loadHistory,
    setLoading,
    setToast,
  }));
  return { ...hook, setDataset, setSelectedEmployee, setForm, loadHistory, setLoading, setToast };
};

beforeEach(() => vi.clearAllMocks());

it('keeps the year dataset canonical and the departed historical period selected', async () => {
  const yearResult = dataset([], 'year');
  const directoryResult = dataset([laterReentry], 'directory');
  vi.mocked(api.employees.recordDeparture).mockResolvedValue(yearResult);
  vi.mocked(api.employees.list).mockResolvedValue(directoryResult);
  vi.mocked(api.employees.listPeriods).mockResolvedValue([
    periodRecord(laterReentry),
    periodRecord(sourcePeriod),
  ]);
  const { result, setDataset, setSelectedEmployee } = createHook();

  await act(async () => {
    await result.current.actions.save({ mode: 'departure', periodId: 10, endDate: '2023-12-31' });
  });

  expect(setDataset).toHaveBeenCalledWith(yearResult);
  expect(api.employees.list).toHaveBeenCalledWith(2024, 'directory');
  expect(api.employees.listPeriods).toHaveBeenCalledWith(7);
  expect(setSelectedEmployee).toHaveBeenCalledWith(sourcePeriod);
});

it('selects the newly created qualification period instead of a later reentry', async () => {
  const yearResult = dataset([laterReentry], 'year');
  const directoryResult = dataset([laterReentry], 'directory');
  vi.mocked(api.employees.switchQualification).mockResolvedValue(yearResult);
  vi.mocked(api.employees.list).mockResolvedValue(directoryResult);
  vi.mocked(api.employees.listPeriods).mockResolvedValue([
    periodRecord(laterReentry),
    periodRecord(switchedPeriod),
  ]);
  const { result, setDataset, setSelectedEmployee } = createHook();

  await act(async () => {
    await result.current.actions.save({
      mode: 'qualification',
      periodId: 10,
      effectiveFrom: '2022-06-01',
      qualification: 'Einarbeitung',
    });
  });

  expect(setDataset).toHaveBeenCalledWith(yearResult);
  expect(api.employees.listPeriods).toHaveBeenCalledWith(7);
  expect(setSelectedEmployee).toHaveBeenCalledWith(switchedPeriod);
});
