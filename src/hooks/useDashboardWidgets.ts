import { useCallback, useState } from 'react';
import type {
  ExpiringTraining,
  DepartmentStats,
  BirthdayAnniversary,
} from '../shared/types';

type UseDashboardWidgetsProps = {
  handleError: (err: unknown) => void;
};

const useDashboardWidgets = ({ handleError }: UseDashboardWidgetsProps) => {
  const [expiringTrainings, setExpiringTrainings] = useState<ExpiringTraining[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [birthdaysAnniversaries, setBirthdaysAnniversaries] = useState<BirthdayAnniversary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadExpiringTrainings = useCallback(
    async (withinDays = 90, limit = 10) => {
      try {
        const data = await window.api.getExpiringTrainings(withinDays, limit);
        setExpiringTrainings(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const loadDepartmentStats = useCallback(
    async (year: number) => {
      try {
        const data = await window.api.getDepartmentStats(year);
        setDepartmentStats(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const loadBirthdaysAnniversaries = useCallback(
    async (withinDays = 30, limit = 10) => {
      try {
        const data = await window.api.getBirthdaysAndAnniversaries(withinDays, limit);
        setBirthdaysAnniversaries(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const loadAll = useCallback(
    async (year: number) => {
      setLoading(true);
      try {
        await Promise.all([
          loadExpiringTrainings(),
          loadDepartmentStats(year),
          loadBirthdaysAnniversaries(),
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loadExpiringTrainings, loadDepartmentStats, loadBirthdaysAnniversaries]
  );

  return {
    state: {
      expiringTrainings,
      departmentStats,
      birthdaysAnniversaries,
      loading,
    },
    actions: {
      loadExpiringTrainings,
      loadDepartmentStats,
      loadBirthdaysAnniversaries,
      loadAll,
    },
  };
};

export default useDashboardWidgets;
