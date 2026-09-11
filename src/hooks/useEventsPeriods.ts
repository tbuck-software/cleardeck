import { localDate } from '../utils/calendarDate';
import { useCallback, useMemo, useState } from 'react';
import api from '../services/api';
import type {
  EmploymentPeriod,
  EmployeeEvent,
  EmployeeEventType,
  EmployeeWithPeriod,
  QualificationType,
  YearDataset,
} from '../shared/types';
import type {
  AddPeriodFormState,
  ConfirmActionOptions,
  EventModalState,
  EventModalType,
  FormState,
  PeriodToDeleteState,
  TimelineItem,
} from '../types/ui';
import { applySelectedEmployee, reselectEmployee } from '../utils/selectedEmployee';

const typeLabels: Record<Exclude<EventModalType, 'period' | 'working-time'>, string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'fte-change': 'VZÄ-Änderung',
  'weekly-hours-change': 'Wochenstundenänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
};

type UseEventsPeriodsParams = {
  year: number;
  qualifications: QualificationType[];
  setForm: (updater: (prev: FormState) => FormState) => void;
  selectedEmployee: EmployeeWithPeriod | null;
  setSelectedEmployee: (emp: EmployeeWithPeriod | null) => void;
  setDataset: (
    updater: YearDataset | null | ((prev: YearDataset | null) => YearDataset | null),
  ) => void;
  handleError: (err: unknown) => void;
  setLoading: (val: boolean) => void;
  setToast: (msg: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    opts?: ConfirmActionOptions,
  ) => void;
};

const initialAddPeriodForm = (year: number, qualification: string): AddPeriodFormState => ({
  startDate: `${year}-01-01`,
  endDate: '',
  qualification,
  periodId: undefined,
  note: '',
});

const initialEventModal = (): EventModalState => ({
  open: false,
  id: undefined,
  eventDate: localDate(),
  type: 'period',
  title: '',
  details: '',
  previousValue: null,
  newValue: null,
  expiresAt: null,
});

