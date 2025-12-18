import { useCallback, useMemo, useState } from 'react';
import api from '../services/api';
import type { EmployeeWithPeriod, QualificationType, YearDataset } from '../shared/types';
import type { ConfirmActionOptions, EditModalState, FormState, Page, QualificationModalState } from '../types/ui';
import { deriveFteFromWeeklyHours } from '../utils/fte';

export const emptyForm = (year: number, defaultQualification = ''): FormState => ({
  name: '',
  qualification: defaultQualification,
  note: '',
  startDate: `${year}-01-01`,
  endDate: '',
  fte: 1,
  weeklyHours: null,
  linked: true,
});

const clampFte = (val?: number | null) => {
  if (val === undefined || val === null || Number.isNaN(val)) return 0;
  return Math.min(1, val);
};

type UseEmployeesParams = {
  year: number;
  currentYear: number;
  baseHours: number;
  handleError: (err: unknown) => void;
  setLoading: (val: boolean) => void;
  setToast: (msg: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    opts?: ConfirmActionOptions,
  ) => void;
};

const pageTitle: Record<Page, string> = {
  dashboard: 'Dashboard',
  list: 'Team',
  new: 'Neu anlegen',
  edit: 'Bearbeiten',
  settings: 'Einstellungen',
  view: 'Details',
  dev: 'Entwickler',
  calendar: 'Kalender',
  patients: 'Patient:innen',
  'patient-view': 'Patient:in Details',
  'patient-new': 'Patient:in anlegen',
  'patient-edit': 'Patient:in bearbeiten',
};

