import React from 'react';
import { faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import type { CompetencyDefinition } from '../../shared/types';
import type { EmployeeCompetencyModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';
import CompetencyLevelPicker from '../ui/CompetencyLevelPicker';

type EmployeeCompetencyModalProps = {
  state: EmployeeCompetencyModalState;
  availableDefinitions: CompetencyDefinition[];
  onChange: (next: Partial<EmployeeCompetencyModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const EmployeeCompetencyModal = ({
  state,
  availableDefinitions,
  onChange,
  onClose,
  onSave,
  onDelete,
}: EmployeeCompetencyModalProps) => {
  if (!state.open) return null;
  const isAssigned = Boolean(state.id);
  const selectedValue = state.level ?? 0;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <ModalHeader
          icon={faClipboardCheck}
          title={isAssigned ? state.competencyName : 'Kompetenz hinzufügen'}
          onClose={onClose}
        />
        <div className="modal-body">
          {!isAssigned && (
            <label className="full-width">
              Kompetenz
              <select
                value={state.competencyDefinitionId ?? ''}
                onChange={(e) => {
                  const selectedId = Number(e.target.value);
                  const selectedDefinition = availableDefinitions.find(
                    (definition) => definition.id === selectedId,
                  );
                  onChange({
                    competencyDefinitionId: selectedId,
                    competencyName: selectedDefinition?.name ?? '',
                  });
                }}
              >
                {availableDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="full-width">
            Kompetenzstufe
            <CompetencyLevelPicker
              value={selectedValue}
              onChange={(level) => onChange({ level })}
            />
          </label>
          <div className="form-grid">
            <label>
              Freigegeben am
              <input
                type="date"
                value={state.approvedAt}
                onChange={(e) => onChange({ approvedAt: e.target.value })}
              />
            </label>
            <label>
              Freigegeben durch
              <input
                value={state.approvedBy}
                onChange={(e) => onChange({ approvedBy: e.target.value })}
                placeholder="z. B. Praxisanleitung"
              />
            </label>
          </div>
          <label className="full-width">
            Notiz
            <textarea
              value={state.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Optional: Beobachtungen, Freigabehinweis, Besonderheiten"
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

export default EmployeeCompetencyModal;
