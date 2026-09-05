import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faLink, faLinkSlash, faPen, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { createRoot } from 'react-dom/client';
import './index.css';
import AuthScreen from './components/auth/AuthScreen';
import AuthUpdates from './components/auth/AuthUpdates';
import Sidebar from './components/layout/Sidebar';
import YearSelector from './components/ui/YearSelector';
import Dashboard from './components/pages/Dashboard';
import EmployeeList from './components/pages/EmployeeList';
import EmployeeForm from './components/pages/EmployeeForm';
import EmployeeDetail from './components/pages/EmployeeDetail';
import SettingsPage from './components/pages/SettingsPage';
import DevPage from './components/pages/DevPage';
import CalendarPage from './components/pages/CalendarPage';
import PatientList from './components/pages/PatientList';
import PatientDetail from './components/pages/PatientDetail';
import VisitModal from './components/patients/VisitModal';
import ConfirmModal from './components/modals/ConfirmModal';
import RecoveryKeyModal from './components/modals/RecoveryKeyModal';
import RecoveryResetModal from './components/modals/RecoveryResetModal';
import QualificationModal from './components/modals/QualificationModal';
import CompetencyModal from './components/modals/CompetencyModal';
import InstructionModal from './components/modals/InstructionModal';
import EmployeeCompetencyModal from './components/modals/EmployeeCompetencyModal';
import EmployeeInstructionModal from './components/modals/EmployeeInstructionModal';
import RecommendedCompetenciesModal from './components/modals/RecommendedCompetenciesModal';
import ModalHeader from './components/modals/ModalHeader';
import BirthDateInput from './components/ui/BirthDateInput';
import { deriveFteFromWeeklyHours, deriveWeeklyHoursFromFte } from './utils/fte';
import {
  buildNavigationSnapshot,
  createAppHistoryState,
  isAppHistoryState,
  resolveNavigationSnapshot,
} from './utils/navigationHistory';
import { matchesQualificationRelevance } from './utils/qualificationRelevance';
import { unifyEvents } from './utils/unifyEvents';
import useAppLogic from './hooks/useAppLogic';
import type { EventModalType, Page } from './types/ui';
import type { EmployeeWithPeriod, PatientWithLatestVisit, UnifiedEvent } from './shared/types';

