import React from 'react';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { InstructionModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';

type InstructionModalProps = {
  state: InstructionModalState;
  onChange: (next: Partial<InstructionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const InstructionModal = ({ state, onChange, onClose, onSave }: InstructionModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <ModalHeader
          icon={state.id ? faPen : faPlus}
          title={state.id ? 'Einweisung bearbeiten' : 'Neue Einweisung'}
          onClose={onClose}
        />
        <div className="form-grid">
          <label className="full-width">
            Thema
            <input
              value={state.topic}
              onChange={(e) => onChange({ topic: e.target.value })}
              placeholder="z. B. Hygieneunterweisung"
            />
          </label>
          <label className="full-width">
            Gesetzliche Grundlage
            <input
              value={state.legalBasis}
              onChange={(e) => onChange({ legalBasis: e.target.value })}
              placeholder="z. B. ArbSchG § 12"
            />
          </label>
          <label className="full-width">
            Notiz
            <textarea
              value={state.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Optional: interne Hinweise oder Turnus"
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

export default InstructionModal;
