import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faLink, faLinkSlash, faPen } from '@fortawesome/free-solid-svg-icons';
import { createRoot } from 'react-dom/client';
import './index.css';
import AuthScreen from './components/auth/AuthScreen';
import Sidebar from './components/layout/Sidebar';
import YearSelector from './components/ui/YearSelector';
import Dashboard from './components/pages/Dashboard';
import EmployeeList from './components/pages/EmployeeList';
import EmployeeForm from './components/pages/EmployeeForm';
import EmployeeDetail from './components/pages/EmployeeDetail';
import SettingsPage from './components/pages/SettingsPage';
import DevPage from './components/pages/DevPage';
import CalendarPage from './components/pages/CalendarPage';
import ConfirmModal from './components/modals/ConfirmModal';
import RecoveryKeyModal from './components/modals/RecoveryKeyModal';
import RecoveryResetModal from './components/modals/RecoveryResetModal';
import QualificationModal from './components/modals/QualificationModal';
import { deriveFteFromWeeklyHours, deriveWeeklyHoursFromFte } from './utils/fte';
import { unifyEvents } from './utils/unifyEvents';
import useAppLogic from './hooks/useAppLogic';
import type { EventModalType } from './types/ui';
import type { UnifiedEvent } from './shared/types';

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
      form,
      periods,
      selectedEmployee,
      appReady,
      page,
      loading,
      toast,
      error,
      updateStatus,
      dbMessage,
      snoozeUpdates,
      appInfo,
      search,
      statusFilter,
      qualificationFilter,
      addNewPeriod,
      qualificationEdits,
      qualificationModal,
      editModal,
      addPeriodForm,
      eventModal,
      confirmState,
      recoveryKeyModal,
      recoveryReset,
      upcomingEvents,
      hiddenEventTypes,
      calendar,
      dashboardWidgets,
    },
    setters: {
      setYear,
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
    derived: { filteredEmployees, averageFte, totalFte, totalHeadcount, displayStart, timelineItems, crumbs, sidebarPage },
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
    },
  } = useAppLogic();

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

  const unifiedEvents = useMemo(
    () =>
      unifyEvents(
        upcomingEvents,
        dashboardWidgets.expiringTrainings,
        dashboardWidgets.birthdaysAnniversaries,
        hiddenEventTypes,
      ),
    [upcomingEvents, dashboardWidgets.expiringTrainings, dashboardWidgets.birthdaysAnniversaries, hiddenEventTypes],
  );

  const handleUnifiedEventClick = async (event: UnifiedEvent) => {
    const employee = dataset?.employees.find((emp) => emp.id === event.employeeId);
    if (employee) {
      await handleSelect(employee);
    }
  };

  const handleCalendarEventClick = async (event: { employeeId?: number }) => {
    const employee = dataset?.employees.find((emp) => emp.id === event.employeeId);
    if (employee) {
      await handleSelect(employee);
    }
  };

  if (!appReady.configured || !appReady.unlocked) {
    const authMode: 'setup' | 'login' = appReady.configured ? 'login' : 'setup';
    return (
      <>
        <AuthScreen
          mode={authMode}
          onSubmit={(pwd) => handleLogin(pwd, authMode)}
          busy={loading}
          message={authMode === 'setup' ? 'Neues Passwort legt auch den lokalen Schlüssel an.' : undefined}
          onForgotPassword={appReady.configured ? startRecoveryReset : undefined}
          globalError={error}
        />
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
            <h1>{pageTitle[page]}</h1>
            <p className="subtitle">{pageSubtitle[page]}</p>
          </div>
          {page !== 'settings' && page !== 'view' && page !== 'calendar' && (
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
            onEventClick={handleUnifiedEventClick}
            onToggleEventFilter={toggleEventTypeFilter}
            onShowAllEvents={showAllEventTypes}
            onHideAllEvents={hideAllEventTypes}
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
            onCreate={openCreateModal}
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
            appInfo={appInfo}
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
      {editModal.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={isCreateMode ? faPlus : faPen} />
            </div>
            <h3>{isCreateMode ? 'Teammitglied anlegen' : 'Teammitglied bearbeiten'}</h3>
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
              <label>
                Geburtsdatum
                <input
                  type="date"
                  value={editModal.birthDate}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, birthDate: e.target.value }))}
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
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="inline-row compact">
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
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
