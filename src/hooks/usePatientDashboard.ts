import { useCallback, useMemo, useState } from 'react';
import type { PatientActionNeeded, PatientStats } from '../shared/types';

type UsePatientDashboardProps = {
  handleError: (err: unknown) => void;
};

const usePatientDashboard = ({ handleError }: UsePatientDashboardProps) => {
  const [actionNeeded, setActionNeeded] = useState<PatientActionNeeded[]>([]);
  const [patientStats, setPatientStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadActionNeeded = useCallback(
    async (limit = 10) => {
      try {
        const data = await window.api.getActionNeeded(limit);
        setActionNeeded(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const loadPatientStats = useCallback(async () => {
    try {
      const data = await window.api.getPatientStats();
      setPatientStats(data);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadActionNeeded(), loadPatientStats()]);
    } finally {
      setLoading(false);
    }
  }, [loadActionNeeded, loadPatientStats]);

  const actions = useMemo(
    () => ({
      loadActionNeeded,
      loadPatientStats,
      loadAll,
    }),
    [loadActionNeeded, loadPatientStats, loadAll],
  );

  return {
    state: {
      actionNeeded,
      patientStats,
      loading,
    },
    actions,
  };
};

export default usePatientDashboard;
