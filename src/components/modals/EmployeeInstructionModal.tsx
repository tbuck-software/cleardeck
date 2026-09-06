import { localDate } from '../../utils/calendarDate';
import React from 'react';
import Dialog from '../ui/Dialog';
import { describeInterval, nextDueDate } from '../../utils/instructionSchedule';
import { formatDateDE } from '../../utils/dateFormat';
import type { InstructionDefinition } from '../../shared/types';
import type { EmployeeInstructionModalState } from '../../types/ui';

type EmployeeInstructionModalProps = {
  state: EmployeeInstructionModalState;
  employeeName: string;
  /** For the under-18 shortening from JArbSchG § 29 Abs. 2. */
  employeeBirthDate?: string | null;
  /** The assigned definition, so its interval can be shown and applied. */
  definition?: InstructionDefinition;
  availableDefinitions: InstructionDefinition[];
  onChange: (next: Partial<EmployeeInstructionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const EmployeeInstructionModal = ({
  state,
  employeeName,
  employeeBirthDate,
  definition,
  availableDefinitions,
  onChange,
  onClose,
  onSave,
  onDelete,
}: EmployeeInstructionModalProps) => {
  const isAssigned = Boolean(state.id);
  const interval = definition?.intervalMonths ?? null;
  const followUpDate =
    state.completedAt && (interval != null || definition?.minorHazardInstruction)
      ? nextDueDate(
          interval,
          employeeBirthDate,
          state.completedAt,
          definition?.minorHazardInstruction,
        )
      : null;
  const shortened =
    followUpDate != null && nextDueDate(interval, null, state.completedAt) !== followUpDate;

  return (
    <Dialog
      open={state.open}
      width={520}
      title={isAssigned ? state.instructionName : 'Einweisung hinzufügen'}
      subtitle={employeeName}
      help={[
        {
          title: 'Was gehört zum Nachweis?',
          body: 'Dieses Register ersetzt keine erforderliche Unterschrift. Inhalt, Zeitpunkt und unterschriebenen Beleg bzw. Zertifikat im angegebenen System aufbewahren.',
        },
      ]}
      primaryLabel="Speichern"
      onPrimary={onSave}
      deleteLabel={isAssigned ? 'Diesen Eintrag entfernen' : undefined}
      onDelete={isAssigned ? onDelete : undefined}
      onClose={onClose}
    >
      {!isAssigned && (
        <div className="field">
          <label htmlFor="employee-instruction">Einweisung</label>
          <select
            id="employee-instruction"
            className="input"
            value={state.instructionDefinitionId ?? ''}
            onChange={(event) => {
              const selectedId = Number(event.target.value);
              const definition = availableDefinitions.find((entry) => entry.id === selectedId);
              onChange({
                instructionDefinitionId: selectedId,
                instructionName: definition?.topic ?? '',
              });
            }}
          >
            {availableDefinitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.topic}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="instruction-due">Fällig bis</label>
          <input
            id="instruction-due"
            className="input"
            type="date"
            value={state.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="instruction-completed">Durchgeführt am</label>
          <input
            id="instruction-completed"
            className="input"
            type="date"
            max={localDate()}
            value={state.completedAt}
            onChange={(event) => onChange({ completedAt: event.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="instruction-by">Durchgeführt durch</label>
        <input
          id="instruction-by"
          className="input"
          placeholder="Name"
          value={state.conductedBy}
          onChange={(event) => onChange({ conductedBy: event.target.value })}
        />
      </div>

      {interval != null || definition?.minorHazardInstruction ? (
        <>
          <label className="radio">
            <input
              type="checkbox"
              checked={state.scheduleFollowUp}
              onChange={(event) => onChange({ scheduleFollowUp: event.target.checked })}
            />
            <span className="dot" style={{ borderRadius: 5 }} />
            <span>
              Nach Abschluss wieder fällig{' '}
              <span className="cd-muted">
                — {describeInterval(interval, definition?.intervalSource)}
              </span>
            </span>
          </label>
          {state.scheduleFollowUp && followUpDate && (
            <p className="cd-muted-13" style={{ margin: 0 }}>
              Nächster Termin: {formatDateDE(followUpDate)}
              {shortened && ' — verkürzt, weil die Person noch nicht 18 ist (JArbSchG § 29 Abs. 2)'}
            </p>
          )}
        </>
      ) : (
        <p className="cd-muted-13" style={{ margin: 0 }}>
          Für diese Einweisung ist kein Intervall hinterlegt — sie wird nicht automatisch wieder
          fällig.
        </p>
      )}

      <div className="field">
        <label htmlFor="instruction-content">Inhalte</label>
        <textarea
          id="instruction-content"
          className="input"
          value={state.content ?? ''}
          onChange={(event) => onChange({ content: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="instruction-evidence">Nachweis</label>
        <input
          id="instruction-evidence"
          className="input"
          value={state.evidenceRef ?? ''}
          onChange={(event) => onChange({ evidenceRef: event.target.value })}
        />
      </div>
      {state.scheduleReviewRequired && (
        <label>
          <input type="checkbox" onChange={() => onChange({ scheduleReviewRequired: false })} />{' '}
          Bisherige Wiedervorlage geprüft; pauschale Minderjährigenregel trifft auf dieses Thema
          nicht zu.
        </label>
      )}
      <div className="field">
        <label htmlFor="instruction-entry-note">Notiz</label>
        <textarea
          id="instruction-entry-note"
          className="input"
          style={{ minHeight: 70 }}
          value={state.note}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </div>
    </Dialog>
  );
};

export default EmployeeInstructionModal;
