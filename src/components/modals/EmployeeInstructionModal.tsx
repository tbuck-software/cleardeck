import React from 'react';
import { faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import type { InstructionDefinition } from '../../shared/types';
import type { EmployeeInstructionModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';

type EmployeeInstructionModalProps = {
  state: EmployeeInstructionModalState;
  availableDefinitions: InstructionDefinition[];
  onChange: (next: Partial<EmployeeInstructionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const EmployeeInstructionModal = ({
  state,
  availableDefinitions,
  onChange,
  onClose,
  onSave,
  onDelete,
}: EmployeeInstructionModalProps) => {
  if (!state.open) return null;
  const isAssigned = Boolean(state.id);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <ModalHeader
          icon={faClipboardCheck}
          title={isAssigned ? state.instructionName : 'Einweisung hinzufügen'}
          onClose={onClose}
        />
        <div className="modal-body">
          {!isAssigned && (
            <label className="full-width">
              Einweisung
              <select
                value={state.instructionDefinitionId ?? ''}
                onChange={(e) => {
                  const selectedId = Number(e.target.value);
                  const selectedDefinition = availableDefinitions.find(
                    (definition) => definition.id === selectedId,
                  );
                  onChange({
                    instructionDefinitionId: selectedId,
                    instructionName: selectedDefinition?.topic ?? '',
                  });
                }}
              >
                {availableDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.topic}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            <label>
              Fällig bis
              <input
                type="date"
                value={state.dueDate}
                onChange={(e) => onChange({ dueDate: e.target.value })}
              />
            </label>
            <label>
              Durchgeführt am
              <input
                type="date"
                value={state.completedAt}
                onChange={(e) => onChange({ completedAt: e.target.value })}
              />
            </label>
          </div>
          <label className="full-width">
            Durchgeführt durch
            <input
              value={state.conductedBy}
              onChange={(e) => onChange({ conductedBy: e.target.value })}
              placeholder="z. B. Praxisanleitung oder PDL"
            />
          </label>
          <label className="full-width">
            Notiz
            <textarea
              value={state.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Optional: Besonderheiten oder Nachweis"
            />
          </label>
        </div>
        <div className="modal-actions">
          <div className="modal-actions-left">
            {isAssigned && (
              <button className="ghost-button danger" onClick={onDelete}>
                Entfernen
              </button>
            )}
          </div>
          <div className="modal-actions-right">
            <button className="ghost-button" onClick={onClose}>
              Abbrechen
            </button>
            <button className="primary" onClick={onSave}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeInstructionModal;
