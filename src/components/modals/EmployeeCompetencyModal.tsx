import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import type { EmployeeCompetencyModalState } from '../../types/ui';

type EmployeeCompetencyModalProps = {
  state: EmployeeCompetencyModalState;
  onChange: (next: Partial<EmployeeCompetencyModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const EmployeeCompetencyModal = ({
  state,
  onChange,
  onClose,
  onSave,
}: EmployeeCompetencyModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon">
          <FontAwesomeIcon icon={faClipboardCheck} />
        </div>
        <h3>{state.competencyName}</h3>
        <div className="modal-body">
          <label className="full-width">
            Status
            <select
              value={state.status}
              onChange={(e) => onChange({ status: e.target.value as EmployeeCompetencyModalState['status'] })}
            >
              <option value="open">Offen</option>
              <option value="in-progress">In Bearbeitung</option>
              <option value="completed">Abgeschlossen</option>
              <option value="not-applicable">Nicht relevant</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              Gestartet am
              <input
                type="date"
                value={state.startedAt}
                onChange={(e) => onChange({ startedAt: e.target.value })}
              />
            </label>
            <label>
              Abgeschlossen am
              <input
                type="date"
                value={state.completedAt}
                onChange={(e) => onChange({ completedAt: e.target.value })}
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

export default EmployeeCompetencyModal;
