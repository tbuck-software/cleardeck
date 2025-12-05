import { useCallback, useMemo, useState } from 'react';
import type { EmployeeWithPeriod, QualificationType, YearDataset } from '../shared/types';
import type { EditModalState, FormState, Page, QualificationModalState } from '../types/ui';
import { statusLabels } from '../constants';

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
    opts?: { confirmLabel?: string; danger?: boolean },
  ) => void;
};

const pageTitle: Record<Page, string> = {
  dashboard: 'Dashboard',
  list: 'Mitarbeitende',
  new: 'Neu anlegen',
  edit: 'Bearbeiten',
  settings: 'Einstellungen',
  view: 'Details',
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
    name: '',
    note: '',
    weeklyHours: '',
    linked: true,
    fteValue: '',
  });

  const refreshDataset = useCallback(
    async (targetYear: number) => {
      setLoading(true);
      try {
        const data = await window.api.listEmployees(targetYear);
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
          ? Math.min(1, Number((weeklyHoursNum / (baseHours || 36)).toFixed(2)))
          : form.fte;
      const payload = {
        ...form,
        periodId: addNewPeriod ? undefined : form.periodId,
        periodNote: null,
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
  }, [addNewPeriod, baseHours, form, handleError, resetForm, setLoading, setToast, year]);

  const deleteEmployee = useCallback(
    async (id: number) => {
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
    },
    [handleError, resetForm, setLoading, setToast, year],
  );

  const confirmDeleteEmployee = useCallback(
    (id?: number) => {
      if (!id) return;
      confirmAction('Mitarbeiter:in und Historie wirklich löschen?', () => deleteEmployee(id), {
        confirmLabel: 'Löschen',
        danger: true,
      });
    },
    [confirmAction, deleteEmployee],
  );

  const handleExport = useCallback(
    async (format: 'csv' | 'xlsx') => {
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
    },
    [handleError, setToast, year],
  );

  const handleSaveQualificationModal = useCallback(async () => {
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
  }, [handleError, qualificationModal, qualifications, setToast]);

  const handleDeleteQualification = useCallback(
    async (id: number) => {
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
    },
    [handleError],
  );

  const openEditModal = useCallback(() => {
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
  }, [baseHours, selectedEmployee]);

  const handleEditModalSave = useCallback(async () => {
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
  }, [baseHours, editModal, form, handleError, selectedEmployee, setLoading, setToast, year]);

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
    },
    [page, selectedEmployee],
  );

  const sidebarPage: Page = page === 'new' || page === 'edit' || page === 'view' ? 'list' : page;

  const pageSubtitle: Record<Page, string> = {
    dashboard: 'Kennzahlen und Aggregationen zum gewählten Jahr.',
    list: 'Liste mit Filter/Status und Doppelklick zum Bearbeiten.',
    new: 'Neue Person mit Historieneintrag erfassen.',
    edit: form.id ? `Bearbeitung: ${form.name}` : 'Bitte Eintrag aus Liste wählen.',
    settings: 'Datenbank austauschen oder Export/Import (verschlüsselt/unkryptiert).',
    view: selectedEmployee ? `Status: ${statusLabels[selectedEmployee.status]}` : '',
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
      handleEditModalSave,
      resetForm,
    },
  };
};

export default useEmployees;
