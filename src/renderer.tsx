import { DEFAULT_ANNUAL_FTE_METHOD } from './shared/annualFte';
import StaffImportModal from './components/modals/StaffImportModal';
import type { StaffImportPreview } from './shared/staffImport';
import { localDate } from './utils/calendarDate';
import type { YearDataset } from './shared/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/connection.css';

import AuthScreen from './components/auth/AuthScreen';
import AuthUpdates from './components/auth/AuthUpdates';
import AppSidebar from './components/layout/AppSidebar';
import SettingsSidebar from './components/layout/SettingsSidebar';

import Dashboard from './components/pages/Dashboard';
import EmployeeList from './components/pages/EmployeeList';
import EmployeeDetail, { type DetailTab } from './components/pages/EmployeeDetail';
import PatientList from './components/pages/PatientList';
import PatientDetail from './components/pages/PatientDetail';
import CalendarPage from './components/pages/CalendarPage';
import AuditPage from './components/pages/AuditPage';
import TasksPage from './components/pages/TasksPage';
import EmploymentIntegrityPage from './components/pages/EmploymentIntegrityPage';
import AdminListPage, { type AdminItem } from './components/pages/AdminListPage';
import DevPage from './components/pages/DevPage';
import SettingsGeneral from './components/pages/settings/SettingsGeneral';
import SettingsConnections from './components/pages/settings/SettingsConnections';
import { ServerConnectLink, ServerSignIn } from './components/auth/ServerAuth';
import SettingsSecurity from './components/pages/settings/SettingsSecurity';
import SettingsAbout from './components/pages/settings/SettingsAbout';
import SettingsLogs from './components/pages/settings/SettingsLogs';
import SettingsShortcuts from './components/pages/settings/SettingsShortcuts';

import CommandPalette, { type PaletteResult } from './components/ui/CommandPalette';
import ConfirmModal from './components/modals/ConfirmModal';
import RecoveryKeyModal from './components/modals/RecoveryKeyModal';
import RecoveryResetModal from './components/modals/RecoveryResetModal';
import QualificationModal from './components/modals/QualificationModal';
import ServiceDefinitionModal from './components/modals/ServiceDefinitionModal';
import CompetencyModal from './components/modals/CompetencyModal';
import InstructionModal from './components/modals/InstructionModal';
import AssignInstructionModal, {
  emptyAssignInstructionModal,
  type AssignInstructionModalState,
} from './components/modals/AssignInstructionModal';
import EmployeeCompetencyModal from './components/modals/EmployeeCompetencyModal';
import EmployeeInstructionModal from './components/modals/EmployeeInstructionModal';
import RecommendedCompetenciesModal from './components/modals/RecommendedCompetenciesModal';
import EmployeeModal from './components/modals/EmployeeModal';
import EventModal from './components/modals/EventModal';
import EmploymentActionModal from './components/modals/EmploymentActionModal';
import PatientModal from './components/patients/PatientModal';
import VisitModal from './components/patients/VisitModal';
import AuditModal from './components/modals/AuditModal';
import PasswordModal from './components/modals/PasswordModal';
import { BackupExportModal, BackupRestoreModal } from './components/modals/BackupTransferModal';
import AuditViewModal from './components/modals/AuditViewModal';
import DayModal from './components/modals/DayModal';
import ReportModal from './components/modals/ReportModal';

import api from './services/api';
import useAppLogic from './hooks/useAppLogic';
import useServerSync from './hooks/useServerSync';
import useViewport from './hooks/useViewport';
import useQprData from './hooks/useQprData';
import { deriveFteFromWeeklyHours, deriveWeeklyHoursFromFte } from './utils/fte';
import { buildDashboardTasks, buildDataQuality, type TaskTarget } from './utils/dashboardTasks';
import { groupOfEvent, type EventGroup } from './utils/eventStyle';
import { matchesQualificationRelevance } from './utils/qualificationRelevance';
import { userFacingErrorMessage } from './utils/errorMessage';
import { reselectEmployee } from './utils/selectedEmployee';
import { unifyEvents } from './utils/unifyEvents';
import {
  buildNavigationSnapshot,
  createAppHistoryState,
  isAppHistoryState,
  resolveNavigationSnapshot,
} from './utils/navigationHistory';
import { SETTINGS_PAGES, type AuditModalState, type Page } from './types/ui';
import type {
  AuditWithDetails,
  BackupState,
  EmployeeWithPeriod,
  PatientWithLatestVisit,
} from './shared/types';
import { SERVICE_TYPE_LABEL } from './shared/services';
import { describeInterval } from './utils/instructionSchedule';
import { isActivePatient } from './utils/qpr';

const patientCountLabel = (count: number): string =>
  count === 1 ? '1 aktive Person' : `${count} aktive Personen`;

const personCountLabel = (count: number): string =>
  count === 1 ? '1 Person' : `${count} Personen`;

const emptyAuditModal = (): AuditModalState => ({
  open: false,
  mode: 'create',
  auditDate: localDate(),
  inspector: '',
  kind: 'regel',
  findings: '',
  results: {},
  confirmed: false,
  reportRef: '',
  clientIds: [],
});

