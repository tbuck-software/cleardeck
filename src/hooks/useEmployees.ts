import { localDate } from '../utils/calendarDate';
import { useCallback, useMemo, useState } from 'react';
import api from '../services/api';
import type {
  CompetencyDefinition,
  EmployeeCompetency,
  EmployeeInstruction,
  EmployeeWithPeriod,
  InstructionDefinition,
  QualificationType,
  YearDataset,
} from '../shared/types';
import type {
  CompetencyModalState,
  ConfirmActionOptions,
  EditModalState,
  EmployeeCompetencyModalState,
  EmployeeInstructionModalState,
  FormState,
  InstructionModalState,
  Page,
  QualificationModalState,
  SuggestedCompetencyModalState,
} from '../types/ui';
import { deriveFteFromWeeklyHours } from '../utils/fte';
import { matchesQualificationRelevance } from '../utils/qualificationRelevance';

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

const emptyCompetencyModal = (): CompetencyModalState => ({
  open: false,
  code: '',
  value: '',
  category: 'Allgemein',
  relevance: 'Alle',
  note: '',
});

const emptyEmployeeCompetencyModal = (): EmployeeCompetencyModalState => ({
  open: false,
  competencyDefinitionId: null,
  competencyName: '',
  level: null,
  approvedAt: '',
  approvedBy: '',
  note: '',
});

const emptyInstructionModal = (): InstructionModalState => ({
  open: false,
  topic: '',
  legalBasis: '',
  note: '',
  intervalMonths: null,
  intervalSource: 'betrieblich',
});

const emptyEmployeeInstructionModal = (): EmployeeInstructionModalState => ({
  open: false,
  instructionDefinitionId: null,
  instructionName: '',
  dueDate: '',
  completedAt: '',
  conductedBy: '',
  note: '',
  scheduleFollowUp: false,
});

