import React from 'react';
import Dialog from '../ui/Dialog';
import type { VisitModalState } from '../../types/ui';

type VisitModalProps = {
  modal: VisitModalState;
  patientName: string;
  onChange: (next: VisitModalState) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: number, patientId: number) => void;
};

const VisitModal = ({ modal, patientName, onChange, onClose, onSave, onDelete }: VisitModalProps) => (
  <Dialog
    open={modal.open}
    width={540}
    title={modal.id ? 'Pflegevisite bearbeiten' : 'Neue Pflegevisite'}
    subtitle={`${patientName} · interne Qualitätssicherung`}
    primaryLabel="Speichern"
    onPrimary={onSave}
    deleteLabel={modal.id && onDelete ? 'Löschen' : undefined}
    onDelete={modal.id && onDelete ? () => onDelete(modal.id as number, modal.patientId) : undefined}
    onClose={onClose}
  >
    <div className="cd-field-grid">
      <div className="field">
        <label htmlFor="visit-date">Datum</label>
        <input
          id="visit-date"
          className="input"
          type="date"
          value={modal.visitDate}
          onChange={(event) => onChange({ ...modal, visitDate: event.target.value })}
        />
      </div>
    </div>

    <div className="field">
      <label htmlFor="visit-comment">Beobachtungen</label>
      <textarea
        id="visit-comment"
        className="input"
        placeholder="Was wurde beobachtet, welche Maßnahme folgt?"
        value={modal.comment}
        onChange={(event) => onChange({ ...modal, comment: event.target.value })}
      />
    </div>

    <label className="radio">
      <input
        type="checkbox"
        checked={modal.actionNeeded}
        onChange={(event) => onChange({ ...modal, actionNeeded: event.target.checked })}
      />
      <span className="dot" style={{ borderRadius: 5 }} />
      <span>
        <strong>Handlungsbedarf</strong>{' '}
        <span className="cd-muted">— erscheint in „Heute zu tun“ bis zur Folgevisite</span>
      </span>
    </label>
  </Dialog>
);

export default VisitModal;
