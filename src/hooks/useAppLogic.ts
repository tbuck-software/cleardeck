import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, EmployeeWithPeriod } from '../shared/types';
import { statusLabels, fteHelp } from '../constants';
import useConfirmations from './useConfirmations';
import useRecovery from './useRecovery';
import useSettingsDb from './useSettingsDb';
import useEventsPeriods from './useEventsPeriods';
import useEmployees from './useEmployees';
import useAuth from './useAuth';
import useUpcomingEvents from './useUpcomingEvents';
import useCalendar from './useCalendar';
import useDashboardWidgets from './useDashboardWidgets';
import usePatients from './usePatients';
import usePatientDashboard from './usePatientDashboard';

const useAppLogic = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState<number>(currentYear);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [baseHoursForEmployees, setBaseHoursForEmployees] = useState(36);

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
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
    form: employeeSlice.state.form,
    selectedEmployee: employeeSlice.state.selectedEmployee,
    setSelectedEmployee: employeeSlice.setters.setSelectedEmployee,
    setDataset: employeeSlice.setters.setDataset,
    handleError,
    setLoading,
    setToast: showToast,
    confirmAction,
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
    hydrateBaseHours: settingsSlice.actions.hydrateBaseHours,
  });

  appReadySetterRef.current = authSlice.setAppReady;

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

  // Load upcoming events and filters when app is unlocked
  useEffect(() => {
    if (authSlice.appReady.unlocked) {
      upcomingEventsSlice.actions.loadHiddenEventTypes();
      upcomingEventsSlice.actions.loadUpcomingEvents();
      dashboardWidgetsSlice.actions.loadAll();
      patientSlice.actions.refreshPatients();
      patientDashboardSlice.actions.loadAll();
    }
  }, [authSlice.appReady.unlocked, upcomingEventsSlice.actions, dashboardWidgetsSlice.actions, patientSlice.actions, patientDashboardSlice.actions]);

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
      await eventSlice.actions.loadHistory(emp.id);
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
      eventDate: new Date().toISOString().slice(0, 10),
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
      await eventSlice.actions.loadHistory(id);
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
      form: employeeSlice.state.form,
      periods: eventSlice.state.periods,
      events: eventSlice.state.events,
      selectedEmployee: employeeSlice.state.selectedEmployee,
      appReady: authSlice.appReady,
      page: employeeSlice.state.page,
      loading,
      toast,
      error,
      updateStatus: settingsSlice.state.updateStatus,
      dbMessage: settingsSlice.state.dbMessage,
      snoozeUpdates: settingsSlice.state.snoozeUpdates,
      appInfo: settingsSlice.state.appInfo,
      search: employeeSlice.state.search,
      statusFilter: employeeSlice.state.statusFilter,
      qualificationFilter: employeeSlice.state.qualificationFilter,
      addNewPeriod: employeeSlice.state.addNewPeriod,
      qualificationEdits: employeeSlice.state.qualificationEdits,
      qualificationModal: employeeSlice.state.qualificationModal,
      editModal: employeeSlice.state.editModal,
      addPeriodForm: eventSlice.state.addPeriodForm,
      periodToDelete: eventSlice.state.periodToDelete,
      eventModal: eventSlice.state.eventModal,
      confirmState,
      recoveryKeyModal,
      recoveryReset,
      upcomingEvents: upcomingEventsSlice.state.allUpcomingEvents,
      hiddenEventTypes: upcomingEventsSlice.state.hiddenEventTypes,
      calendar: calendarSlice.state,
      dashboardWidgets: dashboardWidgetsSlice.state,
      // Patient state
      patients: patientSlice.state.patients,
      selectedPatient: patientSlice.state.selectedPatient,
      patientVisits: patientSlice.state.visits,
      patientForm: patientSlice.state.form,
      patientPage: patientSlice.state.page,
      patientSearch: patientSlice.state.search,
      patientRatingFilter: patientSlice.state.ratingFilter,
      patientVisitModal: patientSlice.state.visitModal,
      patientDashboard: patientDashboardSlice.state,
    },
    setters: {
      setYear,
      setDataset: employeeSlice.setters.setDataset,
      setBaseHoursInput: settingsSlice.setters.setBaseHoursInput,
      setForm: employeeSlice.setters.setForm,
      setAddPeriodForm: eventSlice.setters.setAddPeriodForm,
      setAddNewPeriod: employeeSlice.setters.setAddNewPeriod,
      setQualificationFilter: employeeSlice.setters.setQualificationFilter,
      setQualificationModal: employeeSlice.setters.setQualificationModal,
      setEditModal: employeeSlice.setters.setEditModal,
      setSearch: employeeSlice.setters.setSearch,
      setStatusFilter: employeeSlice.setters.setStatusFilter,
      setPeriodToDelete: eventSlice.setters.setPeriodToDelete,
      setEventModal: eventSlice.setters.setEventModal,
      setRecoveryKeyModal,
      setRecoveryReset,
      setConfirmState,
      // Patient setters
      setPatientForm: patientSlice.setters.setForm,
      setPatientSearch: patientSlice.setters.setSearch,
      setPatientRatingFilter: patientSlice.setters.setRatingFilter,
      setPatientVisitModal: patientSlice.setters.setVisitModal,
      setPatientPage: patientSlice.setters.setPage,
    },
    derived: {
      filteredEmployees: employeeSlice.derived.filteredEmployees,
      averageFte: employeeSlice.derived.averageFte,
      totalFte: employeeSlice.derived.totalFte,
      totalHeadcount: employeeSlice.derived.totalHeadcount,
      displayStart: eventSlice.derived.displayStart,
      timelineItems: eventSlice.derived.timelineItems,
      crumbs: employeeSlice.derived.crumbs,
      sidebarPage: employeeSlice.derived.sidebarPage,
      // Patient derived
      filteredPatients: patientSlice.derived.filteredPatients,
    },
    actions: {
      goTo: employeeSlice.actions.goTo,
      handleLogin: authSlice.handleLogin,
      handleSave: employeeSlice.actions.handleSave,
      handleExport: employeeSlice.actions.handleExport,
      handleSelect: handleSelectWithHistory,
      confirmDeleteEmployee: employeeSlice.actions.confirmDeleteEmployee,
      confirmDeleteQualification: employeeSlice.actions.confirmDeleteQualification,
      handleSaveQualificationModal: employeeSlice.actions.handleSaveQualificationModal,
      reorderQualification: employeeSlice.actions.reorderQualification,
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
      handleInstallUpdate: settingsSlice.actions.handleInstallUpdate,
      handleSnoozeUpdate: settingsSlice.actions.handleSnoozeUpdate,
      handleAddPeriod: eventSlice.actions.handleAddPeriod,
      handleSaveEvent: eventSlice.actions.handleSaveEvent,
      handleDeleteEvent: eventSlice.actions.handleDeleteEvent,
      handleDeletePeriod: eventSlice.actions.handleDeletePeriod,
      openNewPeriodModal: eventSlice.actions.openNewPeriodModal,
      openExistingPeriodModal: eventSlice.actions.openExistingPeriodModal,
      openEventModalForEvent: eventSlice.actions.openEventModalForEvent,
      openCreateModal: employeeSlice.actions.openCreateModal,
      openEditModal: employeeSlice.actions.openEditModal,
      handleEditModalSave: handleEditModalSaveWithHistory,
      resetForm: employeeSlice.actions.resetForm,
      loadUpcomingEvents: upcomingEventsSlice.actions.loadUpcomingEvents,
      toggleEventTypeFilter: upcomingEventsSlice.actions.toggleEventTypeFilter,
      showAllEventTypes: upcomingEventsSlice.actions.showAllEventTypes,
      hideAllEventTypes: upcomingEventsSlice.actions.hideAllEventTypes,
      calendarActions: calendarSlice.actions,
      // Patient actions
      goToPatients: patientSlice.actions.goToPatients,
      handleSelectPatient: patientSlice.actions.handleSelectPatient,
      handleSavePatient: patientSlice.actions.handleSavePatient,
      confirmDeletePatient: patientSlice.actions.confirmDeletePatient,
      handleSaveVisit: patientSlice.actions.handleSaveVisit,
      confirmDeleteVisit: patientSlice.actions.confirmDeleteVisit,
      openVisitModal: patientSlice.actions.openVisitModal,
      closeVisitModal: patientSlice.actions.closeVisitModal,
      refreshPatients: patientSlice.actions.refreshPatients,
    },
  };
};

export default useAppLogic;
