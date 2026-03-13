import { useCallback, useMemo, useState } from 'react';
import type {
  ExpiringTraining,
  BirthdayAnniversary,
  PatientBirthdayEvent,
  PatientVisitEvent,
  EmployeeDashboardStats,
} from '../shared/types';

type UseDashboardWidgetsProps = {
  handleError: (err: unknown) => void;
};

const useDashboardWidgets = ({ handleError }: UseDashboardWidgetsProps) => {
  const [expiringTrainings, setExpiringTrainings] = useState<ExpiringTraining[]>([]);
  const [birthdaysAnniversaries, setBirthdaysAnniversaries] = useState<BirthdayAnniversary[]>([]);
  const [patientBirthdays, setPatientBirthdays] = useState<PatientBirthdayEvent[]>([]);
  const [patientVisits, setPatientVisits] = useState<PatientVisitEvent[]>([]);
  const [employeeDashboardStats, setEmployeeDashboardStats] = useState<EmployeeDashboardStats | null>(null);
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

  const loadPatientBirthdays = useCallback(
    async (withinDays = 30) => {
      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + withinDays);
        const data = await window.api.listPatientBirthdays(
          today.toISOString().slice(0, 10),
          endDate.toISOString().slice(0, 10),
        );
        setPatientBirthdays(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const loadPatientVisits = useCallback(
    async (withinDays = 30) => {
      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + withinDays);
        const data = await window.api.listPatientVisitsInRange(
          today.toISOString().slice(0, 10),
          endDate.toISOString().slice(0, 10),
        );
        setPatientVisits(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError]
  );

  const loadEmployeeDashboardStats = useCallback(
    async (dueSoonDays = 30, limit = 5) => {
      try {
        const data = await window.api.getEmployeeDashboardStats(dueSoonDays, limit);
        setEmployeeDashboardStats(data);
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
          loadPatientBirthdays(),
          loadPatientVisits(),
          loadEmployeeDashboardStats(),
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      loadExpiringTrainings,
      loadBirthdaysAnniversaries,
      loadPatientBirthdays,
      loadPatientVisits,
      loadEmployeeDashboardStats,
    ]
  );

  const actions = useMemo(
    () => ({
      loadExpiringTrainings,
      loadBirthdaysAnniversaries,
      loadPatientBirthdays,
      loadPatientVisits,
      loadEmployeeDashboardStats,
      loadAll,
    }),
    [
      loadExpiringTrainings,
      loadBirthdaysAnniversaries,
      loadPatientBirthdays,
      loadPatientVisits,
      loadEmployeeDashboardStats,
      loadAll,
    ],
  );

  return {
    state: {
      expiringTrainings,
      birthdaysAnniversaries,
      patientBirthdays,
      patientVisits,
      employeeDashboardStats,
      loading,
    },
    actions,
  };
};

export default useDashboardWidgets;
