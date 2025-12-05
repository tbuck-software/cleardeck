import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faTriangleExclamation, faLink, faLinkSlash } from '@fortawesome/free-solid-svg-icons';
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
import ConfirmModal from './components/modals/ConfirmModal';
import RecoveryKeyModal from './components/modals/RecoveryKeyModal';
import RecoveryResetModal from './components/modals/RecoveryResetModal';
import QualificationModal from './components/modals/QualificationModal';
import useAppLogic from './hooks/useAppLogic';
import type { EventModalType } from './types/ui';

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
      handleDeletePeriod,
      openNewPeriodModal,
      openExistingPeriodModal,
      openEventModalForEvent,
      openEditModal,
      handleEditModalSave,
      resetForm,
    },
  } = useAppLogic();

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
                <input value={editModal.name} onChange={(e) => setEditModal({ ...editModal, name: e.target.value })} />
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
                  onClick={() => setEditModal({ open: false, name: '', note: '', weeklyHours: '', linked: true, fteValue: '' })}
                >
                  Abbrechen
                </button>
                <button className="primary" onClick={handleEditModalSave}>
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
