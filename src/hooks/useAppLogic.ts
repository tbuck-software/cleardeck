import { localDate } from '../utils/calendarDate';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import type { AppState, EmployeeWithPeriod, YearDataset } from '../shared/types';
import { statusLabels, fteHelp } from '../constants';
import useConfirmations from './useConfirmations';
import useRecovery from './useRecovery';
import useSettingsDb from './useSettingsDb';
import useEventsPeriods from './useEventsPeriods';
import useEmploymentActions from './useEmploymentActions';
import useEmployees from './useEmployees';
import useAuth from './useAuth';
import useUpcomingEvents from './useUpcomingEvents';
import useCalendar from './useCalendar';
import useDashboardWidgets from './useDashboardWidgets';
import useEmploymentIntegrity from './useEmploymentIntegrity';
import usePatients from './usePatients';
import usePatientDashboard from './usePatientDashboard';
import useServiceCatalog from './useServiceCatalog';
import { userFacingErrorMessage } from '../utils/errorMessage';

export type RefreshAllResult = {
  dataset: YearDataset;
  directoryDataset: YearDataset;
  currentDataset: YearDataset;
};

export type RefreshAllOptions = {
  /** Lets the caller cancel the commit if an editor opened while reads ran. */
  shouldApply?: () => boolean;
};

