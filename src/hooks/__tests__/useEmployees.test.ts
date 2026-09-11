/// <reference types="vitest/globals" />

import { act, renderHook } from '@testing-library/react';
import useEmployees from '../useEmployees';
import useEventsPeriods from '../useEventsPeriods';
import api from '../../services/api';
import type { EmployeeWithPeriod, YearDataset } from '../../shared/types';

vi.mock('../../services/api', () => ({
  default: {
    employees: { save: vi.fn(), list: vi.fn(), listPeriods: vi.fn(), listEvents: vi.fn() },
    competencies: { listEmployee: vi.fn().mockResolvedValue([]) },
    instructions: { listEmployee: vi.fn().mockResolvedValue([]) },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

const createHook = () =>
  renderHook(() =>
    useEmployees({
      year: 2024,
      currentYear: 2024,
      baseHours: 36,
      handleError: noop,
      setLoading: noop,
      setToast: noop,
      confirmAction: noop,
    }),
  );

describe('useEmployees.averageFte', () => {
  it('berechnet den Durchschnitt aus Aggregation', () => {
    const { result } = createHook();
    const dataset: YearDataset = {
      employees: [],
      aggregation: { totalHeadcount: 5, totalFte: 3.5, categories: [] },
    };

    act(() => {
      result.current.setters.setDataset(dataset);
    });

    expect(result.current.derived.averageFte).toBeCloseTo(0.7);
  });

  it('liefert 0 bei fehlender Kopfzahl', () => {
    const { result } = createHook();
    const dataset: YearDataset = {
      employees: [],
      aggregation: { totalHeadcount: 0, totalFte: 4, categories: [] },
    };

    act(() => {
      result.current.setters.setDataset(dataset);
    });

    expect(result.current.derived.averageFte).toBe(0);
  });
});


const employee: EmployeeWithPeriod = {
  id: 1, periodId: 10, name: 'Arbeitszeit Test', qualification: 'Pflegekraft',
  startDate: '2025-03-01', employmentStartDate: '2025-03-01', endDate: null, weeklyHours: 36, fte: 1,
  status: 'active', hoursEffectiveFrom: '2025-03-01', hoursVerified: false,
};
const datasetFor = (person: EmployeeWithPeriod): YearDataset => ({
  employees: [person], aggregation: { totalHeadcount: 1, totalFte: person.fte, categories: [] },
});

describe('working-time edits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
    vi.mocked(api.employees.save).mockResolvedValue(datasetFor(employee));
    vi.mocked(api.employees.listPeriods).mockResolvedValue([]);
    vi.mocked(api.employees.listEvents).mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { hoursEffectiveFrom: '2025-03-02' },
    { weeklyHours: '18', fteValue: '0.5' },
  ])('saves explicit working-time changes without a confirmation checkbox: %j', async (change) => {
    const { result } = createHook();
    await act(() => result.current.actions.handleSelect(employee));
    act(() => result.current.actions.openEditModal());
    act(() => result.current.setters.setEditModal(prev => ({ ...prev, ...change })));
    await act(() => result.current.actions.handleEditModalSave());
    expect(api.employees.save).toHaveBeenCalledWith(expect.objectContaining({
      updateHours: true, hoursVerified: true,
    }));
  });

  it('does not confirm inherited hours when only the name changes', async () => {
    const { result } = createHook();
    await act(() => result.current.actions.handleSelect(employee));
    act(() => result.current.actions.openEditModal());
    act(() => result.current.setters.setEditModal(prev => ({ ...prev, name: 'Neuer Name' })));
    await act(() => result.current.actions.handleEditModalSave());
    expect(api.employees.save).toHaveBeenCalledWith(expect.objectContaining({ updateHours: false }));
  });

  it.each([true, false])('uses the corrected boundary immediately (period in year dataset: %s)', async (inYear) => {
    const corrected = { ...employee, startDate: '2024-09-01' };
    vi.mocked(api.employees.save).mockResolvedValue(inYear ? datasetFor(corrected) : {
      employees: [], aggregation: { totalHeadcount: 0, totalFte: 0, categories: [] },
    });
    vi.mocked(api.employees.list).mockResolvedValue(datasetFor(corrected));
    const { result } = renderHook(() => {
      const people = useEmployees({ year: 2026, currentYear: 2026, baseHours: 36,
        handleError: noop, setLoading: noop, setToast: noop, confirmAction: noop });
      const history = useEventsPeriods({ year: 2026, qualifications: [],
        setForm: people.setters.setForm,
        selectedEmployee: people.state.selectedEmployee,
        setSelectedEmployee: people.setters.setSelectedEmployee,
        setDataset: people.setters.setDataset,
        handleError: noop, setLoading: noop, setToast: noop, confirmAction: noop });
      return { people, history };
    });
    await act(() => result.current.people.actions.handleSelect(employee));
    act(() => result.current.history.actions.openExistingPeriodModal({
      id: employee.periodId, startDate: employee.startDate, endDate: null, qualification: employee.qualification,
    }));
    act(() => result.current.history.setters.setAddPeriodForm(prev => ({ ...prev, startDate: '2024-09-01' })));
    await act(() => result.current.history.actions.handleAddPeriod());
    act(() => result.current.people.actions.openEditModal());
    expect(result.current.people.state.form.startDate).toBe('2024-09-01');
    expect(result.current.people.state.selectedEmployee?.startDate).toBe('2024-09-01');
    act(() => result.current.people.setters.setEditModal(prev => ({ ...prev, hoursEffectiveFrom: '2025-01-01' })));
    await act(() => result.current.people.actions.handleEditModalSave());
    expect(api.employees.save).toHaveBeenLastCalledWith(expect.objectContaining({
      periodId: 10, startDate: '2024-09-01', hoursEffectiveFrom: '2025-01-01', updateHours: true,
    }));
  });
});
