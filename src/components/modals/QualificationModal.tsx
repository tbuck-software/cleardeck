import React from 'react';
import Dialog from '../ui/Dialog';
import type { QualificationModalState } from '../../types/ui';

type QualificationModalProps = {
  state: QualificationModalState;
  onChange: (next: Partial<QualificationModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: number) => void;
};

const QualificationModal = ({ state, onChange, onClose, onSave, onDelete }: QualificationModalProps) => (
  <Dialog
    open={state.open}
    width={480}
    title={state.id ? 'Qualifikation bearbeiten' : 'Neue Qualifikation'}
    subtitle="Änderungen gelten sofort für alle Zuordnungen."
    primaryLabel="Speichern"
    primaryDisabled={!state.value.trim()}
    onPrimary={onSave}
    deleteLabel={state.id && onDelete ? 'Löschen' : undefined}
    onDelete={state.id && onDelete ? () => onDelete(state.id as number) : undefined}
    onClose={onClose}
  >
    <div className="field">
      <label htmlFor="qualification-name">Bezeichnung</label>
      <input
        id="qualification-name"
        className="input"
        placeholder="z. B. 3-jährig examiniert"
        value={state.value}
        onChange={(event) => onChange({ value: event.target.value })}
      />
    </div>
    <div className="field">
      <label htmlFor="qualification-note">Notiz</label>
      <textarea
        id="qualification-note"
        className="input"
        style={{ minHeight: 70 }}
        placeholder="Wofür gilt das, was ist zu beachten?"
        value={state.note}
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </div>
  </Dialog>
);

export default QualificationModal;
