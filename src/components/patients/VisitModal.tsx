import React from 'react';
import { localDate } from '../../utils/calendarDate';
import Checkbox from '../ui/Checkbox';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
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
    help={[
      {
        title: 'Geplant oder durchgeführt?',
        body: 'Geplante Termine zählen erst nach ausdrücklicher Bestätigung als durchgeführte Visite.',
      },
      {
        title: 'Handlungsbedarf',
        body: 'Eine Visite mit Handlungsbedarf bleibt bis zum Erledigt-Datum offen. Erledigte Maßnahme und gegebenenfalls Nachkontrolle in den Beobachtungen erläutern.',
      },
    ]}
    primaryLabel="Speichern"
    onPrimary={onSave}
    deleteLabel={modal.id && onDelete ? 'Löschen' : undefined}
    onDelete={
      modal.id && onDelete ? () => onDelete(modal.id as number, modal.patientId) : undefined
    }
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
      <div className="field">
        <label>Status</label>
        <Segmented
          fill
          ariaLabel="Status"
          options={[
            { value: 'planned' as const, label: 'Geplant' },
            { value: 'completed' as const, label: 'Durchgeführt' },
          ]}
          value={modal.status ?? (modal.visitDate > localDate() ? 'planned' : 'completed')}
          onChange={(status) => onChange({ ...modal, status })}
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

    <div className="cd-toggle-group">
      <Checkbox
        checked={modal.actionNeeded}
        onChange={(event) => onChange({ ...modal, actionNeeded: event.target.checked })}
      >
        <strong>Handlungsbedarf</strong> <span className="cd-muted">bis zur Erledigung offen</span>
      </Checkbox>

      {modal.actionNeeded && (
        <div className="cd-field-grid cd-toggle-fields">
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
          </label>
        </div>
      )}
    </div>
  </Dialog>
);

export default VisitModal;
