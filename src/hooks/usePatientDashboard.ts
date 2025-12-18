import { useCallback, useMemo, useState } from 'react';
import type { PatientConcerningRating, PatientStats } from '../shared/types';

type UsePatientDashboardProps = {
  handleError: (err: unknown) => void;
};

const usePatientDashboard = ({ handleError }: UsePatientDashboardProps) => {
  const [concerningRatings, setConcerningRatings] = useState<PatientConcerningRating[]>([]);
  const [patientStats, setPatientStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConcerningRatings = useCallback(
    async (limit = 10) => {
      try {
        const data = await window.api.getConcerningRatings(limit);
        setConcerningRatings(data);
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
      await Promise.all([loadConcerningRatings(), loadPatientStats()]);
    } finally {
      setLoading(false);
    }
  }, [loadConcerningRatings, loadPatientStats]);

  const actions = useMemo(
    () => ({
      loadConcerningRatings,
      loadPatientStats,
      loadAll,
    }),
    [loadConcerningRatings, loadPatientStats, loadAll],
  );

  return {
    state: {
      concerningRatings,
      patientStats,
      loading,
    },
    actions,
  };
};

export default usePatientDashboard;
