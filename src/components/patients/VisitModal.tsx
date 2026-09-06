import FieldHelp from '../ui/FieldHelp';
import React from 'react';
import { localDate } from '../../utils/calendarDate';
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

const VisitModal = ({
  modal,
  patientName,
  onChange,
  onClose,
  onSave,
  onDelete,
}: VisitModalProps) => (
  <Dialog
    open={modal.open}
    width={540}
    title={modal.id ? 'Pflegevisite bearbeiten' : 'Neue Pflegevisite'}
    subtitle={`${patientName} · interne Qualitätssicherung`}
    primaryLabel="Speichern"
    onPrimary={onSave}
    deleteLabel={modal.id && onDelete ? 'Löschen' : undefined}
    onDelete={
      modal.id && onDelete ? () => onDelete(modal.id as number, modal.patientId) : undefined
    }
    onClose={onClose}
  >
    <div className="cd-field-grid">
      <label className="cd-form-label">
        Status
        <select
          className="input"
          value={modal.status ?? (modal.visitDate > localDate() ? 'planned' : 'completed')}
          onChange={(e) =>
            onChange({ ...modal, status: e.target.value as 'planned' | 'completed' })
          }
        >
          <option value="planned">Geplant</option>
          <option value="completed">Durchgeführt</option>
        </select>
      </label>
      <FieldHelp title="Geplant oder durchgeführt?">
        Geplante Termine zählen erst nach ausdrücklicher Bestätigung als durchgeführte Visite.
      </FieldHelp>
      {modal.actionNeeded && (
        <div className="cd-field-grid cd-field-wide">
          <label className="cd-form-label">
            Zuständige Person
            <input
              className="input"
              value={modal.assignedTo ?? ''}
              onChange={(e) => onChange({ ...modal, assignedTo: e.target.value })}
            />
          </label>
          <label className="cd-form-label">
            Maßnahme fällig am
            <input
              className="input"
              type="date"
              value={modal.actionDueDate ?? ''}
              onChange={(e) => onChange({ ...modal, actionDueDate: e.target.value || null })}
            />
          </label>
        </div>
      )}
      {modal.actionNeeded && (
        <label className="cd-form-label">
          Erledigt am
          <input
            className="input"
            type="date"
            min={modal.visitDate}
            max={localDate()}
            value={modal.resolvedAt ?? ''}
            onChange={(e) => onChange({ ...modal, resolvedAt: e.target.value || null })}
          />
          <span className="cd-muted-13">
            Erledigte Maßnahme und gegebenenfalls Nachkontrolle in den Beobachtungen erläutern.
          </span>
        </label>
      )}
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
        <strong>Handlungsbedarf</strong> <span className="cd-muted">bis zur Erledigung offen</span>
      </span>
    </label>
  </Dialog>
);

export default VisitModal;