const useAppLogic = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState<number>(currentYear);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [baseHoursForEmployees, setBaseHoursForEmployees] = useState(36);

  const handleError = useCallback((err: unknown) => {
    const message = userFacingErrorMessage(err);
    setError(message);
    setTimeout(() => setError(null), 3500);
  }, []);

  const showToast = useCallback((msg: string | null, timeout = 2000) => {
    setToast(msg);
    if (msg) {
      setTimeout(() => setToast(null), timeout);
    }
  }, []);

  const { confirmState, setConfirmState, confirmAction } = useConfirmations();

  const employeeSlice = useEmployees({
    year,
    currentYear,
    baseHours: baseHoursForEmployees,
    handleError,
    setLoading,
    setToast: showToast,
    confirmAction,
  });

  const eventSlice = useEventsPeriods({
    year,
    qualifications: employeeSlice.state.qualifications,
    setForm: employeeSlice.setters.setForm,
    selectedEmployee: employeeSlice.state.selectedEmployee,
    setSelectedEmployee: employeeSlice.setters.setSelectedEmployee,
    setDataset: employeeSlice.setters.setDataset,
    handleError,
    setLoading,
    setToast: showToast,
    confirmAction,
  });

  const employmentActionSlice = useEmploymentActions({
    year,
    selectedEmployee: employeeSlice.state.selectedEmployee,
    setDataset: employeeSlice.setters.setDataset,
    setSelectedEmployee: employeeSlice.setters.setSelectedEmployee,
    setForm: employeeSlice.setters.setForm,
    loadHistory: eventSlice.actions.loadHistory,
    setToast: showToast,
  });

  const {
    recoveryKeyModal,
    recoveryReset,
    setRecoveryKeyModal,
    setRecoveryReset,
    openRecoveryKey,
    handleCopyRecoveryKey,
    startRecoveryReset,
    handleRecoveryReset,
  } = useRecovery({
    onError: handleError,
    onToast: (msg, timeout = 2000) => showToast(msg, timeout),
    refreshDataset: employeeSlice.actions.refreshDataset,
    year,
    setLoading,
  });

  const appReadySetterRef = useRef<(state: AppState) => void>((state) => {
    void state;
  });

  const settingsSlice = useSettingsDb({
    year,
    refreshDataset: employeeSlice.actions.refreshDataset,
    onError: handleError,
    onToast: showToast,
    confirmAction,
    onAfterDrop: () => {
      employeeSlice.setters.setDataset(null);
      employeeSlice.setters.setSelectedEmployee(null);
      employeeSlice.actions.resetForm();
      employeeSlice.setters.setPage('dashboard');
    },
    onAfterReset: (state) => {
      appReadySetterRef.current(state);
      employeeSlice.setters.setDataset(null);
      employeeSlice.setters.setSelectedEmployee(null);
      employeeSlice.actions.resetForm();
      employeeSlice.setters.setPage('dashboard');
    },
    onAuthStateChange: (state) => {
      appReadySetterRef.current(state);
    },
    onOpenRecoveryKey: async () => openRecoveryKey('settings'),
  });

  useEffect(() => {
    setBaseHoursForEmployees(settingsSlice.state.baseHours);
  }, [settingsSlice.state.baseHours]);

  const authSlice = useAuth({
    year,
    handleError,
    setLoading,
    refreshDataset: employeeSlice.actions.refreshDataset,
    openRecoveryKey,
    setForm: employeeSlice.setters.setForm,
    setQualifications: employeeSlice.setters.setQualifications,
    setQualificationEdits: employeeSlice.setters.setQualificationEdits,
    setCompetencyDefinitions: employeeSlice.setters.setCompetencyDefinitions,
    setCompetencyEdits: employeeSlice.setters.setCompetencyEdits,
    setInstructionDefinitions: employeeSlice.setters.setInstructionDefinitions,
    hydrateBaseHours: settingsSlice.actions.hydrateBaseHours,
  });

  appReadySetterRef.current = authSlice.setAppReady;

  const employmentIntegritySlice = useEmploymentIntegrity({
    enabled: authSlice.appReady.unlocked,
    dataVersion: employeeSlice.state.dataset,
    handleError,
  });

  const upcomingEventsSlice = useUpcomingEvents({ handleError });

  const calendarSlice = useCalendar({
    handleError,
    hiddenEventTypes: upcomingEventsSlice.state.hiddenEventTypes,
    enabled: authSlice.appReady.unlocked,
  });

  const dashboardWidgetsSlice = useDashboardWidgets({ handleError });

  const patientSlice = usePatients({
    handleError,
    setLoading,
    setToast: showToast,
    confirmAction,
  });

  const patientDashboardSlice = usePatientDashboard({ handleError });
  const serviceCatalogSlice = useServiceCatalog({
    handleError,
    setToast: showToast,
    confirmAction,
    refreshPatients: patientSlice.actions.refreshPatients,
  });

  // Store actions in refs to avoid dependency changes triggering the effect
  const loadActionsRef = useRef({
    loadHiddenEventTypes: upcomingEventsSlice.actions.loadHiddenEventTypes,
    loadUpcomingEvents: upcomingEventsSlice.actions.loadUpcomingEvents,
    loadDashboardWidgets: dashboardWidgetsSlice.actions.loadAll,
    refreshPatients: patientSlice.actions.refreshPatients,
    loadPatientDashboard: patientDashboardSlice.actions.loadAll,
    loadCalendar: calendarSlice.actions.loadEvents,
    loadServiceDefinitions: serviceCatalogSlice.actions.loadServiceDefinitions,
  });
  loadActionsRef.current = {
    loadHiddenEventTypes: upcomingEventsSlice.actions.loadHiddenEventTypes,
    loadUpcomingEvents: upcomingEventsSlice.actions.loadUpcomingEvents,
    loadDashboardWidgets: dashboardWidgetsSlice.actions.loadAll,
    refreshPatients: patientSlice.actions.refreshPatients,
    loadPatientDashboard: patientDashboardSlice.actions.loadAll,
    loadCalendar: calendarSlice.actions.loadEvents,
    loadServiceDefinitions: serviceCatalogSlice.actions.loadServiceDefinitions,
  };

  /**
   * Re-read every renderer read model after the main process applies a remote
   * change. This intentionally updates state in place: modal state and form
   * drafts live in their own slices and are never reset by a refresh.
   */
  const refreshAll = useCallback(async (options: RefreshAllOptions = {}): Promise<RefreshAllResult | null> => {
    if (!authSlice.appReady.unlocked) return null;
    const shouldApply = options.shouldApply ?? (() => true);

    const selectedEmployee = employeeSlice.state.selectedEmployee;
    const selectedEmployeeId = selectedEmployee?.id;
    const selectedPeriodId = selectedEmployee?.periodId;
    const selectedPatient = patientSlice.state.selectedPatient;
    const selectedPatientId = selectedPatient?.id;

    const [nextDataset, nextDirectoryDataset, nextCurrentDataset, nextQualifications, nextCompetencies, nextInstructions, nextPatients, nextServiceDefinitions] = await Promise.all([
      api.employees.list(year),
      api.employees.list(currentYear, 'directory'),
      api.employees.list(currentYear, 'current'),
      api.qualifications.list(),
      api.competencies.listDefinitions(),
      api.instructions.listDefinitions(),
      api.patients.list(),
      api.services.list(),
    ]);

    if (!shouldApply()) return null;

    employeeSlice.setters.setDataset(nextDataset);
    employeeSlice.setters.setQualifications(nextQualifications);
    employeeSlice.setters.setCompetencyDefinitions(nextCompetencies);
    employeeSlice.setters.setInstructionDefinitions(nextInstructions);
    serviceCatalogSlice.setters.setServiceDefinitions(nextServiceDefinitions);
    patientSlice.setters.setPatients(nextPatients);
    authSlice.hydrateQualifications(nextQualifications);

    const freshEmployee = selectedEmployeeId == null
      ? undefined
      : [nextDataset, nextDirectoryDataset, nextCurrentDataset]
          .flatMap((data) => data.employees)
          .find((employee) =>
            employee.id === selectedEmployeeId &&
            (selectedPeriodId == null || employee.periodId === selectedPeriodId),
          ) ??
        [nextDataset, nextDirectoryDataset, nextCurrentDataset]
          .flatMap((data) => data.employees)
          .find((employee) => employee.id === selectedEmployeeId);

    if (selectedEmployeeId != null && freshEmployee) {
      if (!shouldApply()) return null;
      employeeSlice.setters.setSelectedEmployee(freshEmployee);
      employeeSlice.setters.setForm((previous) => ({
        ...previous,
        id: freshEmployee.id,
        periodId: freshEmployee.periodId,
        name: freshEmployee.name,
        qualification: freshEmployee.qualification,
        note: freshEmployee.note ?? '',
        startDate: freshEmployee.startDate,
        endDate: freshEmployee.endDate ?? '',
        fte: freshEmployee.fte ?? previous.fte,
        weeklyHours: freshEmployee.weeklyHours ?? null,
        linked: true,
      }));
      await Promise.all([
        eventSlice.actions.loadHistory(selectedEmployeeId),
        employeeSlice.actions.loadEmployeeCompetencies(selectedEmployeeId),
        employeeSlice.actions.loadEmployeeInstructions(selectedEmployeeId),
      ]);
    } else if (selectedEmployeeId != null) {
      if (!shouldApply()) return null;
      employeeSlice.setters.setSelectedEmployee(null);
      employeeSlice.actions.resetForm();
      employeeSlice.setters.setPage('list');
    }

    if (selectedPatientId != null) {
      if (!shouldApply()) return null;
      const freshPatient = nextPatients.find((patient) => patient.id === selectedPatientId);
      if (freshPatient) {
        patientSlice.setters.setSelectedPatient(freshPatient);
        await patientSlice.actions.loadVisits(selectedPatientId);
      } else {
        patientSlice.setters.setSelectedPatient(null);
        patientSlice.setters.setVisits([]);
      }
    }

    await Promise.all([
      settingsSlice.actions.hydrateFromApi(),
      loadActionsRef.current.loadHiddenEventTypes(),
      loadActionsRef.current.loadUpcomingEvents(),
      loadActionsRef.current.loadDashboardWidgets(),
      loadActionsRef.current.loadPatientDashboard(),
      loadActionsRef.current.loadCalendar(),
      employmentIntegritySlice.refresh(),
    ]);

    return {
      dataset: nextDataset,
      directoryDataset: nextDirectoryDataset,
      currentDataset: nextCurrentDataset,
    };
  }, [
    api,
    authSlice.appReady.unlocked,
    authSlice.hydrateQualifications,
    currentYear,
    employeeSlice.actions,
    employeeSlice.setters,
    employeeSlice.state.selectedEmployee,
    employmentIntegritySlice.refresh,
    eventSlice.actions,
    patientSlice.actions,
    patientSlice.setters,
    patientSlice.state.selectedPatient,
    serviceCatalogSlice.setters,
    settingsSlice.actions,
    year,
  ]);

  // Load upcoming events and filters when app is unlocked
  useEffect(() => {
    if (authSlice.appReady.unlocked) {
      loadActionsRef.current.loadHiddenEventTypes();
      loadActionsRef.current.loadUpcomingEvents();
      loadActionsRef.current.loadDashboardWidgets();
      loadActionsRef.current.refreshPatients();
      loadActionsRef.current.loadPatientDashboard();
      loadActionsRef.current.loadServiceDefinitions();
    }
  }, [authSlice.appReady.unlocked]);

  useEffect(() => {
    if (!authSlice.appReady.unlocked) return;
    void loadActionsRef.current.loadDashboardWidgets();
  }, [
    authSlice.appReady.unlocked,
    employeeSlice.state.dataset,
    employeeSlice.state.employeeInstructions,
    employeeSlice.state.employeeCompetencies,
    eventSlice.state.events,
  ]);

  useEffect(() => {
    if (!authSlice.appReady.unlocked) return;
    void loadActionsRef.current.loadCalendar();
    void loadActionsRef.current.loadUpcomingEvents();
    void loadActionsRef.current.loadPatientDashboard();
  }, [
    authSlice.appReady.unlocked,
    employeeSlice.state.dataset,
    employeeSlice.state.employeeInstructions,
    eventSlice.state.events,
    patientSlice.state.patients,
    patientSlice.state.visits,
  ]);

  useEffect(() => {
    if (employeeSlice.state.qualificationFilter === 'all') return;
    const exists = employeeSlice.state.qualifications.some(
      (q) => q.name === employeeSlice.state.qualificationFilter,
    );
    if (!exists) {
      employeeSlice.setters.setQualificationFilter('all');
    }
  }, [
    employeeSlice.state.qualifications,
    employeeSlice.state.qualificationFilter,
    employeeSlice.setters,
  ]);

  const handleSelectWithHistory = async (emp: EmployeeWithPeriod) => {
    await employeeSlice.actions.handleSelect(emp);
    if (emp?.id) {
      try {
        await eventSlice.actions.loadHistory(emp.id);
      } catch (err) {
        handleError(err);
      }
    }
    eventSlice.setters.setAddPeriodForm((prev) => ({
      ...prev,
      startDate: emp.startDate ?? `${year}-01-01`,
      endDate: '',
      fte: 1,
      qualification: employeeSlice.state.qualifications[0]?.name ?? emp.qualification,
      periodId: undefined,
      note: '',
    }));
    eventSlice.setters.setEventModal((prev) => ({
      ...prev,
      type: 'period',
      eventDate: localDate(),
      title: '',
      details: '',
      previousValue: null,
      newValue: null,
    }));
  };

  const handleEditModalSaveWithHistory = async () => {
    await employeeSlice.actions.handleEditModalSave();
    const id = employeeSlice.state.selectedEmployee?.id;
    if (id) {
      try {
        await eventSlice.actions.loadHistory(id);
      } catch (err) {
        handleError(err);
      }
    }
  };

  return {
    constants: {
      statusLabels,
      fteHelp,
      pageTitle: employeeSlice.derived.pageTitle,
      pageSubtitle: employeeSlice.derived.pageSubtitle,
    },
    state: {
      currentYear,
      year,
      dataset: employeeSlice.state.dataset,
      baseHours: settingsSlice.state.baseHours,
      baseHoursInput: settingsSlice.state.baseHoursInput,
      qualifications: employeeSlice.state.qualifications,
      competencyDefinitions: employeeSlice.state.competencyDefinitions,
      instructionDefinitions: employeeSlice.state.instructionDefinitions,
      form: employeeSlice.state.form,
      periods: eventSlice.state.periods,
      events: eventSlice.state.events,
      selectedEmployee: employeeSlice.state.selectedEmployee,
      employeeCompetencies: employeeSlice.state.employeeCompetencies,
      employeeInstructions: employeeSlice.state.employeeInstructions,
      appReady: authSlice.appReady,
      authLoading: authSlice.authLoading,
      page: employeeSlice.state.page,
      loading,
      toast,
      error,
      updateStatus: settingsSlice.state.updateStatus,
      lastUpdateCheckAt: settingsSlice.state.lastUpdateCheckAt,
      dbMessage: settingsSlice.state.dbMessage,
      appInfo: settingsSlice.state.appInfo,
      storageMode: settingsSlice.state.storageMode,
      encryptionSetup: settingsSlice.state.encryptionSetup,
      search: employeeSlice.state.search,
      statusFilter: employeeSlice.state.statusFilter,
      qualificationFilter: employeeSlice.state.qualificationFilter,
      addNewPeriod: employeeSlice.state.addNewPeriod,
      qualificationEdits: employeeSlice.state.qualificationEdits,
      competencyEdits: employeeSlice.state.competencyEdits,
      qualificationModal: employeeSlice.state.qualificationModal,
      competencyModal: employeeSlice.state.competencyModal,
      instructionModal: employeeSlice.state.instructionModal,
      editModal: employeeSlice.state.editModal,
      employeeCompetencyModal: employeeSlice.state.employeeCompetencyModal,
      employeeInstructionModal: employeeSlice.state.employeeInstructionModal,
      suggestedCompetencyModal: employeeSlice.state.suggestedCompetencyModal,
      addPeriodForm: eventSlice.state.addPeriodForm,
      periodToDelete: eventSlice.state.periodToDelete,
      eventModal: eventSlice.state.eventModal,
      employmentAction: employmentActionSlice.state,
      confirmState,
      recoveryKeyModal,
      recoveryReset,
      upcomingEvents: upcomingEventsSlice.state.allUpcomingEvents,
      hiddenEventTypes: upcomingEventsSlice.state.hiddenEventTypes,
      calendar: calendarSlice.state,
      dashboardWidgets: dashboardWidgetsSlice.state,
      employmentIntegrity: employmentIntegritySlice.overview,
      employmentIntegrityStatus: employmentIntegritySlice.status,
      // Patient state
      patients: patientSlice.state.patients,
      selectedPatient: patientSlice.state.selectedPatient,
      patientVisits: patientSlice.state.visits,
      patientModal: patientSlice.state.patientModal,
      patientSearch: patientSlice.state.search,
      patientGroupFilter: patientSlice.state.groupFilter,
      patientVisitModal: patientSlice.state.visitModal,
      patientDashboard: patientDashboardSlice.state,
      serviceDefinitions: serviceCatalogSlice.state.serviceDefinitions,
      serviceDefinitionModal: serviceCatalogSlice.state.serviceDefinitionModal,
    },
    setters: {
      setEmployeeCompetencies: employeeSlice.setters.setEmployeeCompetencies,
      setYear,
      setDataset: employeeSlice.setters.setDataset,
      setQualifications: employeeSlice.setters.setQualifications,
      setBaseHoursInput: settingsSlice.setters.setBaseHoursInput,
      setForm: employeeSlice.setters.setForm,
      setAddPeriodForm: eventSlice.setters.setAddPeriodForm,
      setAddNewPeriod: employeeSlice.setters.setAddNewPeriod,
      setQualificationFilter: employeeSlice.setters.setQualificationFilter,
      setQualificationModal: employeeSlice.setters.setQualificationModal,
      setCompetencyModal: employeeSlice.setters.setCompetencyModal,
      setInstructionModal: employeeSlice.setters.setInstructionModal,
      setEditModal: employeeSlice.setters.setEditModal,
      setEmployeeCompetencyModal: employeeSlice.setters.setEmployeeCompetencyModal,
      setEmployeeInstructionModal: employeeSlice.setters.setEmployeeInstructionModal,
      setSuggestedCompetencyModal: employeeSlice.setters.setSuggestedCompetencyModal,
      setEncryptionSetup: settingsSlice.setters.setEncryptionSetup,
      setSearch: employeeSlice.setters.setSearch,
      setStatusFilter: employeeSlice.setters.setStatusFilter,
      setPeriodToDelete: eventSlice.setters.setPeriodToDelete,
      setEventModal: eventSlice.setters.setEventModal,
      setRecoveryKeyModal,
      setRecoveryReset,
      setConfirmState,
      // Patient setters
      setPatientModal: patientSlice.setters.setPatientModal,
      setSelectedPatient: patientSlice.setters.setSelectedPatient,
      setPatientSearch: patientSlice.setters.setSearch,
      setPatientGroupFilter: patientSlice.setters.setGroupFilter,
      setPatientVisitModal: patientSlice.setters.setVisitModal,
      setServiceDefinitionModal: serviceCatalogSlice.setters.setServiceDefinitionModal,
    },
    derived: {
      filteredEmployees: employeeSlice.derived.filteredEmployees,
      averageFte: employeeSlice.derived.averageFte,
      totalFte: employeeSlice.derived.totalFte,
      totalHeadcount: employeeSlice.derived.totalHeadcount,
      timelineItems: eventSlice.derived.timelineItems,
      crumbs: employeeSlice.derived.crumbs,
      sidebarPage: employeeSlice.derived.sidebarPage,
      // Patient derived
      filteredPatients: patientSlice.derived.filteredPatients,
    },
    actions: {
      goTo: employeeSlice.actions.goTo,
      handleLogin: authSlice.handleLogin,
      handleLock: authSlice.handleLock,
      handleSave: employeeSlice.actions.handleSave,
      handleExport: employeeSlice.actions.handleExport,
      handleSelect: handleSelectWithHistory,
      confirmDeleteEmployee: employeeSlice.actions.confirmDeleteEmployee,
      confirmDeleteQualification: employeeSlice.actions.confirmDeleteQualification,
      handleSaveQualificationModal: employeeSlice.actions.handleSaveQualificationModal,
      reorderQualification: employeeSlice.actions.reorderQualification,
      confirmDeleteCompetencyDefinition: employeeSlice.actions.confirmDeleteCompetencyDefinition,
      handleSaveCompetencyModal: employeeSlice.actions.handleSaveCompetencyModal,
      reorderCompetencyDefinition: employeeSlice.actions.reorderCompetencyDefinition,
      handleSaveInstructionModal: employeeSlice.actions.handleSaveInstructionModal,
      confirmDeleteInstructionDefinition: employeeSlice.actions.confirmDeleteInstructionDefinition,
      reorderInstructionDefinition: employeeSlice.actions.reorderInstructionDefinition,
      openEmployeeCompetencyModal: employeeSlice.actions.openEmployeeCompetencyModal,
      openNewEmployeeCompetencyModal: employeeSlice.actions.openNewEmployeeCompetencyModal,
      openSuggestedCompetencyModal: employeeSlice.actions.openSuggestedCompetencyModal,
      toggleSuggestedCompetencySelection: employeeSlice.actions.toggleSuggestedCompetencySelection,
      selectAllSuggestedCompetencies: employeeSlice.actions.selectAllSuggestedCompetencies,
      handleAddRecommendedCompetencies: employeeSlice.actions.handleAddRecommendedCompetencies,
      handleSaveEmployeeCompetency: employeeSlice.actions.handleSaveEmployeeCompetency,
      handleDeleteEmployeeCompetency: employeeSlice.actions.handleDeleteEmployeeCompetency,
      loadEmployeeInstructions: employeeSlice.actions.loadEmployeeInstructions,
      openEmployeeInstructionModal: employeeSlice.actions.openEmployeeInstructionModal,
      openNewEmployeeInstructionModal: employeeSlice.actions.openNewEmployeeInstructionModal,
      handleSaveEmployeeInstruction: employeeSlice.actions.handleSaveEmployeeInstruction,
      handleDeleteEmployeeInstruction: employeeSlice.actions.handleDeleteEmployeeInstruction,
      openRecoveryKey,
      handleCopyRecoveryKey,
      startRecoveryReset,
      handleRecoveryReset,
      handleDbExport: settingsSlice.actions.handleDbExport,
      handleDbImport: settingsSlice.actions.handleDbImport,
      handleSaveBaseHoursValue: settingsSlice.actions.handleSaveBaseHoursValue,
      handleDropDatabase: settingsSlice.actions.handleDropDatabase,
      handleFullReset: settingsSlice.actions.handleFullReset,
      handleCheckUpdates: settingsSlice.actions.handleCheckUpdates,
      handleDownloadUpdate: settingsSlice.actions.handleDownloadUpdate,
      handleInstallUpdate: settingsSlice.actions.handleInstallUpdate,
      openEnableEncryption: settingsSlice.actions.openEnableEncryption,
      closeEnableEncryption: settingsSlice.actions.closeEnableEncryption,
      handleEnableEncryption: settingsSlice.actions.handleEnableEncryption,
      handleDisableEncryption: settingsSlice.actions.handleDisableEncryption,
      handleAddPeriod: eventSlice.actions.handleAddPeriod,
      handleSaveEvent: eventSlice.actions.handleSaveEvent,
      handleDeleteEvent: eventSlice.actions.handleDeleteEvent,
      handleDeletePeriod: eventSlice.actions.handleDeletePeriod,
      openNewPeriodModal: eventSlice.actions.openNewPeriodModal,
      openExistingPeriodModal: eventSlice.actions.openExistingPeriodModal,
      openEventModalForEvent: eventSlice.actions.openEventModalForEvent,
      openEmploymentAction: employmentActionSlice.actions.open,
      closeEmploymentAction: employmentActionSlice.actions.close,
      saveEmploymentAction: employmentActionSlice.actions.save,
      openCreateModal: employeeSlice.actions.openCreateModal,
      openEditModal: employeeSlice.actions.openEditModal,
      handleEditModalSave: handleEditModalSaveWithHistory,
      resetForm: employeeSlice.actions.resetForm,
      loadUpcomingEvents: upcomingEventsSlice.actions.loadUpcomingEvents,
      toggleEventTypeFilter: upcomingEventsSlice.actions.toggleEventTypeFilter,
      showAllEventTypes: upcomingEventsSlice.actions.showAllEventTypes,
      hideAllEventTypes: upcomingEventsSlice.actions.hideAllEventTypes,
      calendarActions: calendarSlice.actions,
      setToastMessage: showToast,
      handleError,
      // Patient actions
      handleSelectPatient: patientSlice.actions.handleSelectPatient,
      handleSavePatient: patientSlice.actions.handleSavePatient,
      confirmDeletePatient: patientSlice.actions.confirmDeletePatient,
      handleSaveVisit: patientSlice.actions.handleSaveVisit,
      confirmDeleteVisit: patientSlice.actions.confirmDeleteVisit,
      openCreatePatientModal: patientSlice.actions.openCreatePatientModal,
      openEditPatientModal: patientSlice.actions.openEditPatientModal,
      closePatientModal: patientSlice.actions.closePatientModal,
      openVisitModal: patientSlice.actions.openVisitModal,
      closeVisitModal: patientSlice.actions.closeVisitModal,
      refreshPatients: patientSlice.actions.refreshPatients,
      refreshEmploymentIntegrity: employmentIntegritySlice.refresh,
      loadServiceDefinitions: serviceCatalogSlice.actions.loadServiceDefinitions,
      refreshAll,
      saveServiceDefinition: serviceCatalogSlice.actions.saveServiceDefinition,
      toggleServiceDefinition: serviceCatalogSlice.actions.toggleServiceDefinition,
      reorderServiceDefinitions: serviceCatalogSlice.actions.reorderServiceDefinitions,
      openCreateServiceDefinition: serviceCatalogSlice.actions.openCreate,
      openEditServiceDefinition: serviceCatalogSlice.actions.openEdit,
    },
  };
};

export default useAppLogic;