const useEventsPeriods = ({
  year,
  qualifications,
  setForm,
  selectedEmployee,
  setSelectedEmployee,
  setDataset,
  handleError,
  setLoading,
  setToast,
  confirmAction,
}: UseEventsPeriodsParams) => {
  const [periods, setPeriods] = useState<EmploymentPeriod[]>([]);
  const [events, setEvents] = useState<EmployeeEvent[]>([]);
  const [addPeriodForm, setAddPeriodForm] = useState<AddPeriodFormState>(
    initialAddPeriodForm(year, qualifications[0]?.name ?? ''),
  );
  const [periodToDelete, setPeriodToDelete] = useState<PeriodToDeleteState>(null);
  const [eventModal, setEventModal] = useState<EventModalState>(initialEventModal());

  /** Throws on failure so a caller cannot report success on stale history. */
  const loadHistory = useCallback(async (employeeId: number) => {
    setPeriods(await api.employees.listPeriods(employeeId));
    setEvents(await api.employees.listEvents(employeeId));
  }, []);

  const syncSelectedFromDataset = useCallback(
    (data: YearDataset, id?: number) => {
      if (!id) return;
      const updated = data.employees.find((emp) => emp.id === id);
      if (updated) setSelectedEmployee(updated);
    },
    [setSelectedEmployee],
  );

  const openNewPeriodModal = useCallback(() => {
    if (!selectedEmployee) return;
    setAddPeriodForm(
      initialAddPeriodForm(year, qualifications[0]?.name ?? selectedEmployee.qualification),
    );
    setEventModal({ ...initialEventModal(), open: true });
  }, [qualifications, selectedEmployee, year]);

  const openExistingPeriodModal = useCallback(
    (period: EmploymentPeriod) => {
      if (!selectedEmployee) return;
      setAddPeriodForm({
        startDate: period.startDate,
        endDate: period.endDate ?? '',
        qualification: period.qualification ?? selectedEmployee.qualification,
        periodId: period.id,
        note: period.note ?? '',
      });
      setEventModal({ ...initialEventModal(), open: true });
    },
    [selectedEmployee],
  );

  const openEventModalForEvent = useCallback((ev: EmployeeEvent) => {
    setEventModal({
      open: true,
      id: ev.id,
      eventDate: ev.eventDate,
      type: ev.type as EmployeeEventType,
      title: ev.title,
      details: ev.details ?? '',
      previousValue: ev.previousValue ?? null,
      newValue: ev.newValue ?? null,
      expiresAt: ev.expiresAt ?? null,
    });
  }, []);

  const handleAddPeriod = useCallback(async () => {
    if (!selectedEmployee) return;
    if (!addPeriodForm.qualification || !addPeriodForm.startDate) return;
    setLoading(true);
    try {
      const payload = {
        id: selectedEmployee.id,
        name: selectedEmployee.name,
        qualification: addPeriodForm.qualification,
        note: selectedEmployee.note ?? '',
        weeklyHours: selectedEmployee.weeklyHours ?? null,
        startDate: addPeriodForm.startDate,
        endDate: addPeriodForm.endDate || null,
        fte: selectedEmployee.fte,
        birthDate: selectedEmployee.birthDate,
        updateHours: false,
        hoursVerified: false,
        periodId: addPeriodForm.periodId,
        year,
        periodNote: addPeriodForm.note ?? null,
      };
      const updated = await api.employees.save(payload);
      setDataset(updated);
      if (addPeriodForm.periodId && addPeriodForm.periodId === selectedEmployee.periodId) {
        const refreshed = await reselectEmployee(
          updated,
          (employee) =>
            employee.id === selectedEmployee.id && employee.periodId === selectedEmployee.periodId,
          async () => ({
            ...selectedEmployee,
            startDate: payload.startDate,
            endDate: payload.endDate,
            qualification: payload.qualification,
          }),
        );
        if (refreshed) applySelectedEmployee(refreshed, setSelectedEmployee, setForm);
      }
      await loadHistory(selectedEmployee.id ?? 0);
      setEventModal((prev) => ({ ...prev, open: false }));
      setToast(
        addPeriodForm.periodId
          ? 'Beschäftigungsperiode aktualisiert.'
          : 'Beschäftigungsperiode hinzugefügt.',
      );
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  }, [
    addPeriodForm.endDate,
    addPeriodForm.periodId,
    addPeriodForm.qualification,
    addPeriodForm.startDate,
    addPeriodForm.note,
    setForm,
    setSelectedEmployee,
    handleError,
    loadHistory,
    selectedEmployee,
    setDataset,
    setLoading,
    setToast,
    year,
  ]);

  const handleDeletePeriod = useCallback(async () => {
    if (!periodToDelete) return;
    setLoading(true);
    try {
      const updated = await api.periods.delete(periodToDelete.periodId, year);
      setDataset(updated);
      if (selectedEmployee?.id) {
        await loadHistory(selectedEmployee.id);
      }
      setToast('Periode gelöscht.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setPeriodToDelete(null);
      setEventModal((prev) => ({ ...prev, open: false }));
      setTimeout(() => setToast(null), 2000);
    }
  }, [
    handleError,
    loadHistory,
    periodToDelete,
    selectedEmployee,
    setDataset,
    setLoading,
    setToast,
    year,
  ]);

  const handleSaveEvent = useCallback(async () => {
    if (!selectedEmployee) return;
    if (eventModal.type === 'period') {
      await handleAddPeriod();
      return;
    }
    if (eventModal.type === 'working-time') return;
    if (!eventModal.eventDate) {
      handleError(new Error('Datum darf nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const title = typeLabels[eventModal.type];
      const list = await api.events.save({
        id: eventModal.id,
        employeeId: selectedEmployee.id ?? 0,
        eventDate: eventModal.eventDate,
        type: eventModal.type,
        title,
        details: eventModal.details.trim() ? eventModal.details.trim() : null,
        previousValue: eventModal.previousValue ?? null,
        newValue: eventModal.newValue ?? null,
        expiresAt: eventModal.expiresAt ?? null,
      });
      setEvents(list);
      const refreshed = await api.employees.list(year);
      setDataset(refreshed);
      syncSelectedFromDataset(refreshed, selectedEmployee.id);
      setToast('Ereignis gespeichert.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  }, [
    eventModal.details,
    eventModal.eventDate,
    eventModal.expiresAt,
    eventModal.id,
    eventModal.newValue,
    eventModal.previousValue,
    eventModal.type,
    handleAddPeriod,
    handleError,
    selectedEmployee,
    setDataset,
    setLoading,
    setToast,
    syncSelectedFromDataset,
    year,
  ]);

  const handleDeleteEvent = useCallback(
    (id: number) => {
      if (!selectedEmployee) return;
      confirmAction(
        'Ereignis wirklich löschen?',
        async () => {
          setLoading(true);
          try {
            const list = await api.events.delete(id, selectedEmployee.id ?? 0);
            setEvents(list);
            const refreshed = await api.employees.list(year);
            setDataset(refreshed);
            syncSelectedFromDataset(refreshed, selectedEmployee.id);
            setToast('Ereignis gelöscht.');
          } catch (err) {
            handleError(err);
          } finally {
            setLoading(false);
            setEventModal((prev) => ({ ...prev, open: false }));
            setTimeout(() => setToast(null), 2000);
          }
        },
        { confirmLabel: 'Löschen', danger: true },
      );
    },
    [
      confirmAction,
      handleError,
      selectedEmployee,
      setDataset,
      setLoading,
      setToast,
      syncSelectedFromDataset,
      year,
    ],
  );

  const timelineItems: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    periods.forEach((p) => items.push({ kind: 'period', date: p.startDate, record: p }));
    events.forEach((ev) => items.push({ kind: 'event', date: ev.eventDate, record: ev }));
    return items.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [periods, events]);

  return {
    state: {
      periods,
      events,
      addPeriodForm,
      eventModal,
      periodToDelete,
    },
    setters: {
      setAddPeriodForm,
      setEventModal,
      setPeriodToDelete,
    },
    derived: {
      timelineItems,
    },
    actions: {
      loadHistory,
      openNewPeriodModal,
      openExistingPeriodModal,
      openEventModalForEvent,
      handleAddPeriod,
      handleSaveEvent,
      handleDeleteEvent,
      handleDeletePeriod,
    },
  };
};

export default useEventsPeriods;