const emptySuggestedCompetencyModal = (): SuggestedCompetencyModalState => ({
  open: false,
  selectedDefinitionIds: [],
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
  audit: 'MD-Prüfung',
  tasks: 'Heute zu tun',
  quals: 'Qualifikationen',
  services: 'Leistungen für betreute Personen',
  comps: 'Kompetenzen im Team',
  instrs: 'Einweisungen',
  security: 'Sicherheit & Backup',
  about: 'Über ClearDeck',
  logs: 'Logs & Diagnose',
  shortcuts: 'Tastenkürzel',
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
  const [competencyDefinitions, setCompetencyDefinitions] = useState<CompetencyDefinition[]>([]);
  const [competencyEdits, setCompetencyEdits] = useState<Record<number, string>>({});
  const [competencyModal, setCompetencyModal] =
    useState<CompetencyModalState>(emptyCompetencyModal());
  const [instructionDefinitions, setInstructionDefinitions] = useState<InstructionDefinition[]>([]);
  const [instructionModal, setInstructionModal] =
    useState<InstructionModalState>(emptyInstructionModal());
  const [form, setForm] = useState<FormState>(emptyForm(currentYear));
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithPeriod | null>(null);
  const [employeeCompetencies, setEmployeeCompetencies] = useState<EmployeeCompetency[]>([]);
  const [employeeInstructions, setEmployeeInstructions] = useState<EmployeeInstruction[]>([]);
  const [employeeCompetencyModal, setEmployeeCompetencyModal] =
    useState<EmployeeCompetencyModalState>(emptyEmployeeCompetencyModal());
  const [employeeInstructionModal, setEmployeeInstructionModal] =
    useState<EmployeeInstructionModalState>(emptyEmployeeInstructionModal());
  const [suggestedCompetencyModal, setSuggestedCompetencyModal] =
    useState<SuggestedCompetencyModalState>(emptySuggestedCompetencyModal());
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
    setEmployeeCompetencies([]);
    setEmployeeInstructions([]);
    setSuggestedCompetencyModal(emptySuggestedCompetencyModal());
  }, [qualifications, year]);

  const loadEmployeeCompetencies = useCallback(
    async (employeeId: number) => {
      try {
        const list = await api.competencies.listEmployee(employeeId);
        setEmployeeCompetencies(list);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const loadEmployeeInstructions = useCallback(
    async (employeeId: number) => {
      try {
        const list = await api.instructions.listEmployee(employeeId);
        setEmployeeInstructions(list);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

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
      if (emp.id) {
        await Promise.all([loadEmployeeCompetencies(emp.id), loadEmployeeInstructions(emp.id)]);
      } else {
        setEmployeeCompetencies([]);
        setEmployeeInstructions([]);
      }
      setSuggestedCompetencyModal(emptySuggestedCompetencyModal());
    },
    [baseHours, loadEmployeeCompetencies, loadEmployeeInstructions],
  );

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      handleError(new Error('Name darf nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const weeklyHoursNum =
        form.weeklyHours !== undefined && form.weeklyHours !== null
          ? Number(form.weeklyHours)
          : NaN;
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
      const list = qualificationModal.id
        ? await api.qualifications.update(qualificationModal.id, val, qualificationModal.note)
        : await api.qualifications.add(val, qualificationModal.note);
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
  }, [handleError, qualificationModal, setToast]);

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

  const handleSaveCompetencyModal = useCallback(async () => {
    const name = competencyModal.value.trim();
    if (!name) return;
    try {
      const list = competencyModal.id
        ? await api.competencies.updateDefinition({
            id: competencyModal.id,
            code: competencyModal.code,
            name,
            category: competencyModal.category,
            relevance: competencyModal.relevance,
            note: competencyModal.note,
          })
        : await api.competencies.addDefinition({
            code: competencyModal.code,
            name,
            category: competencyModal.category,
            relevance: competencyModal.relevance,
            note: competencyModal.note,
          });
      setCompetencyDefinitions(list);
      const edits: Record<number, string> = {};
      list.forEach((item) => {
        if (item.id) edits[item.id] = item.name;
      });
      setCompetencyEdits(edits);
      setCompetencyModal(emptyCompetencyModal());
      if (selectedEmployee?.id) {
        await loadEmployeeCompetencies(selectedEmployee.id);
      }
      setToast('Kompetenz gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  }, [competencyModal, handleError, loadEmployeeCompetencies, selectedEmployee, setToast]);

  const handleDeleteCompetencyDefinition = useCallback(
    async (id: number) => {
      try {
        const list = await api.competencies.deleteDefinition(id);
        setCompetencyDefinitions(list);
        const edits: Record<number, string> = {};
        list.forEach((item) => {
          if (item.id) edits[item.id] = item.name;
        });
        setCompetencyEdits(edits);
        if (selectedEmployee?.id) {
          await loadEmployeeCompetencies(selectedEmployee.id);
        }
        setToast('Kompetenz gelöscht.');
        setTimeout(() => setToast(null), 2000);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, loadEmployeeCompetencies, selectedEmployee, setToast],
  );

  const confirmDeleteCompetencyDefinition = useCallback(
    (id: number) => {
      confirmAction('Kompetenz wirklich löschen?', () => handleDeleteCompetencyDefinition(id), {
        confirmLabel: 'Löschen',
        danger: true,
      });
    },
    [confirmAction, handleDeleteCompetencyDefinition],
  );

  const reorderCompetencyDefinition = useCallback(
    async (orderedIds: number[]) => {
      try {
        const list = await api.competencies.reorderDefinitions(orderedIds);
        setCompetencyDefinitions(list);
        const edits: Record<number, string> = {};
        list.forEach((item) => {
          if (item.id) edits[item.id] = item.name;
        });
        setCompetencyEdits(edits);
        if (selectedEmployee?.id) {
          await loadEmployeeCompetencies(selectedEmployee.id);
        }
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, loadEmployeeCompetencies, selectedEmployee],
  );

  const handleSaveInstructionModal = useCallback(async () => {
    const topic = instructionModal.topic.trim();
    if (!topic) return;
    try {
      const list = instructionModal.id
        ? await api.instructions.updateDefinition({
            id: instructionModal.id,
            topic,
            legalBasis: instructionModal.legalBasis,
            note: instructionModal.note,
            intervalMonths: instructionModal.intervalMonths,
            intervalSource: instructionModal.intervalSource,
            minorHazardInstruction: instructionModal.minorHazardInstruction,
          })
        : await api.instructions.addDefinition({
            topic,
            legalBasis: instructionModal.legalBasis,
            note: instructionModal.note,
            intervalMonths: instructionModal.intervalMonths,
            intervalSource: instructionModal.intervalSource,
            minorHazardInstruction: instructionModal.minorHazardInstruction,
          });
      setInstructionDefinitions(list);
      setInstructionModal(emptyInstructionModal());
      if (selectedEmployee?.id) {
        await loadEmployeeInstructions(selectedEmployee.id);
      }
      setToast('Einweisung gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  }, [handleError, instructionModal, loadEmployeeInstructions, selectedEmployee, setToast]);

  const handleDeleteInstructionDefinition = useCallback(
    async (id: number) => {
      try {
        const list = await api.instructions.deleteDefinition(id);
        setInstructionDefinitions(list);
        if (selectedEmployee?.id) {
          await loadEmployeeInstructions(selectedEmployee.id);
        }
        setToast('Einweisung gelöscht.');
        setTimeout(() => setToast(null), 2000);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, loadEmployeeInstructions, selectedEmployee, setToast],
  );

  const confirmDeleteInstructionDefinition = useCallback(
    (id: number) => {
      confirmAction('Einweisung wirklich löschen?', () => handleDeleteInstructionDefinition(id), {
        confirmLabel: 'Löschen',
        danger: true,
      });
    },
    [confirmAction, handleDeleteInstructionDefinition],
  );

  const reorderInstructionDefinition = useCallback(
    async (orderedIds: number[]) => {
      try {
        const list = await api.instructions.reorderDefinitions(orderedIds);
        setInstructionDefinitions(list);
        if (selectedEmployee?.id) {
          await loadEmployeeInstructions(selectedEmployee.id);
        }
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, loadEmployeeInstructions, selectedEmployee],
  );

  const openEmployeeCompetencyModal = useCallback((entry: EmployeeCompetency) => {
    setEmployeeCompetencyModal({
      open: true,
      id: entry.id,
      competencyDefinitionId: entry.competencyDefinitionId,
      competencyName: entry.competencyName,
      level: entry.level ?? null,
      stageScheme: entry.stageScheme ?? 'legacy',
      stageHistory: entry.stageHistory,
      approvedAt: entry.approvedAt ?? '',
      approvedBy: entry.approvedBy ?? '',
      note: entry.note ?? '',
    });
  }, []);

  const openNewEmployeeCompetencyModal = useCallback(() => {
    const assignedDefinitionIds = new Set(
      employeeCompetencies.map((entry) => entry.competencyDefinitionId),
    );
    const nextDefinition = competencyDefinitions.find(
      (definition) => definition.id && !assignedDefinitionIds.has(definition.id),
    );

    if (!nextDefinition?.id) {
      setToast('Alle Kompetenzen sind bereits zugeordnet.');
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setEmployeeCompetencyModal({
      open: true,
      competencyDefinitionId: nextDefinition.id,
      competencyName: nextDefinition.name,
      level: null,
      approvedAt: '',
      approvedBy: '',
      note: '',
    });
  }, [competencyDefinitions, employeeCompetencies, setToast]);

  const getRecommendedCompetencyDefinitions = useCallback(() => {
    if (!selectedEmployee?.id) {
      return [];
    }

    const assignedDefinitionIds = new Set(
      employeeCompetencies.map((entry) => entry.competencyDefinitionId),
    );

    return competencyDefinitions.filter(
      (definition) =>
        definition.id &&
        !assignedDefinitionIds.has(definition.id) &&
        matchesQualificationRelevance(selectedEmployee.qualification, definition.relevance),
    );
  }, [competencyDefinitions, employeeCompetencies, selectedEmployee]);

  const handleSaveEmployeeCompetency = useCallback(async () => {
    if (!selectedEmployee?.id || !employeeCompetencyModal.competencyDefinitionId) return;
    try {
      const list = await api.competencies.saveEmployee({
        id: employeeCompetencyModal.id,
        employeeId: selectedEmployee.id,
        competencyDefinitionId: employeeCompetencyModal.competencyDefinitionId,
        level: employeeCompetencyModal.level,
        stageScheme: employeeCompetencyModal.stageScheme ?? 'practice-v1',
        approvedAt: employeeCompetencyModal.approvedAt || null,
        approvedBy: employeeCompetencyModal.approvedBy || null,
        note: employeeCompetencyModal.note || null,
      });
      setEmployeeCompetencies(list);
      setEmployeeCompetencyModal(emptyEmployeeCompetencyModal());
      setToast('Kompetenz gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  }, [employeeCompetencyModal, handleError, selectedEmployee, setToast]);

  const handleDeleteEmployeeCompetency = useCallback(async () => {
    if (!selectedEmployee?.id || !employeeCompetencyModal.competencyDefinitionId) return;
    try {
      const list = await api.competencies.deleteEmployee(
        selectedEmployee.id,
        employeeCompetencyModal.competencyDefinitionId,
      );
      setEmployeeCompetencies(list);
      setEmployeeCompetencyModal(emptyEmployeeCompetencyModal());
      setToast('Kompetenz entfernt.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  }, [employeeCompetencyModal.competencyDefinitionId, handleError, selectedEmployee, setToast]);

  const openSuggestedCompetencyModal = useCallback(() => {
    const recommendedDefinitions = getRecommendedCompetencyDefinitions();
    if (recommendedDefinitions.length === 0) {
      setToast('Keine passenden Kompetenzen zur Qualifikation gefunden.');
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setSuggestedCompetencyModal({
      open: true,
      selectedDefinitionIds: [],
    });
  }, [getRecommendedCompetencyDefinitions, setToast]);

  const toggleSuggestedCompetencySelection = useCallback((definitionId: number) => {
    setSuggestedCompetencyModal((prev) => ({
      ...prev,
      selectedDefinitionIds: prev.selectedDefinitionIds.includes(definitionId)
        ? prev.selectedDefinitionIds.filter((id) => id !== definitionId)
        : [...prev.selectedDefinitionIds, definitionId],
    }));
  }, []);

  const selectAllSuggestedCompetencies = useCallback(() => {
    const recommendedDefinitionIds = getRecommendedCompetencyDefinitions()
      .map((definition) => definition.id)
      .filter((id): id is number => typeof id === 'number');

    setSuggestedCompetencyModal((prev) => ({
      ...prev,
      selectedDefinitionIds: recommendedDefinitionIds,
    }));
  }, [getRecommendedCompetencyDefinitions]);

  const handleAddRecommendedCompetencies = useCallback(async () => {
    if (!selectedEmployee?.id) return;

    const selectedDefinitionIds = suggestedCompetencyModal.selectedDefinitionIds;
    if (selectedDefinitionIds.length === 0) {
      setToast('Bitte wähle mindestens eine Kompetenz aus.');
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setLoading(true);
    try {
      let list: EmployeeCompetency[] = employeeCompetencies;
      for (const competencyDefinitionId of selectedDefinitionIds) {
        list = await api.competencies.saveEmployee({
          employeeId: selectedEmployee.id,
          competencyDefinitionId,
          level: null,
          approvedAt: null,
          approvedBy: null,
          note: null,
        });
      }
      setEmployeeCompetencies(list);
      setSuggestedCompetencyModal(emptySuggestedCompetencyModal());
      setToast(`${selectedDefinitionIds.length} Kompetenzen hinzugefügt.`);
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [
    employeeCompetencies,
    handleError,
    selectedEmployee,
    setSuggestedCompetencyModal,
    setLoading,
    setToast,
    suggestedCompetencyModal.selectedDefinitionIds,
  ]);

  const openEmployeeInstructionModal = useCallback((entry: EmployeeInstruction) => {
    setEmployeeInstructionModal({
      open: true,
      id: entry.id,
      instructionDefinitionId: entry.instructionDefinitionId,
      instructionName: entry.instructionName,
      dueDate: entry.dueDate ?? '',
      completedAt: entry.completedAt ?? '',
      conductedBy: entry.conductedBy ?? '',
      note: entry.note ?? '',
      evidenceRef: entry.evidenceRef ?? '',
      content: entry.content ?? '',
      scheduleReviewRequired: entry.scheduleReviewRequired ?? false,
      scheduleFollowUp: true,
    });
  }, []);

  const openNewEmployeeInstructionModal = useCallback(() => {
    const assignedDefinitionIds = new Set(
      employeeInstructions
        .filter((entry) => !entry.completedAt)
        .map((entry) => entry.instructionDefinitionId),
    );
    const nextDefinition = instructionDefinitions.find(
      (definition) => definition.id && !assignedDefinitionIds.has(definition.id),
    );

    if (!nextDefinition?.id) {
      setToast('Alle Einweisungen sind bereits zugeordnet.');
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setEmployeeInstructionModal({
      open: true,
      instructionDefinitionId: nextDefinition.id,
      instructionName: nextDefinition.topic,
      dueDate: '',
      completedAt: '',
      conductedBy: '',
      note: '',
      scheduleFollowUp: true,
    });
  }, [employeeInstructions, instructionDefinitions, setToast]);

  const handleSaveEmployeeInstruction = useCallback(async () => {
    if (!selectedEmployee?.id || !employeeInstructionModal.instructionDefinitionId) return;
    try {
      const list = await api.instructions.saveEmployee({
        id: employeeInstructionModal.id,
        employeeId: selectedEmployee.id,
        instructionDefinitionId: employeeInstructionModal.instructionDefinitionId,
        dueDate: employeeInstructionModal.dueDate || null,
        completedAt: employeeInstructionModal.completedAt || null,
        conductedBy: employeeInstructionModal.conductedBy || null,
        note: employeeInstructionModal.note || null,
        scheduleFollowUp: employeeInstructionModal.scheduleFollowUp,
        evidenceRef: employeeInstructionModal.evidenceRef,
        content: employeeInstructionModal.content,
        scheduleReviewRequired: employeeInstructionModal.scheduleReviewRequired,
      });
      setEmployeeInstructions(list);
      setEmployeeInstructionModal(emptyEmployeeInstructionModal());
      setToast('Einweisung gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  }, [employeeInstructionModal, handleError, selectedEmployee, setToast]);

  const handleDeleteEmployeeInstruction = useCallback(async () => {
    if (!selectedEmployee?.id || !employeeInstructionModal.id) return;
    try {
      const list = await api.instructions.deleteEmployee(
        selectedEmployee.id,
        employeeInstructionModal.id,
      );
      setEmployeeInstructions(list);
      setEmployeeInstructionModal(emptyEmployeeInstructionModal());
      setToast('Einweisung entfernt.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  }, [employeeInstructionModal.id, handleError, selectedEmployee, setToast]);

  const openEditModal = useCallback(() => {
    if (!selectedEmployee) return;
    const cappedSelectedFte = clampFte(selectedEmployee.fte);
    const computedWeeklyHours =
      selectedEmployee.weeklyHours !== null && selectedEmployee.weeklyHours !== undefined
        ? String(selectedEmployee.weeklyHours)
        : '';
    const today = localDate();
    const fallbackEffectiveFrom = today < selectedEmployee.startDate
      ? selectedEmployee.startDate
      : selectedEmployee.endDate && selectedEmployee.endDate < today
        ? selectedEmployee.endDate
        : today;
    const departed = Boolean(selectedEmployee.endDate && selectedEmployee.endDate < today);
    const existingEffectiveFrom = selectedEmployee.hoursEffectiveFrom &&
      selectedEmployee.hoursEffectiveFrom >= selectedEmployee.startDate &&
      (!selectedEmployee.endDate || selectedEmployee.hoursEffectiveFrom <= selectedEmployee.endDate)
      ? selectedEmployee.hoursEffectiveFrom
      : undefined;
    const effectiveFrom = departed && existingEffectiveFrom
      ? existingEffectiveFrom
      : fallbackEffectiveFrom;
    setEditModal({
      open: true,
      mode: 'edit',
      name: selectedEmployee.name,
      note: selectedEmployee.note ?? '',
      weeklyHours: computedWeeklyHours,
      fteValue: String(cappedSelectedFte),
      linked: false,
      birthDate: selectedEmployee.birthDate ?? '',
      hoursEffectiveFrom: effectiveFrom,
      initialHoursEffectiveFrom: effectiveFrom,
      existingHoursEffectiveFrom: selectedEmployee.hoursEffectiveFrom,
      sourceRef: selectedEmployee.sourceRef ?? '',
    });
  }, [baseHours, selectedEmployee]);

  const openCreateModal = useCallback(() => {
    const defaultQualification = qualifications[0]?.name ?? '';
    const freshForm = emptyForm(year, defaultQualification);
    setForm(freshForm);
    setAddNewPeriod(false);
    setSelectedEmployee(null);
    setEmployeeCompetencies([]);
    setEmployeeInstructions([]);
    setSuggestedCompetencyModal(emptySuggestedCompetencyModal());
    setEditModal({
      open: true,
      mode: 'create',
      name: '',
      note: '',
      weeklyHours: '',
      linked: true,
      fteValue: '',
      birthDate: '',
    });
  }, [qualifications, year]);

  const handleEditModalSave = useCallback(async () => {
    if (editModal.mode === 'create') {
      if (!editModal.name.trim()) {
        handleError(new Error('Name darf nicht leer sein.'));
        return;
      }
      if (!editModal.weeklyHours && !editModal.fteValue) {
        handleError(
          new Error('Bitte Wochenstunden oder einen ausdrücklich festgelegten VZÄ-Wert eintragen.'),
        );
        return;
      }
      setLoading(true);
      try {
        const weeklyHoursNum =
          editModal.weeklyHours !== '' ? Number(editModal.weeklyHours) : (form.weeklyHours ?? null);
        const useLinked = editModal.linked ?? true;
        const derivedFte =
          useLinked &&
          typeof weeklyHoursNum === 'number' &&
          !Number.isNaN(weeklyHoursNum) &&
          weeklyHoursNum > 0
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
          hoursEffectiveFrom:
            editModal.mode === 'create' ? form.startDate : editModal.hoursEffectiveFrom,
          hoursVerified: true,
          sourceRef: editModal.sourceRef,
        };
        const updated = await api.employees.save(payload);
        setDataset(updated);
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
        setToast('Gespeichert.');
        setPage('list');
        resetForm();
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
        setTimeout(() => setToast(null), 2000);
      }
      return;
    }
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const weeklyHoursNum =
        editModal.weeklyHours !== '' ? Number(editModal.weeklyHours) : (form.weeklyHours ?? null);
      const useLinked = editModal.linked ?? true;
      const derivedFte =
        useLinked &&
        typeof weeklyHoursNum === 'number' &&
        !Number.isNaN(weeklyHoursNum) &&
        weeklyHoursNum > 0
          ? deriveFteFromWeeklyHours(weeklyHoursNum, baseHours)
          : editModal.fteValue
            ? Number(editModal.fteValue)
            : form.fte;
      const fteValue = Math.min(1, Number(derivedFte) || 0);
      const updateHours =
        weeklyHoursNum !== (selectedEmployee.weeklyHours ?? null) ||
        fteValue !== selectedEmployee.fte ||
        editModal.hoursEffectiveFrom !== editModal.initialHoursEffectiveFrom;
      if (updateHours && !editModal.hoursEffectiveFrom) {
        throw new Error('Bitte angeben, ab wann die Arbeitszeit gilt.');
      }
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
        hoursEffectiveFrom: editModal.hoursEffectiveFrom,
        sourceRef: editModal.sourceRef,
        hoursVerified: updateHours,
      };
      const updated = await api.employees.save({
        ...payload,
        updateHours,
      });
      setDataset(updated);
      const refreshed =
        updated.employees.find((employee) =>
          employee.id === selectedEmployee.id && employee.periodId === selectedEmployee.periodId) ??
        (await api.employees.list(year, 'directory')).employees.find(
          (employee) => employee.id === selectedEmployee.id && employee.periodId === selectedEmployee.periodId,
        );
      if (refreshed) setSelectedEmployee(refreshed);
      setForm((prev) => ({
        ...prev,
        name: payload.name,
        note: payload.note,
        weeklyHours: weeklyHoursNum ?? prev.weeklyHours ?? null,
        fte: payload.fte,
      }));
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
      setToast('Gespeichert.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  }, [
    baseHours,
    editModal,
    form,
    handleError,
    resetForm,
    selectedEmployee,
    setLoading,
    setPage,
    setToast,
    year,
  ]);

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

  const crumbs = useCallback((): { label: string; page?: Page }[] => {
    if (page === 'dashboard') return [{ label: 'Dashboard' }];
    if (page === 'list') return [{ label: 'Dashboard', page: 'dashboard' }, { label: 'Team' }];
    if (page === 'new')
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Team', page: 'list' },
        { label: 'Neu anlegen' },
      ];
    if (page === 'settings')
      return [{ label: 'Dashboard', page: 'dashboard' }, { label: 'Einstellungen' }];
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
  }, [page, selectedEmployee]);

  const getSidebarPage = (): Page => {
    if (page === 'new' || page === 'edit' || page === 'view') return 'list';
    if (page === 'patient-view' || page === 'patient-new' || page === 'patient-edit')
      return 'patients';
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
    audit: 'Qualitätsprüfung nach QPR ambulant.',
    tasks: 'Offene Fristen, Visiten und Datenlücken.',
    quals: 'Kategorien für den Jahresnachweis.',
    services: 'Leistungskatalog für die Versorgungsangaben der Patient:innen.',
    comps: 'Fachthemen der Kompetenzmatrix.',
    instrs: 'Pflichtunterweisungen mit Rechtsgrundlage.',
    security: 'Verschlüsselung, Backup und Wiederherstellung.',
    about: 'Version, Lizenz und Kontakt.',
    logs: 'Diagnose für Support-Anfragen.',
    shortcuts: 'Tastenkürzel der App.',
  };

  return {
    state: {
      dataset,
      qualifications,
      competencyDefinitions,
      instructionDefinitions,
      qualificationEdits,
      competencyEdits,
      qualificationModal,
      competencyModal,
      instructionModal,
      form,
      selectedEmployee,
      employeeCompetencies,
      employeeInstructions,
      employeeCompetencyModal,
      employeeInstructionModal,
      suggestedCompetencyModal,
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
      setCompetencyDefinitions,
      setInstructionDefinitions,
      setQualificationEdits,
      setCompetencyEdits,
      setQualificationModal,
      setCompetencyModal,
      setInstructionModal,
      setForm,
      setSelectedEmployee,
      setEmployeeCompetencies,
      setEmployeeInstructions,
      setEmployeeCompetencyModal,
      setEmployeeInstructionModal,
      setSuggestedCompetencyModal,
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
      handleSaveCompetencyModal,
      confirmDeleteCompetencyDefinition,
      reorderCompetencyDefinition,
      handleSaveInstructionModal,
      confirmDeleteInstructionDefinition,
      reorderInstructionDefinition,
      loadEmployeeCompetencies,
      loadEmployeeInstructions,
      openEmployeeCompetencyModal,
      openNewEmployeeCompetencyModal,
      openSuggestedCompetencyModal,
      toggleSuggestedCompetencySelection,
      selectAllSuggestedCompetencies,
      handleAddRecommendedCompetencies,
      handleSaveEmployeeCompetency,
      handleDeleteEmployeeCompetency,
      openEmployeeInstructionModal,
      openNewEmployeeInstructionModal,
      handleSaveEmployeeInstruction,
      handleDeleteEmployeeInstruction,
      openEditModal,
      openCreateModal,
      handleEditModalSave,
      resetForm,
    },
  };
};

export default useEmployees;
