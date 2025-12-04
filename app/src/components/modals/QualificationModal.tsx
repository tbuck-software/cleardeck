import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';

export type QualificationModalState = {
  open: boolean;
  id?: number;
  value: string;
  note: string;
};

type QualificationModalProps = {
  state: QualificationModalState;
  onChange: (next: Partial<QualificationModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const QualificationModal = ({ state, onChange, onClose, onSave }: QualificationModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon">
          <FontAwesomeIcon icon={state.id ? faPen : faPlus} />
        </div>
        <h3>{state.id ? 'Qualifikation bearbeiten' : 'Neue Qualifikation'}</h3>
        <div className="form-grid">
          <label className="full-width">
            Bezeichnung
            <input
              value={state.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="z. B. 3-jährig examiniert"
            />
          </label>
          <label className="full-width">
            Notiz
            <textarea
              value={state.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Optional: Besonderheiten, Zertifizierungen, Einsatzbereiche"
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

export default QualificationModal;
