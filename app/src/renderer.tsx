import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faTriangleExclamation, faLink, faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import { createRoot } from 'react-dom/client';
import './index.css';
import type {
  EmploymentPeriod,
  EmployeeWithPeriod,
  EmployeeEvent,
  QualificationType,
  YearDataset,
  UpdateStatus,
  RecoveryInfo,
} from './shared/types';
import type { Api } from './preload';
import { statusLabels, fteHelp } from './constants';
import type { EventModalType, FormState, Page, TimelineItem } from './types/ui';
import AuthScreen from './components/auth/AuthScreen';
import Sidebar from './components/layout/Sidebar';
import YearSelector from './components/ui/YearSelector';
import Dashboard from './components/pages/Dashboard';
import EmployeeList from './components/pages/EmployeeList';
import EmployeeForm from './components/pages/EmployeeForm';
import EmployeeDetail from './components/pages/EmployeeDetail';
import SettingsPage from './components/pages/SettingsPage';
import ConfirmModal, { ConfirmState } from './components/modals/ConfirmModal';
import RecoveryKeyModal from './components/modals/RecoveryKeyModal';
import RecoveryResetModal, { RecoveryResetState } from './components/modals/RecoveryResetModal';
import QualificationModal, { QualificationModalState } from './components/modals/QualificationModal';

