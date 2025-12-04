import { useEffect, useMemo, useState } from 'react';
import type {
  EmploymentPeriod,
  EmployeeWithPeriod,
  EmployeeEvent,
  QualificationType,
  YearDataset,
  UpdateStatus,
  RecoveryInfo,
} from '../shared/types';
import type { Api } from '../preload';
import type { EventModalType, FormState, Page, TimelineItem } from '../types/ui';
import { statusLabels, fteHelp } from '../constants';

export const emptyForm = (year: number, defaultQualification = ''): FormState => ({
  name: '',
  qualification: defaultQualification,
  dataSource: '',
  note: '',
  startDate: `${year}-01-01`,
  endDate: '',
  fte: 1,
  weeklyHours: null,
  linked: true,
});

const useAppLogic = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState<number>(currentYear);
  const [dataset, setDataset] = useState<YearDataset | null>(null);
  const [baseHours, setBaseHours] = useState<number>(36);
  const [baseHoursInput, setBaseHoursInput] = useState<string>('36');
  const [qualifications, setQualifications] = useState<QualificationType[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm(currentYear));
  const [periods, setPeriods] = useState<EmploymentPeriod[]>([]);
  const [events, setEvents] = useState<EmployeeEvent[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithPeriod | null>(null);
  const [appReady, setAppReady] = useState<{ configured: boolean; unlocked: boolean }>({
    configured: false,
    unlocked: false,
  });
  const [page, setPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const [snoozeUpdates, setSnoozeUpdates] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeWithPeriod['status']>('all');
  const [qualificationFilter, setQualificationFilter] = useState<string>('all');
  const [addNewPeriod, setAddNewPeriod] = useState(false);
  const [qualificationEdits, setQualificationEdits] = useState<Record<number, string>>({});
  const [qualificationModal, setQualificationModal] = useState<{
    open: boolean;
    id?: number;
    value: string;
    note: string;
  }>({
    open: false,
    value: '',
    note: '',
  });
  const [editModal, setEditModal] = useState<{
    open: boolean;
    name: string;
    note: string;
    weeklyHours: string;
    linked: boolean;
    fteValue: string;
  }>({
    open: false,
    name: '',
    note: '',
    weeklyHours: '',
    linked: true,
    fteValue: '',
  });
  const [addPeriodForm, setAddPeriodForm] = useState<{
    startDate: string;
    endDate: string;
    fte: number;
    qualification: string;
    periodId?: number;
    note?: string;
  }>({
    startDate: `${currentYear}-01-01`,
    endDate: '',
    fte: 1,
    qualification: '',
    note: '',
  });
  const [periodToDelete, setPeriodToDelete] = useState<{ periodId: number; label: string } | null>(null);
  const [eventModal, setEventModal] = useState<{
    open: boolean;
    id?: number;
    eventDate: string;
    type: EventModalType;
    title: string;
    details: string;
    previousValue?: string | null;
    newValue?: string | null;
  }>({
    open: false,
    eventDate: new Date().toISOString().slice(0, 10),
    type: 'period',
    title: '',
    details: '',
    previousValue: null,
    newValue: null,
  });
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
    confirmLabel?: string;
    danger?: boolean;
  } | null>(null);
  const [recoveryKeyModal, setRecoveryKeyModal] = useState<{
    open: boolean;
    info: RecoveryInfo | null;
    source: 'setup' | 'settings';
  }>({
    open: false,
    info: null,
    source: 'settings',
  });
  const [recoveryReset, setRecoveryReset] = useState<{
    open: boolean;
    recoveryKey: string;
    newPassword: string;
    repeat: string;
    error?: string | null;
  }>({
    open: false,
    recoveryKey: '',
    newPassword: '',
    repeat: '',
    error: null,
  });

  const handleError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    setError(message);
    setTimeout(() => setError(null), 3500);
  };

  const refreshDataset = async (targetYear: number) => {
    setLoading(true);
    try {
      const data = await window.api.listEmployees(targetYear);
      setDataset(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (employeeId: number) => {
    try {
      const history = await window.api.listPeriods(employeeId);
      setPeriods(history);
      const evs = await window.api.listEvents(employeeId);
      setEvents(evs);
    } catch (err) {
      handleError(err);
    }
  };

  const bootstrap = async () => {
    try {
      const state = await window.api.getAppState();
      setAppReady(state);
      if (state.unlocked) {
        try {
          const hours = await window.api.getBaseHours();
          setBaseHours(hours || 36);
          setBaseHoursInput(String(hours || 36));
        } catch (err) {
          handleError(err);
        }
        const qualis = await window.api.listQualifications();
        setQualifications(qualis);
        const edits: Record<number, string> = {};
        qualis.forEach((q) => {
          if (q.id) edits[q.id] = q.name;
        });
        setQualificationEdits(edits);
        setForm((prev) => ({ ...prev, qualification: qualis[0]?.name ?? prev.qualification }));
        await refreshDataset(year);
      }
    } catch (err) {
      handleError(err);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (appReady.unlocked) {
      refreshDataset(year);
    }
  }, [year, appReady.unlocked]);

  useEffect(() => {
    if (!appReady.unlocked) return;
    window.api
      .getBaseHours()
      .then((hours) => {
        setBaseHours(hours || 36);
        setBaseHoursInput(String(hours || 36));
      })
      .catch(handleError);
  }, [appReady.unlocked]);

  useEffect(() => {
    if (appReady.unlocked) {
      window.api
        .listQualifications()
        .then((list) => {
          setQualifications(list);
          const edits: Record<number, string> = {};
          list.forEach((q) => {
            if (q.id) edits[q.id] = q.name;
          });
          setQualificationEdits(edits);
          if (!form.qualification) {
            setForm((prev) => ({ ...prev, qualification: list[0]?.name ?? '' }));
            setAddPeriodForm((prev) => ({ ...prev, qualification: list[0]?.name ?? '' }));
          }
        })
        .catch(handleError);
    }
  }, [appReady.unlocked]);

  useEffect(() => {
    if (qualificationFilter === 'all') return;
    const exists = qualifications.some((q) => q.name === qualificationFilter);
    if (!exists) {
      setQualificationFilter('all');
    }
  }, [qualifications, qualificationFilter]);

  useEffect(() => {
    const updateApi = (window as Window & { api?: Api }).api;
    if (!updateApi || typeof updateApi.onUpdateStatus !== 'function' || typeof updateApi.checkUpdates !== 'function') {
      return undefined;
    }
    const unsubscribe = updateApi.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });

    const runCheck = () => {
      if (snoozeUpdates) return;
      updateApi.checkUpdates().catch(() => {
        setUpdateStatus((prev) => prev);
      });
    };

    runCheck();

    const interval = window.setInterval(() => {
      runCheck();
    }, 60 * 60 * 1000);

    const handleFocus = () => runCheck();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (unsubscribe) unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [snoozeUpdates]);

  const handleLogin = async (password: string, mode: 'setup' | 'login') => {
    try {
      setLoading(true);
      const state =
        mode === 'setup' ? await window.api.register(password) : await window.api.login(password);
      setAppReady(state);
      if (state.unlocked) {
        await refreshDataset(year);
        if (mode === 'setup') {
          await openRecoveryKey('setup');
        }
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (emp: EmployeeWithPeriod) => {
    setSelectedEmployee(emp);
    const hoursFromFte = emp.fte ? (Math.max(emp.fte, 1) * (baseHours || 36)).toFixed(1) : '';
    setEditModal({
      open: false,
      name: emp.name,
      note: emp.note ?? '',
      weeklyHours: emp.weeklyHours ? String(emp.weeklyHours) : hoursFromFte,
      linked: true,
      fteValue: emp.fte ? emp.fte.toFixed(2) : '',
    });
    setPage('view');
    setForm({
      id: emp.id,
      periodId: emp.periodId,
      name: emp.name,
      qualification: emp.qualification,
      dataSource: emp.dataSource ?? '',
      note: emp.note ?? '',
      startDate: emp.startDate,
      endDate: emp.endDate ?? '',
      fte: emp.fte,
      weeklyHours: emp.weeklyHours ?? null,
      linked: true,
    });
    setAddNewPeriod(false);
    try {
      const history = await window.api.listPeriods(emp.id ?? 0);
      setPeriods(history);
      const evs = await window.api.listEvents(emp.id ?? 0);
      setEvents(evs);
      setAddPeriodForm((prev) => ({
        ...prev,
        startDate: history[0]?.startDate ?? `${year}-01-01`,
        endDate: '',
        fte: 1,
        qualification: qualifications[0]?.name ?? emp.qualification,
        periodId: undefined,
        note: '',
      }));
      setEventModal((prev) => ({
        ...prev,
        type: 'period',
        eventDate: new Date().toISOString().slice(0, 10),
        title: '',
        details: '',
        previousValue: null,
        newValue: null,
      }));
    } catch (err) {
      handleError(err);
    }
  };

  const resetForm = () => {
    setForm(emptyForm(year, qualifications[0]?.name ?? ''));
    setPeriods([]);
    setAddNewPeriod(false);
  };

  const goTo = (target: Page) => {
    if (target === 'new') {
      resetForm();
    }
    if (target === 'edit' && !form.id) {
      return;
    }
    if (target === 'view' && !selectedEmployee) return;
    setPage(target);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      handleError(new Error('Name darf nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const weeklyHoursNum =
        form.weeklyHours !== undefined && form.weeklyHours !== null ? Number(form.weeklyHours) : NaN;
      const useLinked = form.linked ?? true;
      const derivedFte =
        useLinked && !Number.isNaN(weeklyHoursNum) && weeklyHoursNum > 0
          ? Math.min(1, Number((weeklyHoursNum / (baseHours || 36)).toFixed(2)))
          : form.fte;
      const payload = {
        ...form,
        periodId: addNewPeriod ? undefined : form.periodId,
        periodNote: addPeriodForm.note ?? null,
        endDate: form.endDate ? form.endDate : null,
        fte: Number(derivedFte) || 0,
        year,
      };
      const updated = await window.api.saveEmployee(payload);
      setDataset(updated);
      setToast('Gespeichert.');
      setPage('list');
      resetForm();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const deleteEmployee = async (id: number) => {
    setLoading(true);
    try {
      const updated = await window.api.deleteEmployee(id, year);
      setDataset(updated);
      resetForm();
      setPage('list');
      setToast('Gelöscht.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const result = await window.api.exportData(year, format);
      if (result.saved) {
        setToast(`Export gespeichert: ${result.filePath}`);
        setTimeout(() => setToast(null), 2800);
      } else if (result.error) {
        handleError(new Error(result.error));
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleSaveQualificationModal = async () => {
    const val = qualificationModal.value.trim();
    if (!val) return;
    try {
      let list: QualificationType[] = qualifications;
      if (qualificationModal.id) {
        list = await window.api.updateQualification(qualificationModal.id, val, qualificationModal.note);
      } else {
        list = await window.api.addQualification(val, qualificationModal.note);
      }
      setQualifications(list);
      const edits: Record<number, string> = {};
      list.forEach((q) => {
        if (q.id) edits[q.id] = q.name;
      });
      setQualificationEdits(edits);
      setQualificationModal({ open: false, value: '', note: '' });
      setToast('Qualifikation gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteQualification = async (id: number) => {
    confirmAction(
      'Qualifikation wirklich löschen?',
      async () => {
        try {
          const list = await window.api.deleteQualification(id);
          setQualifications(list);
          setQualificationEdits({});
          setToast('Qualifikation gelöscht.');
          setTimeout(() => setToast(null), 2000);
        } catch (err) {
          handleError(err);
        }
      },
      { confirmLabel: 'Löschen', danger: true },
    );
  };

  const confirmAction = (
    message: string,
    action: () => Promise<void> | void,
    opts?: { confirmLabel?: string; danger?: boolean },
  ) => {
    setConfirmState({ message, onConfirm: action, confirmLabel: opts?.confirmLabel, danger: opts?.danger });
  };

  const openRecoveryKey = async (source: 'setup' | 'settings') => {
    try {
      const info = await window.api.getRecoveryKey();
      setRecoveryKeyModal({ open: true, info, source });
    } catch (err) {
      handleError(err);
    }
  };

  const handleCopyRecoveryKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setToast('Recovery Key kopiert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  };

  const startRecoveryReset = () => {
    setRecoveryReset({ open: true, recoveryKey: '', newPassword: '', repeat: '', error: null });
  };

  const handleRecoveryReset = async () => {
    if (!recoveryReset.recoveryKey.trim()) {
      setRecoveryReset((prev) => ({ ...prev, error: 'Bitte Recovery Key eingeben.' }));
      return;
    }
    if (!recoveryReset.newPassword.trim()) {
      setRecoveryReset((prev) => ({ ...prev, error: 'Bitte neues Passwort eingeben.' }));
      return;
    }
    if (recoveryReset.newPassword !== recoveryReset.repeat) {
      setRecoveryReset((prev) => ({ ...prev, error: 'Passwörter stimmen nicht überein.' }));
      return;
    }
    setRecoveryReset((prev) => ({ ...prev, error: null }));
    setLoading(true);
    try {
      const state = await window.api.recoverWithKey({
        recoveryKey: recoveryReset.recoveryKey,
        newPassword: recoveryReset.newPassword,
      });
      setAppReady(state);
      if (state.unlocked) {
        await refreshDataset(year);
      }
      setRecoveryReset({ open: false, recoveryKey: '', newPassword: '', repeat: '', error: null });
      setToast('Passwort zurückgesetzt. Recovery Key sicher aufbewahren.');
      setTimeout(() => setToast(null), 2200);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteEmployee = (id?: number) => {
    if (!id) return;
    confirmAction('Mitarbeiter:in und Historie wirklich löschen?', () => deleteEmployee(id), {
      confirmLabel: 'Löschen',
      danger: true,
    });
  };

  const confirmDeleteQualification = (id: number) => {
    confirmAction('Qualifikation wirklich löschen?', () => handleDeleteQualification(id), {
      confirmLabel: 'Löschen',
      danger: true,
    });
  };

  const reorderQualification = async (orderedIds: number[]) => {
    try {
      const list = await window.api.reorderQualifications(orderedIds);
      setQualifications(list);
      const edits: Record<number, string> = {};
      list.forEach((q) => {
        if (q.id) edits[q.id] = q.name;
      });
      setQualificationEdits(edits);
    } catch (err) {
      handleError(err);
    }
  };

  const handleEditModalSave = async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const weeklyHoursNum = editModal.weeklyHours !== '' ? Number(editModal.weeklyHours) : form.weeklyHours ?? null;
      const useLinked = editModal.linked ?? true;
      const derivedFte =
        useLinked && weeklyHoursNum && weeklyHoursNum > 0
          ? Math.min(1, Number((weeklyHoursNum / (baseHours || 36)).toFixed(2)))
          : editModal.fteValue
            ? Number(editModal.fteValue)
            : form.fte;
      const payload = {
        ...form,
        name: editModal.name,
        note: editModal.note,
        periodId: form.periodId,
        endDate: form.endDate ? form.endDate : null,
        weeklyHours: weeklyHoursNum ?? null,
        fte: Number(derivedFte) || 0,
        year,
        linked: useLinked,
      };
      const updated = await window.api.saveEmployee(payload);
      setDataset(updated);
      setSelectedEmployee({
        ...selectedEmployee,
        name: payload.name,
        note: payload.note,
        weeklyHours: weeklyHoursNum ?? selectedEmployee.weeklyHours ?? null,
        fte: payload.fte,
      });
      setForm((prev) => ({
        ...prev,
        name: payload.name,
        note: payload.note,
        weeklyHours: weeklyHoursNum ?? prev.weeklyHours ?? null,
        fte: payload.fte,
      }));
      await loadHistory(selectedEmployee.id ?? 0);
      setToast('Gespeichert.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setEditModal({
        open: false,
        name: '',
        note: '',
        weeklyHours: '',
        linked: true,
        fteValue: '',
      });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleDbExport = async (mode: 'encrypted' | 'plain') => {
    setDbMessage(null);
    try {
      const result = await window.api.exportDatabase(mode);
      if (result.saved) {
        setDbMessage(`Export gespeichert unter: ${result.filePath}`);
      } else if (result.error) {
        setDbMessage(`Export fehlgeschlagen: ${result.error}`);
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleDbImport = async (mode: 'encrypted' | 'plain') => {
    confirmAction(
      'Import ersetzt die aktuelle Datenbank. Es wird vorher ein Backup erstellt. Fortfahren?',
      async () => {
        try {
          const result = await window.api.importDatabase(mode);
          if (result.imported) {
            await refreshDataset(year);
            const info = result.backupPath
              ? `Import erfolgreich. Backup unter: ${result.backupPath}`
              : 'Import erfolgreich.';
            setToast(info);
          } else if (result.error) {
            setError(`Import fehlgeschlagen: ${result.error}`);
          }
        } catch (err) {
          handleError(err);
        }
      },
      { confirmLabel: 'Importieren', danger: true },
    );
  };

  const handleSaveBaseHoursValue = async () => {
    const val = Number(baseHoursInput);
    if (Number.isNaN(val) || val <= 0) {
      handleError(new Error('Bitte eine gültige Zahl > 0 eingeben.'));
      return;
    }
    try {
      const saved = await window.api.setBaseHours(val);
      setBaseHours(saved || 36);
      setToast(`Basis-Stunden gesetzt auf ${saved}.`);
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDropDatabase = () => {
    confirmAction(
      'Datenbank endgültig löschen? Dies entfernt alle Einträge, behält aber das Passwort.',
      async () => {
        try {
          await window.api.deleteDatabase();
          setDataset(null);
          setSelectedEmployee(null);
          resetForm();
          setPage('dashboard');
          setToast('Datenbank gelöscht. Bitte neu importieren oder neu anlegen.');
        } catch (err) {
          handleError(err);
        } finally {
          setTimeout(() => setToast(null), 3000);
        }
      },
      { confirmLabel: 'Löschen', danger: true },
    );
  };

  const handleFullReset = () => {
    confirmAction(
      'App komplett zurücksetzen? Datenbank und Konfiguration werden entfernt. Die App startet wie neu.',
      async () => {
        try {
          const state = await window.api.resetApp();
          setAppReady(state);
          setDataset(null);
          setSelectedEmployee(null);
          resetForm();
          setPage('dashboard');
          setToast('App zurückgesetzt. Bitte neu einrichten.');
        } catch (err) {
          handleError(err);
        } finally {
          setTimeout(() => setToast(null), 3000);
        }
      },
      { confirmLabel: 'Zurücksetzen', danger: true },
    );
  };

  const handleCheckUpdates = async () => {
    try {
      await window.api.checkUpdates();
    } catch (err) {
      handleError(err);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.api.installUpdate();
    } catch (err) {
      handleError(err);
    }
  };

  const handleSnoozeUpdate = () => {
    setSnoozeUpdates(true);
    setUpdateStatus((prev) => (prev.state === 'downloaded' ? prev : { state: 'idle' }));
  };

  const handleAddPeriod = async () => {
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
  };

  const handleDeletePeriod = async () => {
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
  };

  const syncSelectedFromDataset = (data: YearDataset, id?: number) => {
    if (!id) return;
    const updated = data.employees.find((emp) => emp.id === id);
    if (updated) setSelectedEmployee(updated);
  };

  const handleSaveEvent = async () => {
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
  };

  const handleDeleteEvent = (id: number) => {
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
  };

  const openEditModal = () => {
    if (!selectedEmployee) return;
    const computedWeeklyHours =
      selectedEmployee.weeklyHours !== null && selectedEmployee.weeklyHours !== undefined
        ? String(selectedEmployee.weeklyHours)
        : selectedEmployee.fte
          ? (selectedEmployee.fte * (baseHours || 36)).toFixed(1)
          : '';
    setEditModal({
      open: true,
      name: selectedEmployee.name,
      note: selectedEmployee.note ?? '',
      weeklyHours: computedWeeklyHours,
      fteValue: selectedEmployee.fte.toFixed(2),
      linked: true,
    });
  };

  const filteredEmployees = useMemo(() => {
    if (!dataset) return [];
    return dataset.employees.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.qualification.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : emp.status === statusFilter;
      const matchesQualification =
        qualificationFilter === 'all' ? true : emp.qualification === qualificationFilter;
      return matchesSearch && matchesStatus && matchesQualification;
    });
  }, [dataset, search, statusFilter, qualificationFilter]);

  const averageFte = useMemo(() => {
    const headcount = dataset?.aggregation.totalHeadcount ?? 0;
    if (!headcount) return 0;
    return dataset.aggregation.totalFte / headcount;
  }, [dataset]);
  const totalFte = dataset?.aggregation.totalFte ?? 0;
  const totalHeadcount = dataset?.aggregation.totalHeadcount ?? 0;

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

  const pageTitle: Record<Page, string> = {
    dashboard: 'Dashboard',
    list: 'Mitarbeitende',
    new: 'Neu anlegen',
    edit: 'Bearbeiten',
    settings: 'Einstellungen',
    view: 'Details',
  };

  const pageSubtitle: Record<Page, string> = {
    dashboard: 'Kennzahlen und Aggregationen zum gewählten Jahr.',
    list: 'Liste mit Filter/Status und Doppelklick zum Bearbeiten.',
    new: 'Neue Person mit Historieneintrag erfassen.',
    edit: form.id ? `Bearbeitung: ${form.name}` : 'Bitte Eintrag aus Liste wählen.',
    settings: 'Datenbank austauschen oder Export/Import (verschlüsselt/unkryptiert).',
    view: selectedEmployee ? `Status: ${statusLabels[selectedEmployee.status]}` : '',
  };

  const crumbs = (): { label: string; page?: Page }[] => {
    if (page === 'dashboard') return [{ label: 'Dashboard' }];
    if (page === 'list') return [{ label: 'Dashboard', page: 'dashboard' }, { label: 'Mitarbeitende' }];
    if (page === 'new')
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Mitarbeitende', page: 'list' },
        { label: 'Neu anlegen' },
      ];
    if (page === 'settings')
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Einstellungen' },
      ];
    if (page === 'view' && selectedEmployee)
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Mitarbeitende', page: 'list' },
        { label: selectedEmployee.name },
      ];
    return [
      { label: 'Dashboard', page: 'dashboard' },
      { label: 'Mitarbeitende', page: 'list' },
      { label: 'Bearbeiten' },
    ];
  };

  const sidebarPage: Page = page === 'new' || page === 'edit' || page === 'view' ? 'list' : page;

  const openNewPeriodModal = () => {
    if (!selectedEmployee) return;
    setAddPeriodForm({
      startDate: `${year}-01-01`,
      endDate: '',
      fte: 1,
      qualification: qualifications[0]?.name ?? selectedEmployee.qualification,
      periodId: undefined,
      note: '',
    });
    setEventModal({
      open: true,
      id: undefined,
      eventDate: new Date().toISOString().slice(0, 10),
      type: 'period',
      title: '',
      details: '',
      previousValue: null,
      newValue: null,
    });
  };

  const openExistingPeriodModal = (period: EmploymentPeriod) => {
    if (!selectedEmployee) return;
    setAddPeriodForm({
      startDate: period.startDate,
      endDate: period.endDate ?? '',
      fte: period.fte,
      qualification: period.qualification ?? selectedEmployee.qualification,
      periodId: period.id,
      note: period.note ?? '',
    });
    setEventModal({
      open: true,
      id: undefined,
      eventDate: new Date().toISOString().slice(0, 10),
      type: 'period',
      title: '',
      details: '',
      previousValue: null,
      newValue: null,
    });
  };

  const openEventModalForEvent = (ev: EmployeeEvent) => {
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
  };

  return {
    constants: { statusLabels, fteHelp, pageTitle, pageSubtitle },
    state: {
      currentYear,
      year,
      dataset,
      baseHours,
      baseHoursInput,
      qualifications,
      form,
      periods,
      events,
      selectedEmployee,
      appReady,
      page,
      loading,
      toast,
      error,
      updateStatus,
      dbMessage,
      snoozeUpdates,
      search,
      statusFilter,
      qualificationFilter,
      addNewPeriod,
      qualificationEdits,
      qualificationModal,
      editModal,
      addPeriodForm,
      periodToDelete,
      eventModal,
      confirmState,
      recoveryKeyModal,
      recoveryReset,
    },
    setters: {
      setYear,
      setDataset,
      setBaseHoursInput,
      setForm,
      setAddPeriodForm,
      setAddNewPeriod,
      setQualificationFilter,
      setQualificationModal,
      setEditModal,
      setSearch,
      setStatusFilter,
      setPeriodToDelete,
      setEventModal,
      setRecoveryKeyModal,
      setRecoveryReset,
      setConfirmState,
    },
    derived: {
      filteredEmployees,
      averageFte,
      totalFte,
      totalHeadcount,
      displayStart,
      timelineItems,
      crumbs,
      sidebarPage,
    },
    actions: {
      goTo,
      handleLogin,
      handleSave,
      handleExport,
      handleSelect,
      confirmDeleteEmployee,
      confirmDeleteQualification,
      handleSaveQualificationModal,
      reorderQualification,
      openRecoveryKey,
      handleCopyRecoveryKey,
      startRecoveryReset,
      handleRecoveryReset,
      handleDbExport,
      handleDbImport,
      handleSaveBaseHoursValue,
      handleDropDatabase,
      handleFullReset,
      handleCheckUpdates,
      handleInstallUpdate,
      handleSnoozeUpdate,
      handleAddPeriod,
      handleSaveEvent,
      handleDeleteEvent,
      handleDeletePeriod,
      openNewPeriodModal,
      openExistingPeriodModal,
      openEventModalForEvent,
      openEditModal,
      handleEditModalSave,
      resetForm,
    },
  };
};

export default useAppLogic;