const useEmployees = ({
  year,
  currentYear,
  baseHours,
  handleError,
  setLoading,
  setToast,
  confirmAction,
}: UseEmployeesParams) => {
  const [dataset, setDataset] = useState<YearDataset | null>(null);
  const [qualifications, setQualifications] = useState<QualificationType[]>([]);
  const [qualificationEdits, setQualificationEdits] = useState<Record<number, string>>({});
  const [qualificationModal, setQualificationModal] = useState<QualificationModalState>({
    open: false,
    value: '',
    note: '',
  });
  const [form, setForm] = useState<FormState>(emptyForm(currentYear));
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithPeriod | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeWithPeriod['status']>('all');
  const [qualificationFilter, setQualificationFilter] = useState<string>('all');
  const [addNewPeriod, setAddNewPeriod] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>({
    open: false,
    mode: 'edit',
    name: '',
    note: '',
    weeklyHours: '',
    linked: true,
    fteValue: '',
    birthDate: '',
  });

  const refreshDataset = useCallback(
    async (targetYear: number) => {
      setLoading(true);
      try {
        const data = await api.employees.list(targetYear);
        setDataset(data);
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError, setLoading],
  );

  const resetForm = useCallback(() => {
    setForm(emptyForm(year, qualifications[0]?.name ?? ''));
    setAddNewPeriod(false);
  }, [qualifications, year]);

  const goTo = useCallback(
    (target: Page) => {
      if (target === 'new') {
        resetForm();
      }
      if (target === 'edit' && !form.id) {
        return;
      }
      if (target === 'view' && !selectedEmployee) return;
      setPage(target);
    },
    [form.id, resetForm, selectedEmployee],
  );

  const handleSelect = useCallback(
    async (emp: EmployeeWithPeriod) => {
      setSelectedEmployee(emp);
      const cappedFte = clampFte(emp.fte);
      const hoursFromFte = cappedFte ? (cappedFte * (baseHours || 36)).toFixed(1) : '';
      setEditModal({
        open: false,
        mode: 'edit',
        name: emp.name,
        note: emp.note ?? '',
        weeklyHours: emp.weeklyHours ? String(emp.weeklyHours) : hoursFromFte,
        linked: true,
        fteValue: emp.fte ? clampFte(emp.fte).toFixed(2) : '',
        birthDate: emp.birthDate ?? '',
      });
      setPage('view');
      setForm({
        id: emp.id,
        periodId: emp.periodId,
        name: emp.name,
        qualification: emp.qualification,
        note: emp.note ?? '',
        startDate: emp.startDate,
        endDate: emp.endDate ?? '',
        fte: clampFte(emp.fte),
        weeklyHours: emp.weeklyHours ?? null,
        linked: true,
      });
      setAddNewPeriod(false);
    },
    [baseHours],
  );

  const handleSave = useCallback(async () => {
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
          ? deriveFteFromWeeklyHours(weeklyHoursNum, baseHours)
          : form.fte;
      const payload: Parameters<typeof api.employees.save>[0] = {
        ...form,
        periodId: addNewPeriod ? undefined : form.periodId,
        periodNote: null,
        endDate: form.endDate ? form.endDate : null,
        fte: Math.min(1, Number(derivedFte) || 0),
        year,
      };
      const updated = await api.employees.save(payload);
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
  }, [addNewPeriod, baseHours, form, handleError, resetForm, setLoading, setToast, year]);

  const deleteEmployee = useCallback(
    async (id: number) => {
      setLoading(true);
      try {
        const updated = await api.employees.delete(id, year);
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
    },
    [handleError, resetForm, setLoading, setToast, year],
  );

  const confirmDeleteEmployee = useCallback(
    (id?: number) => {
      if (!id) return;
      confirmAction('Teammitglied und Historie wirklich löschen?', () => deleteEmployee(id), {
        confirmLabel: 'Löschen',
        danger: true,
      });
    },
    [confirmAction, deleteEmployee],
  );

  const handleExport = useCallback(
    async (format: 'csv' | 'xlsx') => {
      try {
        const result = await api.data.export(year, format);
        if (result.saved) {
          setToast(`Export gespeichert: ${result.filePath}`);
          setTimeout(() => setToast(null), 2800);
        } else if (result.error) {
          handleError(new Error(result.error));
        }
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, setToast, year],
  );

  const handleSaveQualificationModal = useCallback(async () => {
    const val = qualificationModal.value.trim();
    if (!val) return;
    try {
      let list: QualificationType[] = qualifications;
      if (qualificationModal.id) {
        list = await api.qualifications.update(qualificationModal.id, val, qualificationModal.note);
      } else {
        list = await api.qualifications.add(val, qualificationModal.note);
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
  }, [handleError, qualificationModal, qualifications, setToast]);

  const handleDeleteQualification = useCallback(
    async (id: number) => {
      try {
        const list = await api.qualifications.delete(id);
        setQualifications(list);
        setQualificationEdits({});
        setToast('Qualifikation gelöscht.');
        setTimeout(() => setToast(null), 2000);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, setToast],
  );

  const confirmDeleteQualification = useCallback(
    (id: number) => {
      confirmAction('Qualifikation wirklich löschen?', () => handleDeleteQualification(id), {
        confirmLabel: 'Löschen',
        danger: true,
      });
    },
    [confirmAction, handleDeleteQualification],
  );

  const reorderQualification = useCallback(
    async (orderedIds: number[]) => {
      try {
        const list = await api.qualifications.reorder(orderedIds);
        setQualifications(list);
        const edits: Record<number, string> = {};
        list.forEach((q) => {
          if (q.id) edits[q.id] = q.name;
        });
        setQualificationEdits(edits);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const openEditModal = useCallback(() => {
    if (!selectedEmployee) return;
    const cappedSelectedFte = clampFte(selectedEmployee.fte);
    const computedWeeklyHours =
      selectedEmployee.weeklyHours !== null && selectedEmployee.weeklyHours !== undefined
        ? String(selectedEmployee.weeklyHours)
        : cappedSelectedFte
          ? (cappedSelectedFte * (baseHours || 36)).toFixed(1)
          : '';
    setEditModal({
      open: true,
      mode: 'edit',
      name: selectedEmployee.name,
      note: selectedEmployee.note ?? '',
      weeklyHours: computedWeeklyHours,
      fteValue: cappedSelectedFte ? cappedSelectedFte.toFixed(2) : '',
      linked: true,
      birthDate: selectedEmployee.birthDate ?? '',
    });
  }, [baseHours, selectedEmployee]);

  const openCreateModal = useCallback(() => {
    const defaultQualification = qualifications[0]?.name ?? '';
    const freshForm = emptyForm(year, defaultQualification);
    setForm(freshForm);
    setAddNewPeriod(false);
    setSelectedEmployee(null);
    setEditModal({
      open: true,
      mode: 'create',
      name: '',
      note: '',
      weeklyHours: '',
      linked: true,
      fteValue: freshForm.fte ? clampFte(freshForm.fte).toFixed(2) : '',
      birthDate: '',
    });
  }, [qualifications, setAddNewPeriod, setForm, setSelectedEmployee, year]);

  const handleEditModalSave = useCallback(async () => {
    if (editModal.mode === 'create') {
      if (!editModal.name.trim()) {
        handleError(new Error('Name darf nicht leer sein.'));
        return;
      }
      setLoading(true);
      try {
        const weeklyHoursNum = editModal.weeklyHours !== '' ? Number(editModal.weeklyHours) : form.weeklyHours ?? null;
        const useLinked = editModal.linked ?? true;
        const derivedFte =
          useLinked && typeof weeklyHoursNum === 'number' && !Number.isNaN(weeklyHoursNum) && weeklyHoursNum > 0
            ? deriveFteFromWeeklyHours(weeklyHoursNum, baseHours)
            : editModal.fteValue
              ? Number(editModal.fteValue)
              : form.fte;
        const payload: Parameters<typeof api.employees.save>[0] = {
          ...form,
          name: editModal.name,
          note: editModal.note,
          weeklyHours: weeklyHoursNum ?? null,
          fte: Math.min(1, Number(derivedFte) || 0),
          endDate: form.endDate ? form.endDate : null,
          year,
          linked: useLinked,
          birthDate: editModal.birthDate || null,
        };
        const updated = await api.employees.save(payload);
        setDataset(updated);
        setToast('Gespeichert.');
        setPage('list');
        resetForm();
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
        setEditModal({
          open: false,
          mode: 'edit',
          name: '',
          note: '',
          weeklyHours: '',
          linked: true,
          fteValue: '',
          birthDate: '',
        });
        setTimeout(() => setToast(null), 2000);
      }
      return;
    }
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const weeklyHoursNum = editModal.weeklyHours !== '' ? Number(editModal.weeklyHours) : form.weeklyHours ?? null;
      const useLinked = editModal.linked ?? true;
      const derivedFte =
        useLinked && typeof weeklyHoursNum === 'number' && !Number.isNaN(weeklyHoursNum) && weeklyHoursNum > 0
          ? deriveFteFromWeeklyHours(weeklyHoursNum, baseHours)
          : editModal.fteValue
            ? Number(editModal.fteValue)
            : form.fte;
      const fteValue = Math.min(1, Number(derivedFte) || 0);
      const payload = {
        ...form,
        name: editModal.name,
        note: editModal.note,
        periodId: form.periodId,
        endDate: form.endDate ? form.endDate : null,
        weeklyHours: weeklyHoursNum ?? null,
        fte: fteValue,
        year,
        linked: useLinked,
        birthDate: editModal.birthDate || null,
      };
      const updated = await api.employees.save(payload);
      setDataset(updated);
      setSelectedEmployee({
        ...selectedEmployee,
        name: payload.name,
        note: payload.note,
        weeklyHours: weeklyHoursNum ?? selectedEmployee.weeklyHours ?? null,
        fte: payload.fte,
        birthDate: payload.birthDate,
      });
      setForm((prev) => ({
        ...prev,
        name: payload.name,
        note: payload.note,
        weeklyHours: weeklyHoursNum ?? prev.weeklyHours ?? null,
        fte: payload.fte,
      }));
      setToast('Gespeichert.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setEditModal({
        open: false,
        mode: 'edit',
        name: '',
        note: '',
        weeklyHours: '',
        linked: true,
        fteValue: '',
        birthDate: '',
      });
      setTimeout(() => setToast(null), 2000);
    }
  }, [baseHours, editModal, form, handleError, resetForm, selectedEmployee, setLoading, setPage, setToast, year]);

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

  const crumbs = useCallback(
    (): { label: string; page?: Page }[] => {
      if (page === 'dashboard') return [{ label: 'Dashboard' }];
      if (page === 'list') return [{ label: 'Dashboard', page: 'dashboard' }, { label: 'Team' }];
      if (page === 'new')
        return [
          { label: 'Dashboard', page: 'dashboard' },
          { label: 'Team', page: 'list' },
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
          { label: 'Team', page: 'list' },
          { label: selectedEmployee.name },
        ];
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Team', page: 'list' },
        { label: 'Bearbeiten' },
      ];
    },
    [page, selectedEmployee],
  );

  const getSidebarPage = (): Page => {
    if (page === 'new' || page === 'edit' || page === 'view') return 'list';
    if (page === 'patient-view' || page === 'patient-new' || page === 'patient-edit') return 'patients';
    return page;
  };
  const sidebarPage: Page = getSidebarPage();

  const pageSubtitle: Record<Page, string> = {
    dashboard: 'Kennzahlen und Aggregationen zum gewaehlten Jahr.',
    list: 'Liste von Teammitgliedern mit Filter/Status',
    new: 'Neue Person mit Historieneintrag erfassen.',
    edit: form.id ? `Bearbeitung: ${form.name}` : 'Bitte Eintrag aus Liste waehlen.',
    settings: 'Datenbank austauschen oder Export/Import (verschluesselt/unkryptiert).',
    view: '',
    dev: 'Rohe Datenbank-Tabellen und Debug-Informationen.',
    calendar: 'Termine und Ereignisse im Ueberblick.',
    patients: 'Patient:innen mit QPR 2026 Bewertung verwalten.',
    'patient-view': '',
    'patient-new': 'Neue:n Patient:in anlegen.',
    'patient-edit': 'Patient:in bearbeiten.',
  };

  return {
    state: {
      dataset,
      qualifications,
      qualificationEdits,
      qualificationModal,
      form,
      selectedEmployee,
      page,
      search,
      statusFilter,
      qualificationFilter,
      addNewPeriod,
      editModal,
    },
    setters: {
      setDataset,
      setQualifications,
      setQualificationEdits,
      setQualificationModal,
      setForm,
      setSelectedEmployee,
      setPage,
      setSearch,
      setStatusFilter,
      setQualificationFilter,
      setAddNewPeriod,
      setEditModal,
    },
    derived: {
      filteredEmployees,
      averageFte,
      totalFte,
      totalHeadcount,
      crumbs,
      sidebarPage,
      pageTitle,
      pageSubtitle,
    },
    actions: {
      refreshDataset,
      goTo,
      handleSelect,
      handleSave,
      confirmDeleteEmployee,
      handleExport,
      handleSaveQualificationModal,
      confirmDeleteQualification,
      reorderQualification,
      openEditModal,
      openCreateModal,
      handleEditModalSave,
      resetForm,
    },
  };
};

export default useEmployees;
