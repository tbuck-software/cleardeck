import React from 'react';
import Dialog from '../ui/Dialog';
import Icon from '../ui/Icon';
import BirthDateInput from '../ui/BirthDateInput';
import type { QualificationType } from '../../shared/types';
import type { EditModalState, FormState } from '../../types/ui';
import { formatDateDE } from '../../utils/dateFormat';

type EmployeeModalProps = {
  state: EditModalState;
  form: FormState;
  qualifications: QualificationType[];
  fteHelp: string;
  onStateChange: (next: Partial<EditModalState>) => void;
  onFormChange: (next: Partial<FormState>) => void;
  onWeeklyHoursChange: (value: string) => void;
  onFteChange: (value: string) => void;
  onToggleLinked: (linked: boolean) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const EmployeeModal = ({
  state,
  form,
  qualifications,
  fteHelp,
  onStateChange,
  onFormChange,
  onWeeklyHoursChange,
  onFteChange,
  onToggleLinked,
  onClose,
  onSave,
  onDelete,
}: EmployeeModalProps) => {
  const isCreate = state.mode === 'create';
  // The save replaces a term only when the date matches the one already on record.
  const replacesExistingTerm =
    Boolean(state.existingHoursEffectiveFrom) &&
    state.hoursEffectiveFrom === state.existingHoursEffectiveFrom;

  return (
    <Dialog
      open={state.open}
      width={560}
      title={isCreate ? 'Person anlegen' : 'Person bearbeiten'}
      help={[
        {
          title: 'Wie werden VZÄ berechnet?',
          body: `Betriebliche VZÄ-Regel: ab 36 Wochenstunden 1,0; darunter Anteil am eingestellten Bezugswert. ${fteHelp}`,
        },
        ...(isCreate
          ? []
          : [
              {
                title: 'Was gilt für frühere Zeiträume?',
                body: 'Arbeitszeiten gelten bis zur nächsten Änderung. Den Beschäftigungsbeginn unter Historie korrigieren.',
              },
            ]),
      ]}
      primaryLabel={isCreate ? 'Anlegen' : 'Speichern'}
      primaryDisabled={!state.name.trim()}
      onPrimary={onSave}
      deleteLabel={!isCreate && onDelete ? 'Löschen' : undefined}
      onDelete={onDelete}
      onClose={onClose}
    >
      <div className="cd-field-grid">
        <div className="field cd-field-wide">
          <label htmlFor="employee-name">Name</label>
          <input
            id="employee-name"
            className="input"
            placeholder="Vor- und Nachname"
            value={state.name}
            onChange={(event) => onStateChange({ name: event.target.value })}
          />
        </div>

        {isCreate && (
          <>
            <div className="field">
              <label htmlFor="employee-qualification">Qualifikation</label>
              <select
                id="employee-qualification"
                className="input"
                value={form.qualification}
                onChange={(event) => onFormChange({ qualification: event.target.value })}
              >
                {qualifications.map((qualification) => (
                  <option key={qualification.id ?? qualification.name} value={qualification.name}>
                    {qualification.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="employee-start">Eintritt</label>
              <input
                id="employee-start"
                className="input"
                type="date"
                value={form.startDate}
                onChange={(event) => onFormChange({ startDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="employee-end">Austritt</label>
              <input
                id="employee-end"
                className="input"
                type="date"
                value={form.endDate}
                onChange={(event) => onFormChange({ endDate: event.target.value })}
              />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="employee-birthdate">Geburtsdatum</label>
          <BirthDateInput
            id="employee-birthdate"
            value={state.birthDate}
            onChange={(birthDate) => onStateChange({ birthDate })}
          />
        </div>
      </div>

      <div className="cd-linked-row">
        <div className="field">
          <label htmlFor="employee-hours">Wochenstunden</label>
          <input
            id="employee-hours"
            className="input"
            type="number"
            min="0"
            step="0.1"
            placeholder="z. B. 36"
            value={state.weeklyHours}
            onChange={(event) => onWeeklyHoursChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          aria-pressed={state.linked}
          onClick={() => onToggleLinked(!state.linked)}
          title={
            state.linked
              ? 'Verknüpfung aktiv — VZÄ wird aus den Wochenstunden berechnet'
              : 'Verknüpfung aus — beide Felder manuell pflegen'
          }
        >
          <Icon name={state.linked ? 'link' : 'linkOff'} size={16} />
        </button>
        <div className="field">
          <label htmlFor="employee-fte" title={fteHelp}>
            VZÄ
          </label>
          <input
            id="employee-fte"
            className="input"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={state.fteValue}
            disabled={state.linked}
            onChange={(event) => onFteChange(event.target.value)}
          />
        </div>
      </div>

      {!isCreate && (
        <div className="cd-field-grid">
          <div className="field">
            <label htmlFor="hours-effective">Stunden / VZÄ gültig ab</label>
            <input
              id="hours-effective"
              className="input"
              type="date"
              min={form.startDate}
              max={form.endDate || undefined}
              value={state.hoursEffectiveFrom ?? ''}
              onChange={(event) => onStateChange({ hoursEffectiveFrom: event.target.value })}
              aria-describedby="hours-effective-hint"
            />
            {state.hoursEffectiveFrom && (
              <p id="hours-effective-hint" className="cd-muted-13">
                {replacesExistingTerm
                  ? `Ersetzt den Stand vom ${formatDateDE(state.existingHoursEffectiveFrom)}.`
                  : 'Neuer Stand ab diesem Datum. Frühere Stände bleiben in der Historie.'}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="employee-note">Notiz</label>
        <textarea
          id="employee-note"
          className="input"
          style={{ minHeight: 70 }}
          value={state.note}
          onChange={(event) => onStateChange({ note: event.target.value })}
        />
      </div>
    </Dialog>
  );
};

export default EmployeeModal;