const App = () => {
  const {
    constants: { fteHelp, pageTitle, pageSubtitle },
    state: {
      currentYear,
      year,
      dataset,
      baseHours,
      baseHoursInput,
      qualifications,
      competencyDefinitions,
      instructionDefinitions,
      form,
      periods,
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
      snoozeUpdates,
      appInfo,
      storageMode,
      encryptionSetup,
      search,
      statusFilter,
      qualificationFilter,
      addNewPeriod,
      qualificationEdits,
      competencyEdits,
      qualificationModal,
      competencyModal,
      instructionModal,
      editModal,
      employeeCompetencyModal,
      employeeInstructionModal,
      suggestedCompetencyModal,
      addPeriodForm,
      eventModal,
      confirmState,
      recoveryKeyModal,
      recoveryReset,
      upcomingEvents,
      hiddenEventTypes,
      calendar,
      dashboardWidgets,
      // Patient state
      patients,
      selectedPatient,
      patientVisits,
      patientModal,
      patientSearch,
      patientRatingFilter,
      patientVisitModal,
    },
    setters: {
      setYear,
      setBaseHoursInput,
      setForm,
      setAddPeriodForm,
      setAddNewPeriod,
      setQualificationFilter,
      setQualificationModal,
      setCompetencyModal,
      setInstructionModal,
      setEditModal,
      setEmployeeCompetencyModal,
      setEmployeeInstructionModal,
      setSuggestedCompetencyModal,
      setEncryptionSetup,
      setSearch,
      setStatusFilter,
      setPeriodToDelete,
      setEventModal,
      setRecoveryKeyModal,
      setRecoveryReset,
      setConfirmState,
      // Patient setters
      setPatientModal,
      setSelectedPatient,
      setPatientSearch,
      setPatientRatingFilter,
      setPatientVisitModal,
    },
    derived: { filteredEmployees, averageFte, totalFte, totalHeadcount, displayStart, timelineItems, crumbs, sidebarPage, filteredPatients },
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
      handleDropDatabase,
      handleFullReset,
      handleCheckUpdates,
      handleInstallUpdate,
      handleSnoozeUpdate,
      openEnableEncryption,
      closeEnableEncryption,
      handleEnableEncryption,
      handleDisableEncryption,
      handleAddPeriod,
      handleSaveEvent,
      handleDeleteEvent,
      openNewPeriodModal,
      openExistingPeriodModal,
      openEventModalForEvent,
      openCreateModal,
      openEditModal,
      handleEditModalSave,
      resetForm,
      toggleEventTypeFilter,
      showAllEventTypes,
      hideAllEventTypes,
      calendarActions,
      // Patient actions
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
    },
  } = useAppLogic();
  const [canGoBack, setCanGoBack] = useState(false);
  const historyIndexRef = useRef(0);
  const restoringHistoryRef = useRef(false);
  const selectedEmployeeRef = useRef(selectedEmployee);
  const selectedPatientRef = useRef(selectedPatient);
  const currentSnapshotRef = useRef(
    buildNavigationSnapshot(page, selectedEmployee?.id ?? null, selectedPatient?.id ?? null),
  );

  selectedEmployeeRef.current = selectedEmployee;
  selectedPatientRef.current = selectedPatient;

  const updateWeeklyHours = (value: string) => {
    setEditModal((prev) => {
      const next = { ...prev, weeklyHours: value };
      if (prev.linked) {
        const hoursNum = Number(value);
        if (!Number.isNaN(hoursNum) && hoursNum > 0) {
          const fteVal = deriveFteFromWeeklyHours(hoursNum, baseHours || 36);
          next.fteValue = fteVal ? fteVal.toFixed(2) : '';
        } else {
          next.fteValue = '';
        }
      }
      return next;
    });
  };

  const updateFteValue = (value: string) => {
    setEditModal((prev) => {
      const next = { ...prev, fteValue: value };
      if (prev.linked) {
        const fteNum = Number(value);
        if (!Number.isNaN(fteNum) && fteNum > 0) {
          const hoursVal = deriveWeeklyHoursFromFte(fteNum, baseHours || 36);
          next.weeklyHours = hoursVal ? hoursVal.toFixed(1) : '';
        } else {
          next.weeklyHours = '';
        }
      }
      return next;
    });
  };

  const toggleLinked = (checked: boolean) => {
    setEditModal((prev) => {
      const next = { ...prev, linked: checked };
      if (checked) {
        // Recompute derived value when re-linking
        if (prev.weeklyHours) {
          const hoursNum = Number(prev.weeklyHours);
          if (!Number.isNaN(hoursNum) && hoursNum > 0) {
            const fteVal = deriveFteFromWeeklyHours(hoursNum, baseHours || 36);
            next.fteValue = fteVal ? fteVal.toFixed(2) : '';
          }
        } else if (prev.fteValue) {
          const fteNum = Number(prev.fteValue);
          if (!Number.isNaN(fteNum) && fteNum > 0) {
            const hoursVal = deriveWeeklyHoursFromFte(fteNum, baseHours || 36);
            next.weeklyHours = hoursVal ? hoursVal.toFixed(1) : '';
          }
        }
      }
      return next;
    });
  };

  const isCreateMode = editModal.mode === 'create';
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
  const availableInstructionDefinitions = instructionDefinitions.filter(
    (definition) =>
      definition.id &&
      !employeeInstructions.some((entry) => entry.instructionDefinitionId === definition.id),
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
    [upcomingEvents, dashboardWidgets.expiringTrainings, dashboardWidgets.birthdaysAnniversaries, hiddenEventTypes, dashboardWidgets.patientBirthdays, dashboardWidgets.patientVisits],
  );

  const pushHistorySnapshot = useCallback(
    (snapshot: ReturnType<typeof buildNavigationSnapshot>) => {
      if (!appReady.unlocked) return;

      const nextIndex = historyIndexRef.current + 1;
      window.history.pushState(createAppHistoryState(nextIndex, snapshot), '');
      historyIndexRef.current = nextIndex;
      setCanGoBack(nextIndex > 0);
    },
    [appReady.unlocked],
  );

  const restoreSnapshot = useCallback(
    async (snapshot: ReturnType<typeof buildNavigationSnapshot>) => {
      const { page: resolvedPage, employee, patient } = resolveNavigationSnapshot(
        snapshot,
        dataset?.employees ?? [],
        patients,
      );

      if (resolvedPage !== 'patients') {
        setSelectedPatient(null);
      }

      if (resolvedPage === 'view' && employee) {
        await handleSelect(employee);
        return;
      }

      if (resolvedPage === 'patients') {
        goTo('patients');
        if (patient) {
          await handleSelectPatient(patient);
        } else {
          setSelectedPatient(null);
        }
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
    setCanGoBack(index > 0);
  }, [appReady.unlocked, currentSnapshot]);

  useEffect(() => {
    if (!appReady.unlocked) return;

    if (!isAppHistoryState(window.history.state)) {
      window.history.replaceState(createAppHistoryState(0, currentSnapshotRef.current), '');
      historyIndexRef.current = 0;
      setCanGoBack(false);
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = isAppHistoryState(event.state)
        ? event.state
        : createAppHistoryState(0, currentSnapshotRef.current);

      historyIndexRef.current = state.index;
      setCanGoBack(state.index > 0);
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
        const snapshot = buildNavigationSnapshot(
          target,
          selectedEmployeeRef.current?.id ?? null,
          target === 'patients' ? null : selectedPatientRef.current?.id ?? null,
        );
        pushHistorySnapshot(snapshot);
      }

      if (target === 'patients') {
        setSelectedPatient(null);
      }

      goTo(target);
    },
    [goTo, pushHistorySnapshot, setSelectedPatient],
  );

  const navigateToEmployee = useCallback(
    async (employee: EmployeeWithPeriod) => {
      if (!restoringHistoryRef.current) {
        pushHistorySnapshot(buildNavigationSnapshot('view', employee.id ?? null, null));
      }
      await handleSelect(employee);
    },
    [handleSelect, pushHistorySnapshot],
  );

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

  const handleUnifiedEventClick = async (event: UnifiedEvent) => {
    // Handle patient events
    if (event.patientId) {
      const patient = patients.find((p) => p.id === event.patientId);
      if (patient) {
        await navigateToPatient(patient);
      }
      return;
    }
    // Handle employee events
    const employee = dataset?.employees.find((emp) => emp.id === event.employeeId);
    if (employee) {
      await navigateToEmployee(employee);
    }
  };

  const handleCalendarEventClick = async (event: { employeeId?: number; patientId?: number }) => {
    // Handle patient events
    if (event.patientId) {
      const patient = patients.find((p) => p.id === event.patientId);
      if (patient) {
        await navigateToPatient(patient);
      }
      return;
    }
    // Handle employee events
    const employee = dataset?.employees.find((emp) => emp.id === event.employeeId);
    if (employee) {
      await navigateToEmployee(employee);
    }
  };

  if (authLoading || appReady.startupError || !appReady.configured || !appReady.unlocked) {
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
          footer={<AuthUpdates status={updateStatus} version={appInfo?.version} onCheck={handleCheckUpdates} onInstall={handleInstallUpdate} />}
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
        onNavigate={navigateToPage}
        updateStatus={updateStatus}
        onInstallUpdate={handleInstallUpdate}
        onSnoozeUpdate={handleSnoozeUpdate}
        snoozed={snoozeUpdates}
      />
      <div className="main">
        <header className="topbar">
          <div className="topbar-main">
            <div className="breadcrumbs">
              <button
                type="button"
                className="topbar-back-button"
                onClick={() => window.history.back()}
                disabled={!canGoBack}
                aria-label="Zurück"
                title="Zurück"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              {(page === 'patients' && selectedPatient ? [
                { label: 'Dashboard', page: 'dashboard' as const },
                { label: 'Patient:innen', page: 'patients' as const },
                { label: selectedPatient.name },
              ] : crumbs()).map((c, idx, arr) => (
                <span key={`${c.label}-${idx}`} className="crumb-item">
                  {c.page ? (
                    <button className="crumb-link" onClick={() => navigateToPage(c.page!)}>
                      {c.label}
                    </button>
                  ) : (
                    <span className="crumb-current">{c.label}</span>
                  )}
                  {idx < arr.length - 1 && <span className="crumb-sep">/</span>}
                </span>
              ))}
            </div>
            <h1>{page === 'patients' && selectedPatient ? selectedPatient.name : pageTitle[page]}</h1>
            <p className="subtitle">{page === 'patients' && selectedPatient ? (selectedPatient.diagnosis || 'Patient:in Details') : pageSubtitle[page]}</p>
          </div>
          {page !== 'settings' && page !== 'view' && page !== 'calendar' && !(page === 'patients' && selectedPatient) && (
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
            qualifications={qualifications}
            unifiedEvents={unifiedEvents}
            hiddenEventTypes={hiddenEventTypes}
            employeeDashboardStats={dashboardWidgets.employeeDashboardStats}
            onEventClick={handleUnifiedEventClick}
            onToggleEventFilter={toggleEventTypeFilter}
            onShowAllEvents={showAllEventTypes}
            onHideAllEvents={hideAllEventTypes}
          />
        )}

        {page === 'view' && selectedEmployee && (
          <EmployeeDetail
            employee={selectedEmployee}
            employeeCompetencies={employeeCompetencies}
            employeeInstructions={employeeInstructions}
            canAddCompetency={availableCompetencyDefinitions.length > 0}
            canAddInstruction={availableInstructionDefinitions.length > 0}
            suggestedCompetencyCount={suggestedCompetencyDefinitions.length}
            displayStart={displayStart}
            timelineItems={timelineItems}
            onAddCompetency={openNewEmployeeCompetencyModal}
            onAddInstruction={openNewEmployeeInstructionModal}
            onOpenSuggestedCompetencies={openSuggestedCompetencyModal}
            onOpenEditModal={openEditModal}
            onStartNewPeriod={openNewPeriodModal}
            onSelectCompetency={openEmployeeCompetencyModal}
            onSelectInstruction={openEmployeeInstructionModal}
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
            onCreate={openCreateModal}
            onSelect={navigateToEmployee}
            onDelete={confirmDeleteEmployee}
          />
        )}

        {page === 'settings' && (
          <SettingsPage
            qualifications={qualifications}
            competencies={competencyDefinitions}
            instructions={instructionDefinitions}
            qualificationEdits={qualificationEdits}
            competencyEdits={competencyEdits}
            dbMessage={dbMessage}
            baseHoursInput={baseHoursInput}
            updateStatus={updateStatus}
            lastUpdateCheckAt={lastUpdateCheckAt}
            appInfo={appInfo}
            storageMode={storageMode}
            encryptionSetup={encryptionSetup}
            onOpenQualificationModal={(payload) =>
              setQualificationModal({
                open: true,
                id: payload.id,
                value: payload.value,
                note: payload.note,
              })
            }
            onOpenCompetencyModal={(payload) =>
              setCompetencyModal({
                open: true,
                id: payload.id,
                code: payload.code,
                value: payload.value,
                category: payload.category,
                relevance: payload.relevance,
                note: payload.note,
              })
            }
            onOpenInstructionModal={(payload) =>
              setInstructionModal({
                open: true,
                id: payload.id,
                topic: payload.topic,
                legalBasis: payload.legalBasis,
                note: payload.note,
              })
            }
            onReorderQualification={reorderQualification}
            onReorderCompetency={reorderCompetencyDefinition}
            onReorderInstruction={reorderInstructionDefinition}
            onDeleteQualification={confirmDeleteQualification}
            onDeleteCompetency={confirmDeleteCompetencyDefinition}
            onDeleteInstruction={confirmDeleteInstructionDefinition}
            onBaseHoursInputChange={setBaseHoursInput}
            onSaveBaseHours={handleSaveBaseHoursValue}
            onDbExport={handleDbExport}
            onDbImport={handleDbImport}
            onOpenRecoveryKey={() => openRecoveryKey('settings')}
            onOpenEnableEncryption={openEnableEncryption}
            onCloseEnableEncryption={closeEnableEncryption}
            onEncryptionSetupChange={(next) => setEncryptionSetup((prev) => ({ ...prev, ...next }))}
            onEnableEncryption={handleEnableEncryption}
            onDisableEncryption={handleDisableEncryption}
            onCheckUpdates={handleCheckUpdates}
            onInstallUpdate={handleInstallUpdate}
            onDropDatabase={handleDropDatabase}
            onFullReset={handleFullReset}
          />
        )}

        {page === 'dev' && <DevPage />}

        {page === 'calendar' && (
          <CalendarPage
            currentDate={calendar.currentDate}
            view={calendar.view}
            eventsByDate={calendar.eventsByDate}
            periodLabel={calendar.periodLabel}
            loading={calendar.loading}
            onViewChange={calendarActions.setView}
            onPrev={calendarActions.prevPeriod}
            onNext={calendarActions.nextPeriod}
            onToday={calendarActions.goToToday}
            onMonthClick={calendarActions.goToMonth}
            onEventClick={handleCalendarEventClick}
          />
        )}

        {page === 'patients' && !selectedPatient && (
          <PatientList
            search={patientSearch}
            ratingFilter={patientRatingFilter}
            filteredPatients={filteredPatients}
            selectedId={patientModal.id}
            onSearchChange={setPatientSearch}
            onRatingChange={setPatientRatingFilter}
            onCreate={openCreatePatientModal}
            onSelect={navigateToPatient}
            onDelete={(id) => confirmDeletePatient(id)}
          />
        )}

        {page === 'patients' && selectedPatient && (
          <PatientDetail
            patient={selectedPatient}
            visits={patientVisits}
            onEdit={() => openEditPatientModal(selectedPatient)}
            onAddVisit={() => openVisitModal(selectedPatient.id!)}
            onSelectVisit={(visit) => openVisitModal(selectedPatient.id!, visit)}
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
        state={recoveryKeyModal}
        onClose={() => setRecoveryKeyModal((prev) => ({ ...prev, open: false, info: null }))}
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
      <QualificationModal
        state={qualificationModal}
        onChange={(next) => setQualificationModal((prev) => ({ ...prev, ...next }))}
        onClose={() => setQualificationModal({ open: false, value: '', note: '' })}
        onSave={handleSaveQualificationModal}
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
      />
      <InstructionModal
        state={instructionModal}
        onChange={(next) => setInstructionModal((prev) => ({ ...prev, ...next }))}
        onClose={() => setInstructionModal({ open: false, topic: '', legalBasis: '', note: '' })}
        onSave={handleSaveInstructionModal}
      />
      <EmployeeCompetencyModal
        state={employeeCompetencyModal}
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
          })
        }
        onSave={handleSaveEmployeeInstruction}
        onDelete={handleDeleteEmployeeInstruction}
      />
      <RecommendedCompetenciesModal
        state={suggestedCompetencyModal}
        definitions={suggestedCompetencyDefinitions}
        onToggle={toggleSuggestedCompetencySelection}
        onSelectAll={selectAllSuggestedCompetencies}
        onClose={() => setSuggestedCompetencyModal({ open: false, selectedDefinitionIds: [] })}
        onSave={handleAddRecommendedCompetencies}
      />
      {editModal.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <ModalHeader
              icon={isCreateMode ? faPlus : faPen}
              title={isCreateMode ? 'Teammitglied anlegen' : 'Teammitglied bearbeiten'}
              onClose={() => setEditModal((prev) => ({ ...prev, open: false }))}
            />
            <div className="modal-body">
              {isCreateMode && (
                <div className="form-grid">
                  <label>
                    Qualifikation
                    <select
                      value={form.qualification}
                      onChange={(e) => setForm((prev) => ({ ...prev, qualification: e.target.value }))}
                    >
                      {qualifications.map((q) => (
                        <option key={q.id ?? q.name} value={q.name}>
                          {q.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Start
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </label>
                  <label>
                    Ende
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </label>
                </div>
              )}
              <label className="full-width">
                Name*
                <input
                  value={editModal.name}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Vor- und Nachname"
                />
              </label>
              <div
                className="inline-row compact"
                style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'end' }}
              >
                <label className="grow">
                  Wochenstunden
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editModal.weeklyHours}
                    onChange={(e) => updateWeeklyHours(e.target.value)}
                    placeholder="z. B. 36"
                  />
                </label>
                <button
                  type="button"
                  className="ghost-button icon-button"
                  onClick={() => toggleLinked(!editModal.linked)}
                  title={
                    editModal.linked
                      ? 'Verknüpfung aktiv – VZÄ wird aus Wochenstunden berechnet'
                      : 'Verknüpfung aus – Felder manuell pflegen'
                  }
                >
                  <FontAwesomeIcon icon={editModal.linked ? faLink : faLinkSlash} />
                </button>
                <label className="grow">
                  <abbr className="help" title={fteHelp}>
                    FTE / VZÄ
                  </abbr>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={editModal.fteValue}
                    onChange={(e) => updateFteValue(e.target.value)}
                    disabled={editModal.linked}
                  />
                </label>
              </div>
              <label className="full-width">
                Geburtsdatum
                <BirthDateInput
                  value={editModal.birthDate}
                  onChange={(value) => setEditModal((prev) => ({ ...prev, birthDate: value }))}
                />
              </label>
              <label className="full-width">
                Notiz / Bemerkung
                <textarea
                  value={editModal.note}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Fortbildungen, Besonderheiten, Ansprechpartner"
                />
              </label>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-left" />
              <div className="modal-actions-right">
                <button className="ghost-button" onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}>
                  Abbrechen
                </button>
                <button className="primary" onClick={handleEditModalSave}>
                  {isCreateMode ? 'Anlegen' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {eventModal.open && selectedEmployee && (
        <div className="modal-backdrop">
          <div className="modal">
            <ModalHeader
              icon={faPlus}
              title={eventModal.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
              onClose={() => setEventModal((prev) => ({ ...prev, open: false }))}
            />
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
                  {eventModal.id && (
                    <option value="fte-change" disabled={eventModal.type !== 'fte-change'}>
                      VZÄ-Änderung
                    </option>
                  )}
                  {eventModal.id && (
                    <option
                      value="weekly-hours-change"
                      disabled={eventModal.type !== 'weekly-hours-change'}
                    >
                      Wochenstundenänderung
                    </option>
                  )}
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
                  {(eventModal.type === 'care-visit' || eventModal.type === 'emergency-training') && (
                    <label>
                      Gültig bis
                      <input
                        type="date"
                        value={eventModal.expiresAt ?? ''}
                        onChange={(e) => setEventModal({ ...eventModal, expiresAt: e.target.value || null })}
                      />
                    </label>
                  )}
                  <label className="full-width">
                    Details
                    <textarea
                      value={eventModal.details}
                      onChange={(e) => setEventModal({ ...eventModal, details: e.target.value })}
                      placeholder="Optionale Beschreibung oder Notiz zum Ereignis"
                    />
                  </label>
                  {(eventModal.type === 'name-change' ||
                    eventModal.type === 'fte-change' ||
                    eventModal.type === 'weekly-hours-change') && (
                    <>
                      <label>
                        Vorheriger Wert
                        <input
                          type="text"
                          value={eventModal.previousValue ?? ''}
                          onChange={(e) => setEventModal({ ...eventModal, previousValue: e.target.value })}
                          placeholder="Wert vor der Änderung"
                        />
                      </label>
                      <label>
                        Neuer Wert
                        <input
                          type="text"
                          value={eventModal.newValue ?? ''}
                          onChange={(e) => setEventModal({ ...eventModal, newValue: e.target.value })}
                          placeholder="Wert nach der Änderung"
                        />
                      </label>
                    </>
                  )}
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
              <div className="modal-actions-left">
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
              <div className="modal-actions-right">
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
      {patientModal.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <ModalHeader
              icon={faPlus}
              title={patientModal.mode === 'create' ? 'Neue:r Patient:in' : 'Patient:in bearbeiten'}
              onClose={closePatientModal}
            />
            <div className="modal-body">
              <label>
                Name*
                <input
                  value={patientModal.name}
                  onChange={(e) => setPatientModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Vor- und Nachname"
                />
              </label>
              <label className="full-width">
                Geburtsdatum
                <BirthDateInput
                  value={patientModal.birthDate}
                  onChange={(value) => setPatientModal((prev) => ({ ...prev, birthDate: value }))}
                />
              </label>
              <label className="full-width">
                Diagnose
                <input
                  value={patientModal.diagnosis}
                  onChange={(e) => setPatientModal((prev) => ({ ...prev, diagnosis: e.target.value }))}
                  placeholder="Hauptdiagnose oder Pflegegrund"
                />
              </label>
              <label className="full-width">
                Notiz / Bemerkung
                <textarea
                  value={patientModal.note}
                  onChange={(e) => setPatientModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Besonderheiten, Angehoerige, Kontakte"
                />
              </label>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-left" />
              <div className="modal-actions-right">
                <button className="ghost-button" onClick={closePatientModal}>
                  Abbrechen
                </button>
                <button className="primary" onClick={handleSavePatient}>
                  {patientModal.mode === 'create' ? 'Anlegen' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <VisitModal
        modal={patientVisitModal}
        onChange={setPatientVisitModal}
        onClose={closeVisitModal}
        onSave={handleSaveVisit}
        onDelete={confirmDeleteVisit}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
