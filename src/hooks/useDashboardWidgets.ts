import { useCallback, useMemo, useState } from 'react';
import type {
  ExpiringTraining,
  BirthdayAnniversary,
} from '../shared/types';

type UseDashboardWidgetsProps = {
  handleError: (err: unknown) => void;
};

const useDashboardWidgets = ({ handleError }: UseDashboardWidgetsProps) => {
  const [expiringTrainings, setExpiringTrainings] = useState<ExpiringTraining[]>([]);
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
    async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadExpiringTrainings(),
          loadBirthdaysAnniversaries(),
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loadExpiringTrainings, loadBirthdaysAnniversaries]
  );

  const actions = useMemo(
    () => ({
      loadExpiringTrainings,
      loadBirthdaysAnniversaries,
      loadAll,
    }),
    [loadExpiringTrainings, loadBirthdaysAnniversaries, loadAll],
  );

  return {
    state: {
      expiringTrainings,
      birthdaysAnniversaries,
      loading,
    },
    actions,
  };
};

export default useDashboardWidgets;
