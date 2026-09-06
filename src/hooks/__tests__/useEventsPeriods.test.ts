/// <reference types="vitest/globals" />

import { act, renderHook, waitFor } from '@testing-library/react';
import useEventsPeriods from '../useEventsPeriods';
import type { EmploymentPeriod, EmployeeEvent, EmployeeWithPeriod, YearDataset } from '../../shared/types';

const listPeriodsMock = vi.fn<(employeeId: number) => Promise<EmploymentPeriod[]>>();
const listEventsMock = vi.fn<(employeeId: number) => Promise<EmployeeEvent[]>>();

vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    employees: {
      listPeriods: (...args: unknown[]) => listPeriodsMock(...(args as [number])),
      listEvents: (...args: unknown[]) => listEventsMock(...(args as [number])),
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    events: {
      save: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const selectedEmployee: EmployeeWithPeriod = {
  id: 1,
  name: 'Test User',
  qualification: 'Pflegekraft',
  startDate: '2024-01-10',
  endDate: null,
  fte: 1,
  status: 'active',
  createdAt: '2023-12-15',
};

describe('useEventsPeriods timeline', () => {
  it('sortiert Timeline-Items absteigend und nutzt Join-Datum als Start', async () => {
    listPeriodsMock.mockResolvedValue([
      { startDate: '2024-02-01', endDate: null, qualification: 'Pflegekraft' },
    ]);
    listEventsMock.mockResolvedValue([
      { eventDate: '2024-03-01', type: 'name-change', title: 'Namensänderung' },
      { eventDate: '2024-01-05', type: 'join', title: 'Einstieg' },
    ]);

    const { result } = renderHook(() =>
      useEventsPeriods({
        year: 2024,
        qualifications: [{ name: 'Pflegekraft' }],
        setForm: vi.fn(),
        selectedEmployee,
        setSelectedEmployee: vi.fn(),
        setDataset: vi.fn<(value: YearDataset | null | ((prev: YearDataset | null) => YearDataset | null)) => void>(),
        handleError: vi.fn(),
        setLoading: vi.fn(),
        setToast: vi.fn(),
        confirmAction: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.actions.loadHistory(1);
    });

    await waitFor(() => {
      expect(result.current.derived.timelineItems.length).toBe(3);
    });

    expect(result.current.derived.timelineItems.map((item) => item.date)).toEqual([
      '2024-03-01',
      '2024-02-01',
      '2024-01-05',
    ]);
    expect(result.current.derived.displayStart).toBe('2024-01-05');
  });
});
