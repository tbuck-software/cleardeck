import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { QprRating } from '../../shared/types';
import type { VisitModalState } from '../../types/ui';

type VisitModalProps = {
  modal: VisitModalState;
  onChange: (next: VisitModalState) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: number, patientId: number) => void;
};

const VisitModal = ({ modal, onChange, onClose, onSave, onDelete }: VisitModalProps) => {
  if (!modal.open) return null;

  const handleSave = () => {
    onSave();
  };

  const handleDelete = () => {
    if (modal.id && onDelete) {
      onDelete(modal.id, modal.patientId);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">
            <FontAwesomeIcon icon={faCalendarCheck} />
          </div>
          <h3>{modal.id ? 'Visite bearbeiten' : 'Neue Visite'}</h3>
        </div>

        <div className="modal-body">
          <label>
            Datum*
            <input
              type="date"
              value={modal.visitDate}
              onChange={(e) => onChange({ ...modal, visitDate: e.target.value })}
            />
          </label>

          <label>
            QPR-Bewertung (QPR 2026)*
            <select
              value={modal.qprRating}
              onChange={(e) => onChange({ ...modal, qprRating: e.target.value as QprRating })}
            >
              <option value="A">A - Keine Auffaelligkeiten</option>
              <option value="B">B - Auffaelligkeiten ohne Risiko negativer Folgen</option>
              <option value="C">C - Defizite mit Risiko negativer Folgen</option>
              <option value="D">D - Defizite mit eingetretenen negativen Folgen</option>
            </select>
          </label>

          <label className="full-width">
            Kommentar / Begruendung
            <textarea
              value={modal.comment}
              onChange={(e) => onChange({ ...modal, comment: e.target.value })}
              placeholder="Begruendung fuer die Bewertung, Beobachtungen..."
              rows={3}
            />
          </label>
        </div>

        <div className="modal-footer">
          <div>
            {modal.id && onDelete && (
              <button
                className="ghost-button danger icon-button"
                onClick={handleDelete}
                title="Visite loeschen"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </div>
          <div className="modal-actions">
            <button className="ghost-button" onClick={onClose}>
              Abbrechen
            </button>
            <button className="primary" onClick={handleSave}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitModal;
