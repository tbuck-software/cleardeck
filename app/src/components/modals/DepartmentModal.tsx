import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { DepartmentModalState } from '../../types/ui';

type DepartmentModalProps = {
  state: DepartmentModalState;
  onChange: (next: Partial<DepartmentModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const DepartmentModal = ({ state, onChange, onClose, onSave }: DepartmentModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon">
          <FontAwesomeIcon icon={state.id ? faPen : faPlus} />
        </div>
        <h3>{state.id ? 'Abteilung bearbeiten' : 'Neue Abteilung'}</h3>
        <div className="form-grid">
          <label className="full-width">
            Bezeichnung
            <input
              value={state.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="z. B. IT, Pflege, Verwaltung"
            />
          </label>
          <label className="full-width">
            Notiz
            <textarea
              value={state.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Optional: Besonderheiten, Kostenstelle, Ansprechpartner"
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

export default DepartmentModal;
