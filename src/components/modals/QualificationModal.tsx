import React from 'react';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { QualificationModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';

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
        <ModalHeader
          icon={state.id ? faPen : faPlus}
          title={state.id ? 'Qualifikation bearbeiten' : 'Neue Qualifikation'}
          onClose={onClose}
        />
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
          <div className="modal-actions-left" />
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

export default QualificationModal;
