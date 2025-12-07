/// <reference types="vitest/globals" />

import { act, renderHook } from '@testing-library/react';
import useEmployees from '../useEmployees';
import type { YearDataset } from '../../shared/types';

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

