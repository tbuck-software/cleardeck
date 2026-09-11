import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type { EmploymentIntegrityOverview } from '../shared/types';

export const emptyEmploymentIntegrity: EmploymentIntegrityOverview = {
  issues: [],
  employees: [],
  periods: [],
};

type UseEmploymentIntegrityParams = {
  enabled: boolean;
  /** Any reload of the team data is also the trigger for a fresh scan. */
  dataVersion: unknown;
  handleError: (err: unknown) => void;
};

/**
 * The employment scan is a cheap local SQLite read, so it runs with the data
 * instead of behind a menu entry. Dashboard tasks and the person's history
 * both read this one overview.
 */
const useEmploymentIntegrity = ({
  enabled,
  dataVersion,
  handleError,
}: UseEmploymentIntegrityParams) => {
  const [overview, setOverview] = useState<EmploymentIntegrityOverview>(emptyEmploymentIntegrity);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setOverview(await api.employment.integrityOverview());
    } catch (err) {
      handleError(err);
    }
  }, [enabled, handleError]);

  useEffect(() => {
    void refresh();
  }, [refresh, dataVersion]);

  return { overview, refresh };
};

export default useEmploymentIntegrity;