const App = () => {
  const {
    constants: { fteHelp },
    state: {
      currentYear,
      year,
      dataset,
      baseHours,
      baseHoursInput,
      annualFteSaving,
      qualifications,
      competencyDefinitions,
      instructionDefinitions,
      form,
      selectedEmployee,
      employeeCompetencies,
      employeeInstructions,
      appReady,
      authLoading,
      page,
      loading,
      toast,
      error,
      updateStatus,
      lastUpdateCheckAt,
      dbMessage,
      appInfo,
      storageMode,
      encryptionSetup,
      search,
      statusFilter,
      qualificationFilter,
      qualificationModal,
      competencyModal,
      instructionModal,
      editModal,
      employeeCompetencyModal,
      employeeInstructionModal,
      suggestedCompetencyModal,
      periods,
      addPeriodForm,
      eventModal,
      employmentAction,
      confirmState,
      recoveryKeyModal,
      recoveryReset,
      upcomingEvents,
      hiddenEventTypes,
      calendar,
      dashboardWidgets,
      employmentIntegrity,
      employmentIntegrityStatus,
      patients,
      selectedPatient,
      patientVisits,
      patientModal,
      patientSearch,
      patientGroupFilter,
      patientVisitModal,
      serviceDefinitions,
      serviceDefinitionModal,
    },
    setters: {
      setEmployeeCompetencies,
      setYear,
      setDataset,
      setQualifications,
      setBaseHoursInput,
      setForm,
      setAddPeriodForm,
      setQualificationFilter,
      setQualificationModal,
      setCompetencyModal,
      setInstructionModal,
      setEditModal,
      setEmployeeCompetencyModal,
      setEmployeeInstructionModal,
      setSuggestedCompetencyModal,
      setSearch,
      setStatusFilter,
      setPeriodToDelete,
      setEventModal,
      setRecoveryKeyModal,
      setRecoveryReset,
      setConfirmState,
      setPatientModal,
      setSelectedPatient,
      setPatientSearch,
      setPatientGroupFilter,
      setPatientVisitModal,
      setServiceDefinitionModal,
    },
    derived: { filteredEmployees, totalFte, timelineItems, sidebarPage, filteredPatients },
    actions: {
      refreshEmploymentIntegrity,
      goTo,
      handleLogin,
      handleLock,
      handleExport,
      handleSelect,
      confirmDeleteEmployee,
      confirmDeleteQualification,
      handleSaveQualificationModal,
      reorderQualification,
      confirmDeleteCompetencyDefinition,
      handleSaveCompetencyModal,
      reorderCompetencyDefinition,
      handleSaveInstructionModal,
      confirmDeleteInstructionDefinition,
      reorderInstructionDefinition,
      openEmployeeCompetencyModal,
      openNewEmployeeCompetencyModal,
      openSuggestedCompetencyModal,
      toggleSuggestedCompetencySelection,
      selectAllSuggestedCompetencies,
      handleAddRecommendedCompetencies,
      handleSaveEmployeeCompetency,
      handleDeleteEmployeeCompetency,
      loadEmployeeInstructions,
      openEmployeeInstructionModal,
      openNewEmployeeInstructionModal,
      handleSaveEmployeeInstruction,
      handleDeleteEmployeeInstruction,
      openRecoveryKey,
      handleCopyRecoveryKey,
      startRecoveryReset,
      handleRecoveryReset,
      handleDbExport,
      handleDbImport,
      handleSaveBaseHoursValue,
      handleSaveAnnualFteMethod,
      handleDropDatabase,
      handleFullReset,
      handleCheckUpdates,
      handleDownloadUpdate,
      handleInstallUpdate,
      openEnableEncryption,
      handleDisableEncryption,
      handleAddPeriod,
      handleSaveEvent,
      handleDeleteEvent,
      openNewPeriodModal,
      openExistingPeriodModal,
      openEventModalForEvent,
      openEmploymentAction,
      closeEmploymentAction,
      saveEmploymentAction,
      calendarActions,
      openCreateModal,
      openEditModal,
      handleEditModalSave,
      setToastMessage,
      handleError,
      handleSelectPatient,
      handleSavePatient,
      confirmDeletePatient,
      handleSaveVisit,
      confirmDeleteVisit,
      openCreatePatientModal,
      openEditPatientModal,
      closePatientModal,
      openVisitModal,
      closeVisitModal,
      saveServiceDefinition,
      toggleServiceDefinition,
      reorderServiceDefinitions,
      openCreateServiceDefinition,
      openEditServiceDefinition,
      refreshAll,
    },
  } = useAppLogic();

  const { wideSidebar, wideTable } = useViewport();
  const {
    careSettings,
    recentVisits,
    audits,
    auditSections,
    definitionUsage,
    actions: qprActions,
  } = useQprData({
    ready: appReady.unlocked,
    handleError,
  });

  const [detailTab, setDetailTab] = useState<DetailTab>('comp');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [doneTaskIds, setDoneTaskIds] = useState<string[]>([]);
  const [hiddenEventGroups, setHiddenEventGroups] = useState<EventGroup[]>([]);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportYear, setReportYear] = useState(currentYear - 1);
  const [reportMode, setReportMode] = useState<'stichtag' | 'year-average' | 'month-end-average'>('month-end-average');
  const openAnnualReport = useCallback(() => {
    setReportMode(dataset?.annualSummary?.method ?? DEFAULT_ANNUAL_FTE_METHOD);
    setReportOpen(true);
  }, [dataset?.annualSummary?.method]);
  const [reportDataset, setReportDataset] = useState<YearDataset | null>(null);
  useEffect(() => {
    if (!reportOpen || !appReady.unlocked) return;
    let canceled = false;
    setReportDataset(null);
    void api.employees
      .list(reportYear, reportMode)
      .then((data) => {
        if (!canceled) setReportDataset(data);
      })
      .catch(handleError);
    return () => {
      canceled = true;
    };
  }, [reportOpen, reportYear, reportMode, appReady.unlocked, dataset, handleError]);
  const [staffImport, setStaffImport] = useState<StaffImportPreview | null>(null);
  const [staffImportBusy, setStaffImportBusy] = useState(false);
  const [directoryMode, setDirectoryMode] = useState(false);
  const [directoryDataset, setDirectoryDataset] = useState<YearDataset | null>(null);
  const [currentDataset, setCurrentDataset] = useState<YearDataset | null>(null);
  useEffect(() => {
    if (!appReady.unlocked) {
      setCurrentDataset(null);
      return;
    }
    let canceled = false;
    void api.employees
      .list(currentYear, 'current')
      .then((data) => {
        if (!canceled) setCurrentDataset(data);
      })
      .catch(handleError);
    void api.employees
      .list(currentYear, 'directory')
      .then((data) => {
        if (!canceled) setDirectoryDataset(data);
      })
      .catch(handleError);
    return () => {
      canceled = true;
    };
  }, [appReady.unlocked, currentYear, dataset, handleError]);
  const [auditModal, setAuditModal] = useState<AuditModalState>(emptyAuditModal);
  const [auditView, setAuditView] = useState<AuditWithDetails | null>(null);
  const [previousPage, setPreviousPage] = useState<Page>('dashboard');
  const [backup, setBackup] = useState<BackupState>({
    folder: null,
    auto: 'off',
    keep: 10,
    lastBackupAt: null,
    backups: [],
  });
  const [backupBusy, setBackupBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [assignInstructionModal, setAssignInstructionModal] = useState<AssignInstructionModalState>(
    emptyAssignInstructionModal(),
  );
  const [assignAlreadyOpenIds, setAssignAlreadyOpenIds] = useState<number[]>([]);
  const editingProtectionRef = useRef(false);

  const editingProtection = useMemo(() => {
    const editPages: Page[] = [
      'new',
      'edit',
      'patient-new',
      'patient-edit',
    ];
    return (
      editPages.includes(page) ||
      loading ||
      paletteOpen ||
      reportOpen ||
      qualificationModal.open ||
      competencyModal.open ||
      instructionModal.open ||
      editModal.open ||
      employeeCompetencyModal.open ||
      employeeInstructionModal.open ||
      suggestedCompetencyModal.open ||
      eventModal.open ||
      employmentAction.open ||
      patientModal.open ||
      patientVisitModal.open ||
      serviceDefinitionModal.open ||
      auditModal.open ||
      assignInstructionModal.open ||
      recoveryKeyModal.open ||
      recoveryReset.open ||
      encryptionSetup.open ||
      passwordOpen ||
      exportOpen ||
      restoreOpen ||
      staffImport !== null ||
      auditView !== null ||
      dayModalDate !== null ||
      confirmState !== null
    );
  }, [
    assignInstructionModal.open,
    auditModal.open,
    auditView,
    competencyModal.open,
    confirmState,
    dayModalDate,
    editModal.open,
    employeeCompetencyModal.open,
    employeeInstructionModal.open,
    encryptionSetup.open,
    eventModal.open,
    employmentAction.open,
    exportOpen,
    instructionModal.open,
    loading,
    page,
    paletteOpen,
    patientModal.open,
    patientVisitModal.open,
    passwordOpen,
    qualificationModal.open,
    recoveryKeyModal.open,
    recoveryReset.open,
    reportOpen,
    restoreOpen,
    serviceDefinitionModal.open,
    staffImport,
    suggestedCompetencyModal.open,
  ]);
  editingProtectionRef.current = editingProtection;

  const refreshVisibleData = useCallback(async () => {
    if (editingProtectionRef.current) return;
    const refreshed = await refreshAll({
      shouldApply: () => !editingProtectionRef.current,
    });
    if (!refreshed) return;
    if (editingProtectionRef.current) return;
    setDirectoryDataset(refreshed.directoryDataset);
    setCurrentDataset(refreshed.currentDataset);
    if (editingProtectionRef.current) return;
    await qprActions.refreshAll({ shouldApply: () => !editingProtectionRef.current });
  }, [qprActions, refreshAll]);

  useServerSync({
    enabled: appReady.unlocked,
    serverMode: appReady.connectionMode === 'server',
    editing: editingProtection,
    onRemoteChange: refreshVisibleData,
    onError: handleError,
  });

  const historyIndexRef = useRef(0);
  const restoringHistoryRef = useRef(false);
  const selectedEmployeeRef = useRef(selectedEmployee);
  const selectedPatientRef = useRef(selectedPatient);
  const currentSnapshotRef = useRef(
    buildNavigationSnapshot(page, selectedEmployee?.id ?? null, selectedPatient?.id ?? null),
  );

  selectedEmployeeRef.current = selectedEmployee;
  selectedPatientRef.current = selectedPatient;

  const inSettings = SETTINGS_PAGES.includes(page);
  const years = useMemo(
    () => dataset?.availableYears ?? [currentYear - 2, currentYear - 1, currentYear],
    [currentYear, dataset?.availableYears],
  );

  // — employee edit modal: hours and VZÄ stay in step while linked —

  const updateWeeklyHours = (value: string) => {
    setEditModal((prev) => {
      const next = { ...prev, weeklyHours: value };
      if (prev.linked) {
        const hours = Number(value);
        const fte =
          !Number.isNaN(hours) && hours > 0
            ? deriveFteFromWeeklyHours(hours, baseHours || 36)
            : null;
        next.fteValue = fte ? fte.toFixed(2) : '';
      }
      return next;
    });
  };

  const updateFteValue = (value: string) => {
    setEditModal((prev) => {
      const next = { ...prev, fteValue: value };
      if (prev.linked) {
        const fte = Number(value);
        const hours =
          !Number.isNaN(fte) && fte > 0 ? deriveWeeklyHoursFromFte(fte, baseHours || 36) : null;
        next.weeklyHours = hours ? hours.toFixed(1) : '';
      }
      return next;
    });
  };

  const toggleLinked = (checked: boolean) => {
    setEditModal((prev) => {
      const next = { ...prev, linked: checked };
      if (!checked) return next;
      if (prev.weeklyHours) {
        const hours = Number(prev.weeklyHours);
        const fte =
          !Number.isNaN(hours) && hours > 0
            ? deriveFteFromWeeklyHours(hours, baseHours || 36)
            : null;
        if (fte) next.fteValue = fte.toFixed(2);
      } else if (prev.fteValue) {
        const fte = Number(prev.fteValue);
        const hours =
          !Number.isNaN(fte) && fte > 0 ? deriveWeeklyHoursFromFte(fte, baseHours || 36) : null;
        if (hours) next.weeklyHours = hours.toFixed(1);
      }
      return next;
    });
  };

  const availableCompetencyDefinitions = competencyDefinitions.filter(
    (definition) =>
      definition.id &&
      !employeeCompetencies.some((entry) => entry.competencyDefinitionId === definition.id),
  );
  const suggestedCompetencyDefinitions =
    selectedEmployee == null
      ? []
      : availableCompetencyDefinitions.filter((definition) =>
          matchesQualificationRelevance(selectedEmployee.qualification, definition.relevance),
        );
  // Since v015 a person can hold several rows per topic (the completed record
  // plus its follow-up), so only an *open* one blocks assigning it again.
  const availableInstructionDefinitions = instructionDefinitions.filter(
    (definition) =>
      definition.id &&
      !employeeInstructions.some(
        (entry) => entry.instructionDefinitionId === definition.id && !entry.completedAt,
      ),
  );

  const unifiedEvents = useMemo(
    () =>
      unifyEvents(
        upcomingEvents,
        dashboardWidgets.expiringTrainings,
        dashboardWidgets.birthdaysAnniversaries,
        hiddenEventTypes,
        dashboardWidgets.patientBirthdays,
        dashboardWidgets.patientVisits,
      ),
    [
      upcomingEvents,
      dashboardWidgets.expiringTrainings,
      dashboardWidgets.birthdaysAnniversaries,
      hiddenEventTypes,
      dashboardWidgets.patientBirthdays,
      dashboardWidgets.patientVisits,
    ],
  );

  const today = localDate();

  // Visits change through the detail page, so the list's trend bars are
  // refreshed whenever the patient list itself is reloaded.
  useEffect(() => {
    if (!appReady.unlocked) return;
    void qprActions.refreshRecentVisits();
  }, [appReady.unlocked, patients, qprActions]);

  const tasks = useMemo(
    () =>
      buildDashboardTasks({
        today,
        patients,
        employees: currentDataset?.employees ?? [],
        openInstructions: dashboardWidgets.openInstructions,
        instructionReminderDays: careSettings.instructionReminderDays,
        expiringTrainings: dashboardWidgets.expiringTrainings,
        visitIntervalDays: careSettings.visitIntervalDays,
        employmentIntegrity,
      }),
    [
      today,
      patients,
      currentDataset?.employees,
      dashboardWidgets.openInstructions,
      dashboardWidgets.expiringTrainings,
      careSettings.visitIntervalDays,
      careSettings.instructionReminderDays,
      employmentIntegrity,
    ],
  );

  const quality = useMemo(
    () => buildDataQuality(currentDataset?.employees ?? [], patients),
    [currentDataset?.employees, patients],
  );

  const upcoming = useMemo(
    () =>
      unifiedEvents
        .filter((event) => {
          const days = Math.round(
            (new Date(`${event.date}T00:00:00`).getTime() -
              new Date(`${today}T00:00:00`).getTime()) /
              86400000,
          );
          return days >= 0 && days <= 30;
        })
        .slice(0, 7),
    [unifiedEvents, today],
  );

  useEffect(() => {
    if (!appReady.unlocked) return;
    void (async () => {
      try {
        setBackup(await api.backup.get());
      } catch (err) {
        handleError(err);
      }
    })();
  }, [appReady.unlocked, handleError]);

  const runBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await api.backup.run();
      setBackup(result.settings);
      setToastMessage(
        result.saved
          ? `Backup geschrieben: ${result.file}`
          : (result.error ?? 'Backup fehlgeschlagen.'),
      );
    } catch (err) {
      handleError(err);
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreFromBackup = async (source: string, recoveryKey?: string) => {
    setRestoreBusy(true);
    try {
      const result = await api.backup.restore(source, recoveryKey);
      setBackup(result.settings);
      if (result.saved) {
        setRestoreOpen(false);
        setToastMessage(`Wiederhergestellt aus ${result.file}. Bitte Daten prüfen.`);
        window.location.reload();
      } else {
        setToastMessage(result.error ?? 'Wiederherstellung fehlgeschlagen.');
      }
    } catch (err) {
      handleError(err);
    } finally {
      setRestoreBusy(false);
    }
  };

  const refreshAfterEmploymentRepair = async () => {
    const [team, directory, current] = await Promise.all([
      api.employees.list(year),
      api.employees.list(currentYear, 'directory'),
      api.employees.list(currentYear, 'current'),
    ]);
    setDataset(team);
    setDirectoryDataset(directory);
    setCurrentDataset(current);
  };

  const changePassword = async (input: { currentPassword: string; newPassword: string }) => {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await api.auth.changePassword(input);
      setPasswordOpen(false);
      setToastMessage('Passwort geändert.');
    } catch (err) {
      setPasswordError(
        userFacingErrorMessage(err, 'Das Passwort konnte nicht geändert werden.'),
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  // — navigation —

  const pushHistorySnapshot = useCallback(
    (snapshot: ReturnType<typeof buildNavigationSnapshot>) => {
      if (!appReady.unlocked) return;
      const nextIndex = historyIndexRef.current + 1;
      window.history.pushState(createAppHistoryState(nextIndex, snapshot), '');
      historyIndexRef.current = nextIndex;
    },
    [appReady.unlocked],
  );

  const restoreSnapshot = useCallback(
    async (snapshot: ReturnType<typeof buildNavigationSnapshot>) => {
      const {
        page: resolvedPage,
        employee,
        patient,
      } = resolveNavigationSnapshot(snapshot, dataset?.employees ?? [], patients);

      if (resolvedPage !== 'patients') setSelectedPatient(null);

      if (resolvedPage === 'view' && employee) {
        await handleSelect(employee);
        return;
      }
      if (resolvedPage === 'patients') {
        goTo('patients');
        if (patient) await handleSelectPatient(patient);
        else setSelectedPatient(null);
        return;
      }
      goTo(resolvedPage);
    },
    [dataset?.employees, patients, setSelectedPatient, handleSelect, handleSelectPatient, goTo],
  );

  const currentSnapshot = useMemo(
    () => buildNavigationSnapshot(page, selectedEmployee?.id ?? null, selectedPatient?.id ?? null),
    [page, selectedEmployee?.id, selectedPatient?.id],
  );
  currentSnapshotRef.current = currentSnapshot;

  useEffect(() => {
    if (!appReady.unlocked) return;
    const state = window.history.state;
    const index = isAppHistoryState(state) ? state.index : historyIndexRef.current;
    window.history.replaceState(createAppHistoryState(index, currentSnapshot), '');
    historyIndexRef.current = index;
  }, [appReady.unlocked, currentSnapshot]);

  useEffect(() => {
    if (!appReady.unlocked) return;

    if (!isAppHistoryState(window.history.state)) {
      window.history.replaceState(createAppHistoryState(0, currentSnapshotRef.current), '');
      historyIndexRef.current = 0;
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = isAppHistoryState(event.state)
        ? event.state
        : createAppHistoryState(0, currentSnapshotRef.current);
      historyIndexRef.current = state.index;
      restoringHistoryRef.current = true;
      void restoreSnapshot(state.snapshot).finally(() => {
        restoringHistoryRef.current = false;
      });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 3 && historyIndexRef.current > 0) {
        event.preventDefault();
        window.history.back();
      }
      if (event.button === 4) {
        event.preventDefault();
        window.history.forward();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [appReady.unlocked, restoreSnapshot]);

  const navigateToPage = useCallback(
    (target: Page) => {
      if (!restoringHistoryRef.current) {
        pushHistorySnapshot(
          buildNavigationSnapshot(
            target,
            selectedEmployeeRef.current?.id ?? null,
            target === 'patients' ? null : (selectedPatientRef.current?.id ?? null),
          ),
        );
      }
      if (target === 'patients') setSelectedPatient(null);
      if (!SETTINGS_PAGES.includes(target) && !SETTINGS_PAGES.includes(page))
        setPreviousPage(target);
      goTo(target);
    },
    [goTo, page, pushHistorySnapshot, setSelectedPatient],
  );

  const navigateToEmployee = useCallback(
    async (employee: EmployeeWithPeriod, tab: DetailTab = 'comp') => {
      if (!restoringHistoryRef.current) {
        pushHistorySnapshot(buildNavigationSnapshot('view', employee.id ?? null, null));
      }
      setDetailTab(tab);
      await handleSelect(employee);
    },
    [handleSelect, pushHistorySnapshot],
  );

  /** Working-time saves change the effective term, so re-read the selected period. */
  const reloadSelectedEmployee = useCallback(async () => {
    const employeeId = selectedEmployee?.id;
    if (!employeeId) return;
    const updated = await api.employees.list(year);
    setDataset(updated);
    const refreshed = await reselectEmployee(
      updated,
      (person) => person.id === employeeId,
      async () =>
        (await api.employees.list(year, 'directory')).employees.find(
          (person) => person.id === employeeId,
        ),
    );
    if (refreshed) await handleSelect(refreshed);
  }, [handleSelect, selectedEmployee?.id, setDataset, year]);

  const navigateToPatient = useCallback(
    async (patient: PatientWithLatestVisit) => {
      if (!restoringHistoryRef.current) {
        pushHistorySnapshot(buildNavigationSnapshot('patients', null, patient.id ?? null));
      }
      goTo('patients');
      await handleSelectPatient(patient);
    },
    [goTo, handleSelectPatient, pushHistorySnapshot],
  );

  const openTarget = useCallback(
    (target: TaskTarget) => {
      if (target.kind === 'employee') {
        const known = employmentIntegrity.employees.find((entry) => entry.id === target.id);
        const employee =
          directoryDataset?.employees.find((entry) => entry.id === target.id) ??
          currentDataset?.employees.find((entry) => entry.id === target.id) ??
          dataset?.employees.find((entry) => entry.id === target.id) ??
          // A person without any employment period is in no reporting dataset,
          // yet still needs to be reachable to be merged or completed.
          (known
            ? ({
                id: known.id,
                name: known.name,
                birthDate: known.birthDate,
                qualification: '',
                startDate: '',
                employmentStartDate: '',
                endDate: null,
                fte: null,
                weeklyHours: null,
                status: 'active',
              } satisfies EmployeeWithPeriod)
            : undefined);
        if (employee) void navigateToEmployee(employee, target.tab ?? 'comp');
        return;
      }
      const patient = patients.find((entry) => entry.id === target.id);
      if (patient) void navigateToPatient(patient);
    },
    [
      dataset?.employees,
      currentDataset?.employees,
      directoryDataset?.employees,
      employmentIntegrity.employees,
      patients,
      navigateToEmployee,
      navigateToPatient,
    ],
  );

  const openEvent = useCallback(
    async (event: { employeeId?: number; patientId?: number; type?: string }) => {
      if (event.patientId) {
        const patient = patients.find((entry) => entry.id === event.patientId);
        if (patient) await navigateToPatient(patient);
        return;
      }
      const employee =
        directoryDataset?.employees.find((entry) => entry.id === event.employeeId) ??
        currentDataset?.employees.find((entry) => entry.id === event.employeeId) ??
        dataset?.employees.find((entry) => entry.id === event.employeeId);
      if (employee) {
        await navigateToEmployee(employee);
        if (event.type === 'instruction-due') setDetailTab('instr');
      }
    },
    [
      dataset?.employees,
      currentDataset?.employees,
      directoryDataset?.employees,
      patients,
      navigateToEmployee,
      navigateToPatient,
    ],
  );

  // — keyboard —

  useEffect(() => {
    if (!appReady.unlocked) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        navigateToPage('settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appReady.unlocked, navigateToPage]);

  // — command palette —

  const paletteResults = useCallback(
    (query: string): PaletteResult[] => {
      const needle = query.trim().toLowerCase();
      const matches = (text: string) => text.toLowerCase().includes(needle);

      const pages: { page: Page; label: string }[] = [
        { page: 'dashboard', label: 'Übersicht' },
        { page: 'list', label: 'Team' },
        { page: 'integrity', label: 'Datenprüfung' },
        { page: 'patients', label: 'Patient:innen' },
        { page: 'audit', label: 'MD-Prüfung' },
        { page: 'calendar', label: 'Kalender' },
        { page: 'quals', label: 'Qualifikationen' },
        { page: 'comps', label: 'Kompetenzen' },
        { page: 'instrs', label: 'Einweisungen' },
        { page: 'settings', label: 'Einstellungen' },
        { page: 'security', label: 'Sicherheit & Backup' },
        { page: 'connections', label: 'Verbindungen' },
        { page: 'shortcuts', label: 'Tastenkürzel' },
        { page: 'logs', label: 'Logs & Diagnose' },
        { page: 'about', label: 'Über ClearDeck' },
      ];

      const paletteActions: { label: string; run: () => void }[] = [
        { label: 'Jahresnachweis erstellen', run: (): void => openAnnualReport() },
        { label: 'Person anlegen', run: openCreateModal },
        { label: 'Patient:in anlegen', run: openCreatePatientModal },
        {
          label: 'Personenliste für den MD exportieren (Anlage 7)',
          run: (): void => void exportPersonList(),
        },
        {
          label: 'Prüfung erfassen',
          run: (): void => setAuditModal({ ...emptyAuditModal(), open: true }),
        },
      ];

      return [
        ...(dataset?.employees ?? [])
          .filter((employee) => matches(employee.name))
          .map(
            (employee): PaletteResult => ({
              id: `employee-${employee.id}`,
              kind: 'Team',
              title: employee.name,
              sub: String(employee.qualification),
              run: () => void navigateToEmployee(employee),
            }),
          ),
        ...patients
          .filter((patient) => matches(`${patient.name} ${patient.diagnosis ?? ''}`))
          .map(
            (patient): PaletteResult => ({
              id: `patient-${patient.id}`,
              kind: 'Patient:in',
              title: patient.name,
              sub: patient.diagnosis ?? '',
              run: () => void navigateToPatient(patient),
            }),
          ),
        ...pages
          .filter((entry) => matches(entry.label))
          .map(
            (entry): PaletteResult => ({
              id: `page-${entry.page}`,
              kind: 'Seite',
              title: entry.label,
              run: () => navigateToPage(entry.page),
            }),
          ),
        ...paletteActions
          .filter((entry) => matches(entry.label))
          .map(
            (entry): PaletteResult => ({
              id: `action-${entry.label}`,
              kind: 'Aktion',
              title: entry.label,
              run: entry.run,
            }),
          ),
      ];
    },
    [
      dataset?.employees,
      openAnnualReport,
      patients,
      navigateToEmployee,
      navigateToPatient,
      navigateToPage,
      openCreateModal,
      openCreatePatientModal,
    ],
  );

  // — MD-Prüfung —

  const exportPersonList = async () => {
    try {
      const result = await api.audits.exportPersonList();
      if (result.saved) {
        setToastMessage(
          `Personenliste nach Anlage 7 gespeichert — ${result.total} Personen alphabetisch${
            result.withoutGroup ? `, ${result.withoutGroup} ohne Teilgruppe` : ''
          }.`,
        );
      }
    } catch (err) {
      handleError(err);
    }
  };

  const closeInstructionModal = () =>
    setInstructionModal({
      open: false,
      topic: '',
      legalBasis: '',
      note: '',
      intervalMonths: null,
      intervalSource: 'betrieblich',
    });

  const openAssignInstructionModal = async (definitionId: number) => {
    try {
      setAssignAlreadyOpenIds(await api.instructions.employeesWithOpen(definitionId));
      setAssignInstructionModal({ ...emptyAssignInstructionModal(), open: true, definitionId });
    } catch (err) {
      handleError(err);
    }
  };

  const saveAssignInstruction = async () => {
    const definitionId = assignInstructionModal.definitionId;
    if (definitionId == null) return;
    try {
      const assigned = await api.instructions.assignToEmployees({
        instructionDefinitionId: definitionId,
        employeeIds: assignInstructionModal.selectedEmployeeIds,
        dueDate: assignInstructionModal.dueDate || null,
      });
      setAssignInstructionModal(emptyAssignInstructionModal());
      if (selectedEmployee?.id) await loadEmployeeInstructions(selectedEmployee.id);
      setToastMessage(
        assigned === 1 ? 'Einer Person zugeordnet.' : `${assigned} Personen zugeordnet.`,
      );
    } catch (err) {
      handleError(err);
    }
  };

  const saveAudit = async () => {
    try {
      const results = auditSections.map((section) => ({
        sectionKey: section.key,
        result: auditModal.results[section.key] ?? 'unrecorded',
      }));
      const updated = await api.audits.save({
        id: auditModal.id,
        auditDate: auditModal.auditDate,
        inspector: auditModal.inspector || null,
        kind: auditModal.kind,
        findings: auditModal.findings || null,
        reportRef: auditModal.reportRef || null,
        confirmed: auditModal.confirmed ?? false,
        results,
        clientIds: auditModal.clientIds,
      });
      qprActions.setAudits(updated);
      setAuditModal(emptyAuditModal());
      setToastMessage('Prüfung gespeichert.');
    } catch (err) {
      handleError(err);
    }
  };

  const deleteAudit = () => {
    if (!auditModal.id) return;
    setConfirmState({
      message: 'Prüfung und alle erfassten Ergebnisse wirklich löschen?',
      danger: true,
      confirmLabel: 'Löschen',
      onConfirm: async () => {
        try {
          qprActions.setAudits(await api.audits.delete(auditModal.id as number));
          setAuditModal(emptyAuditModal());
          setToastMessage('Prüfung gelöscht.');
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  // — Verwaltung lists —

  const adminPage = (): {
    title: string;
    subtitle: string;
    items: AdminItem[];
    empty: string;
  } | null => {
    if (page === 'quals') {
      return {
        title: 'Qualifikationen',
        subtitle: 'Kategorien für den Jahresnachweis. Reihenfolge = Reihenfolge im Export.',
        empty: 'Noch keine Qualifikation angelegt.',
        items: qualifications
          .filter((entry) => entry.id != null)
          .map((entry) => ({
            id: entry.id as number,
            title: entry.name,
            note: entry.note ?? 'Ohne Notiz',
            tags: [] as string[],
            usage: personCountLabel(
              (dataset?.employees ?? []).filter(
                (employee) => employee.qualification === entry.name,
              ).length,
            ),
          })),
      };
    }
    if (page === 'services') {
      const activePatients = patients.filter((patient) => isActivePatient(patient));
      return {
        title: 'Leistungen für betreute Personen',
        subtitle:
          'Leistungskatalog für die Auswahl im Patientenformular; bestehende Zuordnungen bleiben nachvollziehbar.',
        empty: 'Noch keine Leistung angelegt.',
        items: serviceDefinitions
          .filter((entry) => entry.id != null)
          .map((entry) => ({
            id: entry.id as number,
            title: entry.name,
            note:
              entry.name === SERVICE_TYPE_LABEL[entry.serviceType]
                ? ''
                : SERVICE_TYPE_LABEL[entry.serviceType],
            tags: entry.active === false ? ['deaktiviert'] : [],
            usage: patientCountLabel(
              activePatients.filter((patient) =>
                patient.serviceDefinitionIds?.includes(entry.id as number),
              ).length,
            ),
            active: entry.active,
          })),
      };
    }
    if (page === 'comps') {
      return {
        title: 'Kompetenzen im Team',
        subtitle:
          'Fachliche Fähigkeiten und Nachweise der Mitarbeitenden. Grundlage der Kompetenzmatrix.',
        empty: 'Noch keine Kompetenz angelegt.',
        items: competencyDefinitions
          .filter((entry) => entry.id != null)
          .map((entry) => ({
            id: entry.id as number,
            title: entry.code ? `${entry.code} · ${entry.name}` : entry.name,
            note: entry.note ?? `Relevanz: ${entry.relevance ?? 'Alle'}`,
            tags: [entry.category ?? 'Allgemein'],
            usage: `${definitionUsage.competencies[entry.id as number] ?? 0} zugeordnet`,
          })),
      };
    }
    if (page === 'instrs') {
      return {
        title: 'Einweisungen',
        subtitle:
          'Unterweisungen und Nachweise mit betrieblicher Zuordnung und Wiederholungsintervall.',
        empty: 'Noch keine Einweisung angelegt.',
        items: instructionDefinitions
          .filter((entry) => entry.id != null)
          .map((entry) => ({
            id: entry.id as number,
            title: entry.topic,
            note:
              entry.note ??
              (entry.intervalMonths != null
                ? describeInterval(entry.intervalMonths, entry.intervalSource)
                : undefined),
            tags: entry.legalBasis ? [entry.legalBasis] : [],
            usage: `${definitionUsage.instructions[entry.id as number] ?? 0} zugeordnet`,
          })),
      };
    }
    return null;
  };

  const reorderTo = (
    ids: number[],
    id: number,
    targetIndex: number,
    persist: (ordered: number[]) => void | Promise<void>,
  ) => {
    const without = ids.filter((entry) => entry !== id);
    without.splice(targetIndex, 0, id);
    void persist(without);
  };

  // — auth gate —

  if (authLoading || appReady.startupError || !appReady.configured || !appReady.unlocked) {
    if (!authLoading && appReady.connectionMode === 'server') {
      return <ServerSignIn />;
    }
    const authMode: 'setup' | 'login' = appReady.configured ? 'login' : 'setup';
    return (
      <>
        <AuthScreen
          mode={authLoading ? 'loading' : appReady.startupError ? 'error' : authMode}
          onSubmit={(payload) => handleLogin(payload, authMode)}
          busy={loading}
          onForgotPassword={appReady.configured ? startRecoveryReset : undefined}
          onResetApp={appReady.configured ? handleFullReset : undefined}
          globalError={appReady.startupError ?? error}
          configuredStorageMode={appReady.storageMode}
          footer={
            <>
            <AuthUpdates
              status={updateStatus}
              version={appInfo?.version}
              onCheck={handleCheckUpdates}
              onDownload={handleDownloadUpdate}
              onInstall={handleInstallUpdate}
            />
            {!authLoading && !appReady.startupError && <ServerConnectLink />}
            </>
          }
        />
        <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
        <RecoveryKeyModal
          state={recoveryKeyModal}
          onClose={() => setRecoveryKeyModal((prev) => ({ ...prev, open: false, info: null }))}
          onCopy={handleCopyRecoveryKey}
        />
        <RecoveryResetModal
          state={recoveryReset}
          loading={loading}
          onChange={(next) => setRecoveryReset((prev) => ({ ...prev, ...next }))}
          onClose={() =>
            setRecoveryReset({
              open: false,
              recoveryKey: '',
              newPassword: '',
              repeat: '',
              error: null,
            })
          }
          onSubmit={handleRecoveryReset}
        />
        {toast && <div className="cd-toast">{toast}</div>}
        {error && <div className="cd-toast cd-toast-error">{error}</div>}
        {loading && <div className="cd-loading">Lade / speichere …</div>}
      </>
    );
  }

  const admin = adminPage();
  const editedServiceDefinition = serviceDefinitions.find(
    (entry) => entry.id === serviceDefinitionModal.id,
  );
  const visibleCalendarEvents = Object.fromEntries(
    Object.entries(calendar.eventsByDate).map(([key, events]) => [
      key,
      events.filter((event) => !hiddenEventGroups.includes(groupOfEvent(event.type))),
    ]),
  );
  const dayEvents = dayModalDate ? (calendar.eventsByDate[dayModalDate] ?? []) : [];

  return (
    <div className="app-shell">
      {inSettings ? (
        <SettingsSidebar
          current={page}
          wide={wideSidebar}
          storageMode={storageMode}
          onNavigate={navigateToPage}
          onLeave={() => navigateToPage(previousPage)}
          onLock={() => void handleLock()}
        />
      ) : (
        <AppSidebar
          current={sidebarPage}
          wide={wideSidebar}
          storageMode={storageMode}
          openTaskCount={tasks.filter((task) => !doneTaskIds.includes(task.id)).length}
          updateStatus={updateStatus}
          currentVersion={appInfo?.version}
          onNavigate={navigateToPage}
          onOpenPalette={() => setPaletteOpen(true)}
          onLock={() => void handleLock()}
          onCheckUpdates={handleCheckUpdates}
          onDownloadUpdate={handleDownloadUpdate}
          onInstallUpdate={handleInstallUpdate}
        />
      )}

      <main className="app-main">
        {page === 'dashboard' && (
          <Dashboard
            year={year}
            years={years}
            dataset={dataset}
            baseHours={baseHours}
            totalFte={totalFte}
            totalHeadcount={dataset?.aggregation.totalHeadcount ?? 0}
            actionNeededCount={patients.filter((patient) => patient.latestActionNeeded).length}
            tasks={tasks}
            doneTaskIds={doneTaskIds}
            quality={quality}
            upcoming={upcoming}
            onYearChange={setYear}
            onToggleTask={(id) =>
              setDoneTaskIds((current) =>
                current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
              )
            }
            onOpenTarget={openTarget}
            onOpenEvent={(event) => void openEvent(event)}
            onOpenReport={() => {
              setReportYear(year - 1);
              openAnnualReport();
            }}
            onGoCalendar={() => navigateToPage('calendar')}
            onOpenTasks={() => navigateToPage('tasks')}
          />
        )}

        {page === 'tasks' && (
          <TasksPage
            tasks={tasks}
            doneTaskIds={doneTaskIds}
            onToggleTask={(id) =>
              setDoneTaskIds((current) =>
                current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
              )
            }
            onOpenTarget={openTarget}
          />
        )}

        {page === 'integrity' && (
          <EmploymentIntegrityPage
            overview={employmentIntegrity}
            status={employmentIntegrityStatus}
            onRefresh={() => void refreshEmploymentIntegrity()}
            onOpenEmployee={(id) => openTarget({ kind: 'employee', id, tab: 'hist' })}
          />
        )}

        {page === 'list' && (
          <EmployeeList
            onImport={() =>
              void window.api.chooseStaffImport().then(setStaffImport).catch(handleError)
            }
            year={year}
            annualFteMethod={dataset?.annualSummary?.method}
            directoryMode={directoryMode}
            onDirectoryModeChange={setDirectoryMode}
            years={years}
            search={search}
            statusFilter={statusFilter}
            qualificationFilter={qualificationFilter}
            qualifications={qualifications}
            filteredEmployees={
              directoryMode
                ? (directoryDataset?.employees ?? []).filter(
                    (e) =>
                      e.name.toLowerCase().includes(search.toLowerCase()) &&
                      (statusFilter === 'all' || e.status === statusFilter) &&
                      (qualificationFilter === 'all' || e.qualification === qualificationFilter),
                  )
                : filteredEmployees
            }
            totalFte={directoryMode ? (directoryDataset?.aggregation.totalFte ?? 0) : totalFte}
            wideTable={wideTable}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onQualificationChange={setQualificationFilter}
            onYearChange={(value) => {
              setDirectoryMode(false);
              setYear(value);
            }}
            onExport={
              directoryMode
                ? () =>
                    void api.data
                      .export(currentYear, 'xlsx', 'directory')
                      .then((r) => {
                        if (r.error) handleError(new Error(r.error));
                      })
                      .catch(handleError)
                : handleExport
            }
            onOpenReport={() => {
              setReportYear(year);
              openAnnualReport();
            }}
            onCreate={openCreateModal}
            onSelect={(employee) => void navigateToEmployee(employee)}
          />
        )}

        {page === 'view' && selectedEmployee && (
          <EmployeeDetail key={selectedEmployee.id}
            instructionReminderDays={careSettings.instructionReminderDays}
            employee={selectedEmployee}
            baseHours={baseHours}
            tab={detailTab}
            competencies={employeeCompetencies}
            instructions={employeeInstructions}
            timelineItems={timelineItems}
            employmentIntegrity={employmentIntegrity}
            backupFolder={backup.folder}
            suggestedCompetencyCount={suggestedCompetencyDefinitions.length}
            availableCompetencyCount={availableCompetencyDefinitions.length}
            availableInstructionCount={availableInstructionDefinitions.length}
            onTabChange={setDetailTab}
            onEdit={openEditModal}
            onWorkingTimeSaved={reloadSelectedEmployee}
            onCompetenciesSaved={setEmployeeCompetencies}
            onAddCompetency={openNewEmployeeCompetencyModal}
            onAddInstruction={openNewEmployeeInstructionModal}
            onOpenSuggestedCompetencies={openSuggestedCompetencyModal}
            onSelectCompetency={openEmployeeCompetencyModal}
            onSelectInstruction={openEmployeeInstructionModal}
            onStartNewPeriod={openNewPeriodModal}
            onOpenEmploymentAction={openEmploymentAction}
            onSelectTimelineItem={(item) =>
              item.kind === 'period'
                ? openExistingPeriodModal(item.record)
                : openEventModalForEvent(item.record)
            }
            onEditPeriod={openExistingPeriodModal}
            onOpenBackupSettings={() => navigateToPage('security')}
            onEmploymentRepairApplied={async (message) => {
              await refreshAfterEmploymentRepair();
              setToastMessage(message);
            }}
          />
        )}

        {page === 'patients' && !selectedPatient && (
          <PatientList
            search={patientSearch}
            groupFilter={patientGroupFilter}
            patients={filteredPatients}
            visitTrends={recentVisits}
            visitIntervalDays={careSettings.visitIntervalDays}
            wideTable={wideTable}
            onSearchChange={setPatientSearch}
            onGroupChange={setPatientGroupFilter}
            onCreate={openCreatePatientModal}
            onSelect={(patient) => void navigateToPatient(patient)}
          />
        )}

        {page === 'patients' && selectedPatient && (
          <PatientDetail
            patient={selectedPatient}
            visits={patientVisits}
            visitIntervalDays={careSettings.visitIntervalDays}
            onEdit={() => openEditPatientModal(selectedPatient)}
            onNewVisit={() => openVisitModal(selectedPatient.id as number)}
            onSelectVisit={(visit) => openVisitModal(selectedPatient.id as number, visit)}
          />
        )}

        {page === 'calendar' && (
          <CalendarPage
            currentDate={calendar.currentDate}
            view={calendar.view}
            eventsByDate={visibleCalendarEvents}
            periodLabel={calendar.periodLabel}
            loading={calendar.loading}
            hiddenGroups={hiddenEventGroups}
            onToggleGroup={(group) =>
              setHiddenEventGroups((current) =>
                current.includes(group)
                  ? current.filter((entry) => entry !== group)
                  : [...current, group],
              )
            }
            onViewChange={calendarActions.setView}
            onPrev={calendarActions.prevPeriod}
            onNext={calendarActions.nextPeriod}
            onToday={calendarActions.goToToday}
            onMonthClick={calendarActions.goToMonth}
            onEventClick={(event) => void openEvent(event)}
            onDayClick={setDayModalDate}
          />
        )}

        {page === 'audit' && (
          <AuditPage
            patients={patients}
            audits={audits}
            visitIntervalDays={careSettings.visitIntervalDays}
            onCreateAudit={() => setAuditModal({ ...emptyAuditModal(), open: true })}
            onOpenAudit={setAuditView}
            onExportPersonList={() => void exportPersonList()}
            onGoPatients={() => navigateToPage('patients')}
            onOpenPatient={(id) => openTarget({ kind: 'patient', id })}
          />
        )}

        {admin && (
          <AdminListPage
            title={admin.title}
            subtitle={admin.subtitle}
            items={admin.items}
            emptyLabel={admin.empty}
            onCreate={() => {
              if (page === 'quals') setQualificationModal({ open: true, value: '', note: '' });
              if (page === 'services') openCreateServiceDefinition();
              if (page === 'comps')
                setCompetencyModal({
                  open: true,
                  code: '',
                  value: '',
                  category: 'Allgemein',
                  relevance: 'Alle',
                  note: '',
                });
              if (page === 'instrs')
                setInstructionModal({
                  open: true,
                  topic: '',
                  legalBasis: '',
                  note: '',
                  intervalMonths: null,
                  intervalSource: 'betrieblich',
                });
            }}
            onEdit={(id) => {
              if (page === 'quals') {
                const entry = qualifications.find((item) => item.id === id);
                if (entry)
                  setQualificationModal({
                    open: true,
                    id,
                    value: entry.name,
                    note: entry.note ?? '',
                  });
              }
              if (page === 'services') {
                const entry = serviceDefinitions.find((item) => item.id === id);
                if (entry) openEditServiceDefinition(entry);
              }
              if (page === 'comps') {
                const entry = competencyDefinitions.find((item) => item.id === id);
                if (entry)
                  setCompetencyModal({
                    open: true,
                    id,
                    code: entry.code ?? '',
                    value: entry.name,
                    category: entry.category ?? 'Allgemein',
                    relevance: entry.relevance ?? 'Alle',
                    note: entry.note ?? '',
                  });
              }
              if (page === 'instrs') {
                const entry = instructionDefinitions.find((item) => item.id === id);
                if (entry)
                  setInstructionModal({
                    open: true,
                    id,
                    topic: entry.topic,
                    legalBasis: entry.legalBasis ?? '',
                    note: entry.note ?? '',
                    intervalMonths: entry.intervalMonths ?? null,
                    intervalSource: entry.intervalSource ?? 'betrieblich',
                    minorHazardInstruction: entry.minorHazardInstruction ?? false,
                  });
              }
            }}
            onReorder={(id, targetIndex) => {
              if (page === 'quals')
                reorderTo(
                  admin.items.map((item) => item.id),
                  id,
                  targetIndex,
                  reorderQualification,
                );
              if (page === 'comps')
                reorderTo(
                  admin.items.map((item) => item.id),
                  id,
                  targetIndex,
                  reorderCompetencyDefinition,
                );
              if (page === 'instrs')
                reorderTo(
                  admin.items.map((item) => item.id),
                  id,
                  targetIndex,
                  reorderInstructionDefinition,
                );
              if (page === 'services')
                reorderTo(
                  admin.items.map((item) => item.id),
                  id,
                  targetIndex,
                  reorderServiceDefinitions,
                );
            }}
          />
        )}

        {page === 'settings' && (
          <SettingsGeneral
            annualFteMethod={dataset?.annualSummary?.method ?? DEFAULT_ANNUAL_FTE_METHOD}
            annualFteSaving={annualFteSaving}
            onAnnualFteMethodChange={handleSaveAnnualFteMethod}
            baseHoursInput={baseHoursInput}
            careSettings={careSettings}
            onBaseHoursInputChange={setBaseHoursInput}
            onSaveBaseHours={handleSaveBaseHoursValue}
            onCareSettingsChange={qprActions.saveCareSettings}
          />
        )}

        {page === 'security' && appReady.connectionMode === 'server' && (
          <div className="cd-page cd-narrow">
            <h1 className="cd-h1">Sicherheit &amp; Backup</h1>
            <p>Der ClearDeck-API-Server übernimmt Synchronisierung und serverseitige Backups.</p>
            <p>Die lokale Kopie bleibt auf diesem Gerät. Ihre Verschlüsselung und lokale Backups stellst du hier ein.</p>
            <button className="btn" onClick={() => setExportOpen(true)}>Serverbestand exportieren</button>
          </div>
        )}
        {page === 'security' && appReady.connectionMode !== 'server' && (
          <SettingsSecurity
            storageMode={storageMode}
            encryptionSetup={encryptionSetup}
            dbMessage={dbMessage}
            backup={backup}
            backupBusy={backupBusy}
            onRunBackup={() => void runBackup()}
            onChooseBackupFolder={() => {
              void (async () => {
                try {
                  setBackup(await api.backup.chooseFolder());
                } catch (err) {
                  handleError(err);
                }
              })();
            }}
            onBackupSettingsChange={(next) => {
              void (async () => {
                try {
                  setBackup(await api.backup.set(next));
                } catch (err) {
                  handleError(err);
                }
              })();
            }}
            onOpenExport={() => setExportOpen(true)}
            onOpenRestore={() => setRestoreOpen(true)}
            onOpenPassword={() => {
              setPasswordError(null);
              setPasswordOpen(true);
            }}
            onOpenRecoveryKey={() => openRecoveryKey('settings')}
            onOpenEnableEncryption={openEnableEncryption}
            onDisableEncryption={handleDisableEncryption}
            onDropDatabase={handleDropDatabase}
            onFullReset={handleFullReset}
          />
        )}

        {page === 'connections' && <SettingsConnections onNotice={setToastMessage} />}

        {page === 'about' && (
          <SettingsAbout
            appInfo={appInfo}
            updateStatus={updateStatus}
            lastUpdateCheckAt={lastUpdateCheckAt}
            onCheckUpdates={handleCheckUpdates}
            onContact={() => {
              if (appInfo?.email) void api.app.openExternal(`mailto:${appInfo.email}`);
            }}
          />
        )}

        {page === 'logs' && (
          <SettingsLogs appInfo={appInfo} storageMode={storageMode} onNotice={setToastMessage} />
        )}

        {page === 'shortcuts' && <SettingsShortcuts />}

        {page === 'dev' && <DevPage />}
      </main>

      <CommandPalette
        open={paletteOpen}
        results={paletteResults}
        onClose={() => setPaletteOpen(false)}
      />

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <RecoveryKeyModal
        state={recoveryKeyModal}
        onClose={() => setRecoveryKeyModal((prev) => ({ ...prev, open: false, info: null }))}
        onCopy={handleCopyRecoveryKey}
      />
      <RecoveryResetModal
        state={recoveryReset}
        loading={loading}
        onChange={(next) => setRecoveryReset((prev) => ({ ...prev, ...next }))}
        onClose={() =>
          setRecoveryReset({
            open: false,
            recoveryKey: '',
            newPassword: '',
            repeat: '',
            error: null,
          })
        }
        onSubmit={handleRecoveryReset}
      />

      <QualificationModal
        state={qualificationModal}
        onChange={(next) => setQualificationModal((prev) => ({ ...prev, ...next }))}
        onClose={() => setQualificationModal({ open: false, value: '', note: '' })}
        onSave={handleSaveQualificationModal}
        onDelete={confirmDeleteQualification}
      />
      <ServiceDefinitionModal
        state={serviceDefinitionModal}
        active={editedServiceDefinition?.active !== false}
        onChange={(next) => setServiceDefinitionModal((prev) => ({ ...prev, ...next }))}
        onClose={() => setServiceDefinitionModal({ ...serviceDefinitionModal, open: false })}
        onSave={() => void saveServiceDefinition()}
        onToggleActive={
          editedServiceDefinition
            ? () =>
                toggleServiceDefinition(
                  editedServiceDefinition.id as number,
                  editedServiceDefinition.active === false,
                )
            : undefined
        }
      />
      <CompetencyModal
        state={competencyModal}
        onChange={(next) => setCompetencyModal((prev) => ({ ...prev, ...next }))}
        onClose={() =>
          setCompetencyModal({
            open: false,
            code: '',
            value: '',
            category: 'Allgemein',
            relevance: 'Alle',
            note: '',
          })
        }
        onSave={handleSaveCompetencyModal}
        onDelete={confirmDeleteCompetencyDefinition}
      />
      <AssignInstructionModal
        state={assignInstructionModal}
        definition={instructionDefinitions.find(
          (entry) => entry.id === assignInstructionModal.definitionId,
        )}
        employees={dataset?.employees ?? []}
        alreadyOpenIds={assignAlreadyOpenIds}
        onChange={(next) => setAssignInstructionModal((prev) => ({ ...prev, ...next }))}
        onClose={() => setAssignInstructionModal(emptyAssignInstructionModal())}
        onSave={saveAssignInstruction}
      />

      <InstructionModal
        state={instructionModal}
        onChange={(next) => setInstructionModal((prev) => ({ ...prev, ...next }))}
        onClose={closeInstructionModal}
        onSave={handleSaveInstructionModal}
        onDelete={confirmDeleteInstructionDefinition}
        onAssign={(id) => {
          closeInstructionModal();
          void openAssignInstructionModal(id);
        }}
      />

      <EmployeeCompetencyModal
        state={employeeCompetencyModal}
        employeeName={selectedEmployee?.name ?? ''}
        availableDefinitions={availableCompetencyDefinitions}
        onChange={(next) => setEmployeeCompetencyModal((prev) => ({ ...prev, ...next }))}
        onClose={() =>
          setEmployeeCompetencyModal({
            open: false,
            competencyDefinitionId: null,
            competencyName: '',
            level: null,
            approvedAt: '',
            approvedBy: '',
            note: '',
          })
        }
        onSave={handleSaveEmployeeCompetency}
        onDelete={handleDeleteEmployeeCompetency}
      />
      <EmployeeInstructionModal
        state={employeeInstructionModal}
        employeeName={selectedEmployee?.name ?? ''}
        employeeBirthDate={selectedEmployee?.birthDate}
        definition={instructionDefinitions.find(
          (entry) => entry.id === employeeInstructionModal.instructionDefinitionId,
        )}
        availableDefinitions={availableInstructionDefinitions}
        onChange={(next) => setEmployeeInstructionModal((prev) => ({ ...prev, ...next }))}
        onClose={() =>
          setEmployeeInstructionModal({
            open: false,
            instructionDefinitionId: null,
            instructionName: '',
            dueDate: '',
            completedAt: '',
            conductedBy: '',
            note: '',
            scheduleFollowUp: false,
          })
        }
        onSave={handleSaveEmployeeInstruction}
        onDelete={handleDeleteEmployeeInstruction}
      />
      <RecommendedCompetenciesModal
        state={suggestedCompetencyModal}
        definitions={competencyDefinitions}
        qualifications={qualifications.map((entry) => entry.name)}
        employeeQualification={selectedEmployee?.qualification ?? ''}
        assignedIds={employeeCompetencies.map((entry) => entry.competencyDefinitionId)}
        busy={loading}
        onQualificationChange={(qualification) => setSuggestedCompetencyModal({
          open: true, qualification, selectedDefinitionIds: [],
        })}
        onToggle={toggleSuggestedCompetencySelection}
        onSelectAll={selectAllSuggestedCompetencies}
        onClose={() => { if (!loading) setSuggestedCompetencyModal({ open: false, selectedDefinitionIds: [] }); }}
        onSave={handleAddRecommendedCompetencies}
      />

      <EmployeeModal
        state={editModal}
        form={form}
        qualifications={qualifications}
        fteHelp={fteHelp}
        onStateChange={(next) => setEditModal((prev) => ({ ...prev, ...next }))}
        onFormChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
        onWeeklyHoursChange={updateWeeklyHours}
        onFteChange={updateFteValue}
        onToggleLinked={toggleLinked}
        onClose={() => setEditModal((prev) => ({ ...prev, open: false }))}
        onSave={handleEditModalSave}
        onDelete={form.id ? () => confirmDeleteEmployee(form.id) : undefined}
        existingEmployees={employmentIntegrity.employees}
        onOpenExisting={(employeeId) => openTarget({ kind: 'employee', id: employeeId })}
      />

      {eventModal.open && selectedEmployee && (
        <EventModal
          employee={selectedEmployee}
          baseHours={baseHours}
          onWorkingTimeSaved={reloadSelectedEmployee}
          state={eventModal}
          periodForm={addPeriodForm}
          qualifications={qualifications}
          onStateChange={(next) => setEventModal((prev) => ({ ...prev, ...next }))}
          onPeriodFormChange={setAddPeriodForm}
          onClose={() => setEventModal((prev) => ({ ...prev, open: false }))}
          onSaveEvent={handleSaveEvent}
          onSavePeriod={handleAddPeriod}
          onDeleteEvent={handleDeleteEvent}
          onDeletePeriod={(periodId, label) => setPeriodToDelete({ periodId, label })}
        />
      )}

      {selectedEmployee && (
        <EmploymentActionModal
          open={employmentAction.open}
          mode={employmentAction.mode}
          employee={selectedEmployee}
          periods={periods}
          qualifications={qualifications}
          onClose={closeEmploymentAction}
          onSave={saveEmploymentAction}
        />
      )}

      <PatientModal
        modal={patientModal}
        serviceDefinitions={serviceDefinitions}
        onChange={setPatientModal}
        onClose={closePatientModal}
        onSave={handleSavePatient}
        onDelete={patientModal.id ? () => confirmDeletePatient(patientModal.id) : undefined}
      />
      <VisitModal
        modal={patientVisitModal}
        patientName={selectedPatient?.name ?? ''}
        onChange={setPatientVisitModal}
        onClose={closeVisitModal}
        onSave={handleSaveVisit}
        onDelete={confirmDeleteVisit}
      />

      <BackupExportModal
        open={exportOpen}
        encryptedAvailable={appReady.connectionMode !== 'server' && storageMode === 'encrypted'}
        onExport={(mode) => {
          setExportOpen(false);
          void handleDbExport(mode);
        }}
        onClose={() => setExportOpen(false)}
      />
      <BackupRestoreModal
        open={restoreOpen}
        busy={restoreBusy}
        backups={backup.backups}
        folder={backup.folder}
        onRestore={(source, recoveryKey) => void restoreFromBackup(source, recoveryKey)}
        onPickFile={(recoveryKey) => {
          setRestoreOpen(false);
          void handleDbImport(storageMode === 'encrypted' ? 'encrypted' : 'plain', recoveryKey);
        }}
        onClose={() => setRestoreOpen(false)}
      />

      <PasswordModal
        open={passwordOpen}
        busy={passwordBusy}
        error={passwordError}
        onSubmit={(input) => void changePassword(input)}
        onClose={() => setPasswordOpen(false)}
      />

      <AuditModal
        modal={auditModal}
        sections={auditSections}
        patients={patients}
        onChange={setAuditModal}
        onClose={() => setAuditModal(emptyAuditModal())}
        onSave={() => void saveAudit()}
        onDelete={auditModal.id ? deleteAudit : undefined}
      />
      <StaffImportModal
        preview={staffImport}
        employees={directoryDataset?.employees ?? []}
        busy={staffImportBusy}
        onChange={setStaffImport}
        onClose={() => {
          if (!staffImportBusy) setStaffImport(null);
        }}
        onSave={() => {
          if (!staffImport) return;
          setStaffImportBusy(true);
          void window.api
            .commitStaffImport(staffImport.rows)
            .then(async (result) => {
              setDataset(await api.employees.list(year));
              setQualifications(await api.qualifications.list());
              setStaffImport(null);
              setToastMessage(
                `${result.imported} Zeilen übernommen. Historische Werte anhand der Belege prüfen.`,
              );
            })
            .catch(handleError)
            .finally(() => setStaffImportBusy(false));
        }}
      />
      <AuditViewModal
        audit={auditView}
        sections={auditSections}
        patients={patients}
        onEdit={() => {
          if (!auditView) return;
          setAuditModal({
            open: true,
            mode: 'edit',
            id: auditView.id,
            auditDate: auditView.auditDate,
            inspector: auditView.inspector ?? '',
            kind: auditView.kind ?? 'regel',
            findings: auditView.findings ?? '',
            reportRef: auditView.reportRef ?? '',
            confirmed: auditView.confirmed ?? false,
            results: Object.fromEntries(
              auditView.results.map((entry) => [entry.sectionKey, entry.result]),
            ),
            clientIds: auditView.clientIds,
          });
          setAuditView(null);
        }}
        onOpenPatient={(id) => {
          setAuditView(null);
          openTarget({ kind: 'patient', id });
        }}
        onClose={() => setAuditView(null)}
      />

      <DayModal
        date={dayModalDate}
        events={dayEvents}
        onSelectEvent={(event) => {
          setDayModalDate(null);
          void openEvent(event);
        }}
        onClose={() => setDayModalDate(null)}
      />

      <ReportModal
        open={reportOpen}
        year={reportYear}
        mode={reportMode}
        onModeChange={setReportMode}
        years={years}
        baseHours={baseHours}
        dataset={reportDataset}
        loading={!reportDataset}
        onYearChange={(next) => {
          setReportYear(next);
        }}
        onExport={() => {
          setReportOpen(false);
          void api.data
            .export(reportYear, 'xlsx', reportMode)
            .then((result) => {
              if (result.error) handleError(new Error(result.error));
              else if (result.saved) setToastMessage(`Jahresnachweis ${reportYear} gespeichert.`);
            })
            .catch(handleError);
        }}
        onFixMissingHours={() => {
          const target = (dataset?.employees ?? []).find(
            (employee) => employee.weeklyHours == null,
          );
          if (target?.id != null) {
            setReportOpen(false);
            openTarget({ kind: 'employee', id: target.id, tab: 'hist' });
          }
        }}
        onClose={() => setReportOpen(false)}
      />

      {toast && <div className="cd-toast">{toast}</div>}
      {error && <div className="cd-toast cd-toast-error">{error}</div>}
      {loading && <div className="cd-loading">Lade / speichere …</div>}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
