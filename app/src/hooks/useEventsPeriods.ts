import { useCallback, useMemo, useState } from 'react';
import type {
  EmploymentPeriod,
  EmployeeEvent,
  EmployeeWithPeriod,
  QualificationType,
  YearDataset,
} from '../shared/types';
import type { AddPeriodFormState, EventModalState, FormState, TimelineItem } from '../types/ui';

type UseEventsPeriodsParams = {
  year: number;
  qualifications: QualificationType[];
  form: FormState;
  selectedEmployee: EmployeeWithPeriod | null;
  setSelectedEmployee: (emp: EmployeeWithPeriod | null) => void;
  setDataset: (updater: YearDataset | null | ((prev: YearDataset | null) => YearDataset | null)) => void;
  handleError: (err: unknown) => void;
  setLoading: (val: boolean) => void;
  setToast: (msg: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    opts?: { confirmLabel?: string; danger?: boolean },
  ) => void;
};

const initialAddPeriodForm = (year: number, qualification: string): AddPeriodFormState => ({
  startDate: `${year}-01-01`,
  endDate: '',
  fte: 1,
  qualification,
  periodId: undefined,
  note: '',
});

const initialEventModal = (): EventModalState => ({
  open: false,
  id: undefined,
  eventDate: new Date().toISOString().slice(0, 10),
  type: 'period',
  title: '',
  details: '',
  previousValue: null,
  newValue: null,
});

const useEventsPeriods = ({
  year,
  qualifications,
  form,
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
  const [periodToDelete, setPeriodToDelete] = useState<{ periodId: number; label: string } | null>(null);
  const [eventModal, setEventModal] = useState<EventModalState>(initialEventModal());

  const loadHistory = useCallback(
    async (employeeId: number) => {
      try {
        const history = await window.api.listPeriods(employeeId);
        setPeriods(history);
        const evs = await window.api.listEvents(employeeId);
        setEvents(evs);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

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
    setAddPeriodForm(initialAddPeriodForm(year, qualifications[0]?.name ?? selectedEmployee.qualification));
    setEventModal({ ...initialEventModal(), open: true });
  }, [qualifications, selectedEmployee, year]);

  const openExistingPeriodModal = useCallback(
    (period: EmploymentPeriod) => {
      if (!selectedEmployee) return;
      setAddPeriodForm({
        startDate: period.startDate,
        endDate: period.endDate ?? '',
        fte: period.fte,
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
      type: ev.type,
      title: ev.title,
      details: ev.details ?? '',
      previousValue: ev.previousValue ?? null,
      newValue: ev.newValue ?? null,
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
        dataSource: selectedEmployee.dataSource ?? '',
        note: selectedEmployee.note ?? '',
        weeklyHours: form.weeklyHours ?? selectedEmployee.weeklyHours ?? null,
        startDate: addPeriodForm.startDate,
        endDate: addPeriodForm.endDate || null,
        fte: Number(addPeriodForm.fte) || 0,
        periodId: addPeriodForm.periodId,
        year,
        periodNote: addPeriodForm.note ?? null,
      };
      const updated = await window.api.saveEmployee(payload);
      setDataset(updated);
      await loadHistory(selectedEmployee.id ?? 0);
      setToast(addPeriodForm.periodId ? 'Periode aktualisiert.' : 'Qualifikation/Periode hinzugefügt.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setEventModal((prev) => ({ ...prev, open: false }));
      setTimeout(() => setToast(null), 2000);
    }
  }, [
    addPeriodForm.endDate,
    addPeriodForm.fte,
    addPeriodForm.periodId,
    addPeriodForm.qualification,
    addPeriodForm.startDate,
    addPeriodForm.note,
    form.weeklyHours,
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
      const updated = await window.api.deletePeriod(periodToDelete.periodId, year);
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
  }, [handleError, loadHistory, periodToDelete, selectedEmployee, setDataset, setLoading, setToast, year]);

  const handleSaveEvent = useCallback(async () => {
    if (!selectedEmployee) return;
    if (eventModal.type === 'period') {
      await handleAddPeriod();
      return;
    }
    if (!eventModal.eventDate || !eventModal.title.trim()) {
      handleError(new Error('Datum und Titel dürfen nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const list = await window.api.saveEvent({
        id: eventModal.id,
        employeeId: selectedEmployee.id ?? 0,
        eventDate: eventModal.eventDate,
        type: eventModal.type,
        title: eventModal.title.trim(),
        details: eventModal.details.trim() ? eventModal.details.trim() : null,
        previousValue: eventModal.previousValue ?? null,
        newValue: eventModal.newValue ?? null,
      });
      setEvents(list);
      const refreshed = await window.api.listEmployees(year);
      setDataset(refreshed);
      syncSelectedFromDataset(refreshed, selectedEmployee.id);
      setToast('Ereignis gespeichert.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setEventModal((prev) => ({ ...prev, open: false }));
      setTimeout(() => setToast(null), 2000);
    }
  }, [
    eventModal.details,
    eventModal.eventDate,
    eventModal.id,
    eventModal.newValue,
    eventModal.previousValue,
    eventModal.title,
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
            const list = await window.api.deleteEvent(id, selectedEmployee.id ?? 0);
            setEvents(list);
            const refreshed = await window.api.listEmployees(year);
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

  const displayStart = useMemo(() => {
    if (!selectedEmployee) return '';
    const joinDates = events
      .filter((ev) => ev.type === 'join')
      .map((ev) => ev.eventDate)
      .sort();
    if (joinDates.length > 0) return joinDates[0];
    return selectedEmployee.createdAt ?? selectedEmployee.startDate;
  }, [events, selectedEmployee]);

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
      displayStart,
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
