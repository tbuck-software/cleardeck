import { localDate } from '../utils/calendarDate';
import { useCallback, useMemo, useState } from 'react';
import type {
  ExpiringTraining,
  BirthdayAnniversary,
  PatientBirthdayEvent,
  PatientVisitEvent,
  EmployeeDashboardStats,
  OpenInstruction,
} from '../shared/types';

type UseDashboardWidgetsProps = {
  handleError: (err: unknown) => void;
};

const useDashboardWidgets = ({ handleError }: UseDashboardWidgetsProps) => {
  const [expiringTrainings, setExpiringTrainings] = useState<ExpiringTraining[]>([]);
  const [birthdaysAnniversaries, setBirthdaysAnniversaries] = useState<BirthdayAnniversary[]>([]);
  const [patientBirthdays, setPatientBirthdays] = useState<PatientBirthdayEvent[]>([]);
  const [patientVisits, setPatientVisits] = useState<PatientVisitEvent[]>([]);
  const [employeeDashboardStats, setEmployeeDashboardStats] =
    useState<EmployeeDashboardStats | null>(null);
  const [openInstructions, setOpenInstructions] = useState<OpenInstruction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadExpiringTrainings = useCallback(
    async (withinDays = 90, limit = -1) => {
      try {
        const data = await window.api.getExpiringTrainings(withinDays, limit);
        setExpiringTrainings(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
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
    [handleError],
  );

  const loadPatientBirthdays = useCallback(
    async (withinDays = 30) => {
      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + withinDays);
        const data = await window.api.listPatientBirthdays(localDate(today), localDate(endDate));
        setPatientBirthdays(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const loadPatientVisits = useCallback(
    async (withinDays = 30) => {
      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + withinDays);
        const data = await window.api.listPatientVisitsInRange(
          localDate(today),
          localDate(endDate),
        );
        setPatientVisits(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const loadEmployeeDashboardStats = useCallback(
    async (dueSoonDays?: number, limit = 5) => {
      try {
        const data = await window.api.getEmployeeDashboardStats(dueSoonDays, limit);
        setEmployeeDashboardStats(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const loadOpenInstructions = useCallback(
    async (limit = -1) => {
      try {
        const data = await window.api.listOpenInstructions(limit);
        setOpenInstructions(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadExpiringTrainings(),
        loadBirthdaysAnniversaries(),
        loadPatientBirthdays(),
        loadPatientVisits(),
        loadEmployeeDashboardStats(),
        loadOpenInstructions(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    loadExpiringTrainings,
    loadBirthdaysAnniversaries,
    loadPatientBirthdays,
    loadPatientVisits,
    loadEmployeeDashboardStats,
    loadOpenInstructions,
  ]);

  const actions = useMemo(
    () => ({
      loadExpiringTrainings,
      loadBirthdaysAnniversaries,
      loadPatientBirthdays,
      loadPatientVisits,
      loadEmployeeDashboardStats,
      loadOpenInstructions,
      loadAll,
    }),
    [
      loadExpiringTrainings,
      loadBirthdaysAnniversaries,
      loadPatientBirthdays,
      loadPatientVisits,
      loadEmployeeDashboardStats,
      loadOpenInstructions,
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
      openInstructions,
      loading,
    },
    actions,
  };
};

export default useDashboardWidgets;
