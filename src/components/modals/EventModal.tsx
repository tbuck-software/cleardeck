import React from 'react';
import Dialog from '../ui/Dialog';
import type { QualificationType } from '../../shared/types';
import type { AddPeriodFormState, EventModalState, EventModalType } from '../../types/ui';

/** Change events are written by the app itself; they stay selectable only while editing one. */
const DERIVED_TYPES: EventModalType[] = [
  'name-change',
  'note-change',
  'fte-change',
  'weekly-hours-change',
];

const TYPE_LABELS: { value: EventModalType; label: string }[] = [
  { value: 'period', label: 'Qualifikation / Periode' },
  { value: 'join', label: 'Eintritt' },
  { value: 'leave', label: 'Austritt' },
  { value: 'care-visit', label: 'Pflegevisite' },
  { value: 'emergency-training', label: 'Notfallschulung' },
  { value: 'custom', label: 'Sonstiges' },
  { value: 'name-change', label: 'Namensänderung' },
  { value: 'note-change', label: 'Notizänderung' },
  { value: 'fte-change', label: 'VZÄ-Änderung' },
  { value: 'weekly-hours-change', label: 'Wochenstundenänderung' },
];

type EventModalProps = {
  state: EventModalState;
  periodForm: AddPeriodFormState;
  qualifications: QualificationType[];
  onStateChange: (next: Partial<EventModalState>) => void;
  onPeriodFormChange: (next: AddPeriodFormState) => void;
  onClose: () => void;
  onSaveEvent: () => void;
  onSavePeriod: () => void;
  onDeleteEvent: (id: number) => void;
  onDeletePeriod: (periodId: number, label: string) => void;
};

const EventModal = ({
  state,
  periodForm,
  qualifications,
  onStateChange,
  onPeriodFormChange,
  onClose,
  onSaveEvent,
  onSavePeriod,
  onDeleteEvent,
  onDeletePeriod,
}: EventModalProps) => {
  const isPeriod = state.type === 'period';
  const showValuePair =
    state.type === 'name-change' || state.type === 'fte-change' || state.type === 'weekly-hours-change';

  const deleteLabel = isPeriod
    ? periodForm.periodId
      ? 'Periode löschen'
      : undefined
    : state.id
      ? 'Eintrag löschen'
      : undefined;

  return (
    <Dialog
      open={state.open}
      width={560}
      title={state.id || periodForm.periodId ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
      subtitle="Beschäftigungsperioden und Ereignisse — Grundlage für die Jahreszuordnung."
      primaryLabel="Speichern"
      onPrimary={isPeriod ? onSavePeriod : onSaveEvent}
      deleteLabel={deleteLabel}
      onDelete={
        deleteLabel
          ? () =>
              isPeriod
                ? onDeletePeriod(
                    periodForm.periodId as number,
                    `${periodForm.startDate} – ${periodForm.endDate || 'aktuell'}`,
                  )
                : onDeleteEvent(state.id as number)
          : undefined
      }
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="event-type">Typ</label>
        <select
          id="event-type"
          className="input"
          value={state.type}
          onChange={(event) => {
            const nextType = event.target.value as EventModalType;
            if (DERIVED_TYPES.includes(nextType) && !state.id) return;
            onStateChange({ type: nextType, title: '', details: '' });
          }}
        >
          {TYPE_LABELS.filter(
            (entry) => !DERIVED_TYPES.includes(entry.value) || state.id != null,
          ).map((entry) => (
            <option
              key={entry.value}
              value={entry.value}
              disabled={DERIVED_TYPES.includes(entry.value) && state.type !== entry.value}
            >
              {entry.label}
            </option>
          ))}
        </select>
      </div>

      {isPeriod ? (
        <>
          <div className="cd-field-grid">
            <div className="field">
              <label htmlFor="period-start">Start</label>
              <input
                id="period-start"
                className="input"
                type="date"
                value={periodForm.startDate}
                onChange={(event) => onPeriodFormChange({ ...periodForm, startDate: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="period-end">Ende</label>
              <input
                id="period-end"
                className="input"
                type="date"
                value={periodForm.endDate}
                onChange={(event) => onPeriodFormChange({ ...periodForm, endDate: event.target.value })}
              />
            </div>
            <div className="field cd-field-wide">
              <label htmlFor="period-qualification">Qualifikation</label>
              <select
                id="period-qualification"
                className="input"
                value={periodForm.qualification}
                onChange={(event) =>
                  onPeriodFormChange({ ...periodForm, qualification: event.target.value })
                }
              >
                {qualifications.map((qualification) => (
                  <option key={qualification.id ?? qualification.name} value={qualification.name}>
                    {qualification.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="period-note">Notiz</label>
            <textarea
              id="period-note"
              className="input"
              style={{ minHeight: 70 }}
              placeholder="Kontext zur Qualifikation oder Periode"
              value={periodForm.note ?? ''}
              onChange={(event) => onPeriodFormChange({ ...periodForm, note: event.target.value })}
            />
          </div>
        </>
      ) : (
        <>
          <div className="cd-field-grid">
            <div className="field">
              <label htmlFor="event-date">Datum</label>
              <input
                id="event-date"
                className="input"
                type="date"
                value={state.eventDate}
                onChange={(event) => onStateChange({ eventDate: event.target.value })}
              />
            </div>
            {(state.type === 'care-visit' || state.type === 'emergency-training') && (
              <div className="field">
                <label htmlFor="event-expires">Gültig bis</label>
                <input
                  id="event-expires"
                  className="input"
                  type="date"
                  value={state.expiresAt ?? ''}
                  onChange={(event) => onStateChange({ expiresAt: event.target.value || null })}
                />
              </div>
            )}
            {showValuePair && (
              <>
                <div className="field">
                  <label htmlFor="event-previous">Vorheriger Wert</label>
                  <input
                    id="event-previous"
                    className="input"
                    value={state.previousValue ?? ''}
                    onChange={(event) => onStateChange({ previousValue: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="event-new">Neuer Wert</label>
                  <input
                    id="event-new"
                    className="input"
                    value={state.newValue ?? ''}
                    onChange={(event) => onStateChange({ newValue: event.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          {state.type === 'note-change' && (
            <>
              <div className="field">
                <label htmlFor="event-previous-note">Vorherige Notiz</label>
                <textarea
                  id="event-previous-note"
                  className="input"
                  style={{ minHeight: 60 }}
                  value={state.previousValue ?? ''}
                  onChange={(event) => onStateChange({ previousValue: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="event-new-note">Neue Notiz</label>
                <textarea
                  id="event-new-note"
                  className="input"
                  style={{ minHeight: 60 }}
                  value={state.newValue ?? ''}
                  onChange={(event) => onStateChange({ newValue: event.target.value })}
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="event-details">Details</label>
            <textarea
              id="event-details"
              className="input"
              style={{ minHeight: 70 }}
              placeholder="Beschreibung oder Notiz zum Ereignis"
              value={state.details}
              onChange={(event) => onStateChange({ details: event.target.value })}
            />
          </div>
        </>
      )}
    </Dialog>
  );
};

export default EventModal;
