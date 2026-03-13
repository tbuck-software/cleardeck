import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { CompetencyModalState } from '../../types/ui';

type CompetencyModalProps = {
  state: CompetencyModalState;
  onChange: (next: Partial<CompetencyModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const CompetencyModal = ({ state, onChange, onClose, onSave }: CompetencyModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon">
          <FontAwesomeIcon icon={state.id ? faPen : faPlus} />
        </div>
        <h3>{state.id ? 'Kompetenz bearbeiten' : 'Neue Kompetenz'}</h3>
        <div className="form-grid">
          <label className="full-width">
            Bezeichnung
            <input
              value={state.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="z. B. Einarbeitung"
            />
          </label>
          <label className="full-width">
            Notiz
            <textarea
              value={state.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Optional: fachlicher Hinweis oder Einsatzkontext"
            />
          </label>
        </div>
        <div className="modal-actions">
          <div></div>
          <div className="inline-row compact">
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

export default CompetencyModal;