const emptyForm = (year: number, defaultQualification = ''): FormState => ({
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

const App = () => {
  const currentYear = new Date().getFullYear();
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
  const [qualificationModal, setQualificationModal] = useState<QualificationModalState>({
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
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [recoveryKeyModal, setRecoveryKeyModal] = useState<{
    open: boolean;
    info: RecoveryInfo | null;
    source: 'setup' | 'settings';
  }>({
    open: false,
    info: null,
    source: 'settings',
  });
  const [recoveryReset, setRecoveryReset] = useState<RecoveryResetState>({
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
    }, 60 * 60 * 1000); // stündlich prüfen

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

  // Map Detail-/Bearbeitungsseiten auf den Mitarbeitenden-Tab für die Sidebar-Markierung.
  const sidebarPage: Page = page === 'new' || page === 'edit' || page === 'view' ? 'list' : page;

  if (!appReady.configured || !appReady.unlocked) {
    const authMode: 'setup' | 'login' = appReady.configured ? 'login' : 'setup';
    return (
      <>
        <AuthScreen
          mode={authMode}
          onSubmit={(pwd) => handleLogin(pwd, authMode)}
          busy={loading}
          message={
            authMode === 'setup'
              ? 'Neues Passwort legt auch den lokalen Schlüssel an.'
              : undefined
          }
          onForgotPassword={appReady.configured ? startRecoveryReset : undefined}
          globalError={error}
        />
        <RecoveryKeyModal
          open={recoveryKeyModal.open}
          info={recoveryKeyModal.info}
          source={recoveryKeyModal.source}
          onClose={() => setRecoveryKeyModal({ open: false, info: null, source: 'settings' })}
          onCopy={handleCopyRecoveryKey}
        />
        <RecoveryResetModal
          state={recoveryReset}
          loading={loading}
          onChange={(next) => setRecoveryReset((prev) => ({ ...prev, ...next }))}
          onClose={() => setRecoveryReset({ open: false, recoveryKey: '', newPassword: '', repeat: '', error: null })}
          onSubmit={handleRecoveryReset}
        />
        {toast && <div className="toast">{toast}</div>}
        {error && <div className="toast error-toast">{error}</div>}
        {loading && <div className="loading">Lade / speichere …</div>}
      </>
    );
  }

  return (
      <div className="layout">
      <Sidebar
        current={sidebarPage}
        onNavigate={goTo}
        updateStatus={updateStatus}
        onInstallUpdate={handleInstallUpdate}
        onSnoozeUpdate={handleSnoozeUpdate}
        snoozed={snoozeUpdates}
      />
        <div className="main">
        <header className="topbar">
          <div>
            <div className="breadcrumbs">
              {crumbs().map((c, idx) => (
                <span key={`${c.label}-${idx}`}>
                  {c.page ? (
                    <button className="crumb-link" onClick={() => goTo(c.page!)}>
                      {c.label}
                    </button>
                  ) : (
                    <span className="crumb-current">{c.label}</span>
                  )}
                  {idx < crumbs().length - 1 && <span className="crumb-sep">/</span>}
                </span>
              ))}
            </div>
            <p className="eyebrow">Mitarbeiter & VZÄ</p>
            <h1>{pageTitle[page]}</h1>
            <p className="subtitle">{pageSubtitle[page]}</p>
          </div>
          {page !== 'settings' && page !== 'view' && (
            <div className="controls">
              <YearSelector year={year} onChange={setYear} currentYear={currentYear} />
            </div>
          )}
        </header>

        {page === 'dashboard' && (
          <Dashboard
            year={year}
            dataset={dataset}
            baseHours={baseHours}
            averageFte={averageFte}
            totalFte={totalFte}
            totalHeadcount={totalHeadcount}
          />
        )}

        {page === 'view' && selectedEmployee && (
          <EmployeeDetail
            employee={selectedEmployee}
            displayStart={displayStart}
            timelineItems={timelineItems}
            onOpenEditModal={openEditModal}
            onStartNewPeriod={openNewPeriodModal}
            onSelectPeriod={openExistingPeriodModal}
            onSelectEvent={openEventModalForEvent}
          />
        )}

        {page === 'list' && (
          <EmployeeList
            search={search}
            statusFilter={statusFilter}
            qualificationFilter={qualificationFilter}
            qualifications={qualifications}
            filteredEmployees={filteredEmployees}
            selectedId={form.id}
            onSearchChange={setSearch}
            onStatusChange={(val) => setStatusFilter(val)}
            onQualificationChange={setQualificationFilter}
            onExport={handleExport}
            onCreate={() => goTo('new')}
            onSelect={handleSelect}
            onDelete={confirmDeleteEmployee}
          />
        )}

        {page === 'settings' && (
          <SettingsPage
            qualifications={qualifications}
            qualificationEdits={qualificationEdits}
            dbMessage={dbMessage}
            baseHoursInput={baseHoursInput}
            updateStatus={updateStatus}
            onOpenQualificationModal={(payload) =>
              setQualificationModal({
                open: true,
                id: payload.id,
                value: payload.value,
                note: payload.note,
              })
            }
            onReorderQualification={reorderQualification}
            onDeleteQualification={confirmDeleteQualification}
            onBaseHoursInputChange={setBaseHoursInput}
            onSaveBaseHours={handleSaveBaseHoursValue}
            onDbExport={handleDbExport}
            onDbImport={handleDbImport}
            onOpenRecoveryKey={() => openRecoveryKey('settings')}
            onCheckUpdates={handleCheckUpdates}
            onInstallUpdate={handleInstallUpdate}
            onDropDatabase={handleDropDatabase}
            onFullReset={handleFullReset}
          />
        )}

        {(page === 'new' || page === 'edit') && (
          <EmployeeForm
            page={page}
            form={form}
            qualifications={qualifications}
            addNewPeriod={addNewPeriod}
            periods={periods}
            loading={loading}
            onChange={setForm}
            onReset={resetForm}
            onSave={handleSave}
            onToggleAddPeriod={setAddNewPeriod}
            onDelete={form.id ? () => confirmDeleteEmployee(form.id) : undefined}
          />
        )}
      </div>

      <RecoveryKeyModal
        open={recoveryKeyModal.open}
        info={recoveryKeyModal.info}
        source={recoveryKeyModal.source}
        onClose={() => setRecoveryKeyModal({ open: false, info: null, source: 'settings' })}
        onCopy={handleCopyRecoveryKey}
      />
      <RecoveryResetModal
        state={recoveryReset}
        loading={loading}
        onChange={(next) => setRecoveryReset((prev) => ({ ...prev, ...next }))}
        onClose={() => setRecoveryReset({ open: false, recoveryKey: '', newPassword: '', repeat: '', error: null })}
        onSubmit={handleRecoveryReset}
      />
      {toast && <div className="toast">{toast}</div>}
      {error && <div className="toast error-toast">{error}</div>}
      {loading && <div className="loading">Lade / speichere …</div>}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      {eventModal.open && selectedEmployee && (
        <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-icon">
                <FontAwesomeIcon icon={faPlus} />
              </div>
              <h3>{eventModal.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h3>
            <div className="modal-body">
              <label className="full-width">
                Typ
                <select
                  value={eventModal.type}
                  onChange={(e) => {
                    const nextType = e.target.value as EventModalType;
                    if ((nextType === 'name-change' || nextType === 'note-change') && !eventModal.id) return;
                    setEventModal((prev) => ({
                      ...prev,
                      type: nextType,
                      title: '',
                      details: '',
                    }));
                  }}
                >
                  <option value="period">Qualifikation/Periode</option>
                  <option value="join">Eintritt</option>
                  <option value="leave">Austritt</option>
                  <option value="care-visit">Pflegevisite</option>
                  <option value="emergency-training">Notfallschulung</option>
                  {eventModal.id && (
                    <option value="name-change" disabled={eventModal.type !== 'name-change'}>
                      Namensänderung
                    </option>
                  )}
                  {eventModal.id && (
                    <option value="note-change" disabled={eventModal.type !== 'note-change'}>
                      Notizänderung
                    </option>
                  )}
                  <option value="custom">Sonstiges</option>
                </select>
              </label>

              {eventModal.type === 'period' ? (
                <div className="form-grid">
                  <label>
                    Start
                    <input
                      type="date"
                      value={addPeriodForm.startDate}
                      onChange={(e) => setAddPeriodForm({ ...addPeriodForm, startDate: e.target.value })}
                    />
                  </label>
                  <label>
                    Ende
                    <input
                      type="date"
                      value={addPeriodForm.endDate}
                      onChange={(e) => setAddPeriodForm({ ...addPeriodForm, endDate: e.target.value })}
                    />
                  </label>
                  <label>
                    Qualifikation
                    <select
                      value={addPeriodForm.qualification}
                      onChange={(e) => setAddPeriodForm({ ...addPeriodForm, qualification: e.target.value })}
                    >
                      {qualifications.map((q) => (
                        <option key={q.id ?? q.name} value={q.name}>
                          {q.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <abbr className="help" title={fteHelp}>
                      FTE / VZÄ
                    </abbr>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={addPeriodForm.fte}
                      onChange={(e) => setAddPeriodForm({ ...addPeriodForm, fte: Number(e.target.value) })}
                    />
                  </label>
                  <label className="full-width">
                    Notiz
                    <textarea
                      value={addPeriodForm.note ?? ''}
                      onChange={(e) => setAddPeriodForm({ ...addPeriodForm, note: e.target.value })}
                      placeholder="Optional: Kontext zur Qualifikation/Periode"
                    />
                  </label>
                </div>
              ) : (
                <div className="form-grid">
                  <label>
                    Datum
                    <input
                      type="date"
                      value={eventModal.eventDate}
                      onChange={(e) => setEventModal({ ...eventModal, eventDate: e.target.value })}
                    />
                  </label>
                  <label className="full-width">
                    Titel
                    <input
                      value={eventModal.title}
                      onChange={(e) => setEventModal({ ...eventModal, title: e.target.value })}
                      placeholder="z. B. Wiedereinstieg nach Pause"
                    />
                  </label>
                  <label className="full-width">
                    Details
                    <textarea
                      value={eventModal.details}
                      onChange={(e) => setEventModal({ ...eventModal, details: e.target.value })}
                      placeholder="Optionale Beschreibung oder Notiz zum Ereignis"
                    />
                  </label>
                  {eventModal.type === 'note-change' && (
                    <>
                      <label className="full-width">
                        Vorherige Notiz
                        <textarea
                          value={eventModal.previousValue ?? ''}
                          onChange={(e) => setEventModal({ ...eventModal, previousValue: e.target.value })}
                          placeholder="Text vor der Änderung"
                        />
                      </label>
                      <label className="full-width">
                        Neue Notiz
                        <textarea
                          value={eventModal.newValue ?? ''}
                          onChange={(e) => setEventModal({ ...eventModal, newValue: e.target.value })}
                          placeholder="Text nach der Änderung"
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <div>
                {eventModal.id && eventModal.type !== 'period' && (
                  <button
                    className="ghost-button danger icon-button"
                    onClick={() => eventModal.id && handleDeleteEvent(eventModal.id)}
                    title="Ereignis löschen"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
                {addPeriodForm.periodId && eventModal.type === 'period' && (
                  <button
                    className="ghost-button danger icon-button"
                    onClick={() =>
                      setPeriodToDelete({
                        periodId: addPeriodForm.periodId as number,
                        label: `${addPeriodForm.startDate} – ${addPeriodForm.endDate || 'aktuell'}`,
                      })
                    }
                    title="Periode löschen"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
              <div className="inline-row compact">
                <button className="ghost-button" onClick={() => setEventModal((prev) => ({ ...prev, open: false }))}>
                  Abbrechen
                </button>
                {eventModal.type === 'period' ? (
                  <button className="primary" onClick={handleAddPeriod}>
                    Speichern
                  </button>
                ) : (
                  <button className="primary" onClick={handleSaveEvent}>
                    Speichern
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {periodToDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon danger">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h3>Periode löschen?</h3>
            <p className="modal-text">
              {periodToDelete.label}
              <br />
              Wird endgültig entfernt.
            </p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPeriodToDelete(null)}>
                Abbrechen
              </button>
              <button className="ghost-button danger" onClick={handleDeletePeriod}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
      <QualificationModal
        state={qualificationModal}
        onChange={(next) => setQualificationModal((prev) => ({ ...prev, ...next }))}
        onClose={() => setQualificationModal({ open: false, value: '', note: '', id: undefined })}
        onSave={handleSaveQualificationModal}
      />
      {editModal.open && selectedEmployee && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h3>Name & Notiz bearbeiten</h3>
            <div className="form-grid">
                <label className="full-width">
                  Name
                  <input
                    value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                />
              </label>
              <div className="link-row full-width">
                <label>
                  Wochenstunden
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editModal.weeklyHours}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditModal({ ...editModal, weeklyHours: val });
                    const hoursNum = Number(val);
                    if (!Number.isNaN(hoursNum)) {
                      const fteVal = Math.min(1, Number((hoursNum / (baseHours || 36)).toFixed(2)));
                      if (editModal.linked) {
                        setForm((prev) => ({ ...prev, weeklyHours: hoursNum, fte: fteVal, linked: true }));
                        setEditModal((prev) => ({ ...prev, fteValue: fteVal.toFixed(2) }));
                      } else {
                        setForm((prev) => ({ ...prev, weeklyHours: hoursNum, linked: false }));
                        setEditModal((prev) => ({ ...prev, fteValue: prev.fteValue }));
                      }
                    }
                  }}
                    placeholder="z. B. 40"
                  />
                </label>
                <div className="link-toggle compact">
                  <button
                    className="ghost-button icon-button"
                    type="button"
                    onClick={() => setEditModal((prev) => ({ ...prev, linked: !prev.linked }))}
                    title={editModal.linked ? 'Verknüpfung lösen' : 'Verknüpfen'}
                  >
                    <FontAwesomeIcon icon={editModal.linked ? faLink : faLinkSlash} />
                  </button>
                </div>
                <label>
                  VZÄ
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      editModal.linked
                        ? (() => {
                            const weeklyNum =
                              editModal.weeklyHours && Number(editModal.weeklyHours) > 0
                                ? Number(editModal.weeklyHours)
                                : form.weeklyHours ?? 0;
                            const val =
                              weeklyNum && weeklyNum > 0
                                ? Math.min(1, weeklyNum / (baseHours || 36)).toFixed(2)
                                : form.fte.toFixed(2);
                            return val;
                          })()
                        : editModal.fteValue || form.fte.toFixed(2)
                    }
                  onChange={(e) => {
                    const fteVal = Number(e.target.value);
                    if (Number.isNaN(fteVal)) return;
                    const cappedFte = Math.min(1, fteVal);
                    if (editModal.linked) {
                      const hours = cappedFte >= 1 ? (baseHours || 36) : cappedFte * (baseHours || 36);
                      setEditModal((prev) => ({ ...prev, weeklyHours: hours.toFixed(1), fteValue: cappedFte.toFixed(2) }));
                      setForm((prev) => ({ ...prev, fte: cappedFte, weeklyHours: Number(hours.toFixed(1)), linked: true }));
                    } else {
                      setEditModal((prev) => ({ ...prev, fteValue: e.target.value }));
                      setForm((prev) => ({ ...prev, fte: cappedFte, linked: false }));
                    }
                  }}
                />
              </label>
              </div>
              <label className="full-width">
                Notiz
                <textarea
                  value={editModal.note}
                  onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                  placeholder="Fortbildungen, Besonderheiten, Ansprechpartner"
                />
              </label>
            </div>
            <div className="modal-actions">
              <div></div>
              <div className="inline-row compact">
                <button
                  className="ghost-button"
                  onClick={() =>
                    setEditModal({ open: false, name: '', note: '', weeklyHours: '', linked: true, fteValue: '' })
                  }
                >
                  Abbrechen
                </button>
                <button
                  className="primary"
                  onClick={async () => {
                    if (!selectedEmployee) return;
                    setLoading(true);
                    try {
                      const weeklyHoursNum =
                        editModal.weeklyHours !== '' ? Number(editModal.weeklyHours) : form.weeklyHours ?? null;
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
                  }}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
