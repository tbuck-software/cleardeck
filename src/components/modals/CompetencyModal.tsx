import React from 'react';
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { CompetencyModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';

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
        <ModalHeader
          icon={state.id ? faPen : faPlus}
          title={state.id ? 'Kompetenz bearbeiten' : 'Neue Kompetenz'}
          onClose={onClose}
        />
        <div className="form-grid">
          <label>
            Kürzel
            <input
              value={state.code}
              onChange={(e) => onChange({ code: e.target.value })}
              placeholder="z. B. P01"
            />
          </label>
          <label>
            Kategorie
            <select
              value={state.category}
              onChange={(e) => onChange({ category: e.target.value })}
            >
              <option value="Allgemein">Allgemein</option>
              <option value="SGB XI">SGB XI</option>
              <option value="SGB V">SGB V</option>
            </select>
          </label>
          <label className="full-width">
            Relevanz
            <select
              value={state.relevance}
              onChange={(e) => onChange({ relevance: e.target.value })}
            >
              <option value="Alle">Alle</option>
              <option value="Nur PFK">Nur PFK</option>
              <option value="Nur PHK">Nur PHK</option>
              <option value="Azubi">Azubi</option>
              <option value="Praxisanleitung">Praxisanleitung</option>
              <option value="QMB">QMB</option>
            </select>
          </label>
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

export default CompetencyModal;
