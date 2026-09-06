import React, { useState } from 'react';
import type { EmployeeWithPeriod, WorkingTime } from '../../shared/types';
import api from '../../services/api';
import { localDate } from '../../utils/calendarDate';
import { deriveFteFromWeeklyHours } from '../../utils/fte';
import Dialog from '../ui/Dialog';
import Icon from '../ui/Icon';

type Draft = { id?: number; date: string; hours: string; fte: string; linked: boolean };
type Props = {
  entry: WorkingTime | null;
  typeSelection?: React.ReactNode;
  onClose: () => void;
  employee: EmployeeWithPeriod;
  baseHours: number;
  onSaved: () => Promise<void>;
};

const WorkingTimeModal = ({ entry, employee, baseHours, onSaved, onClose, typeSelection }: Props) => {
  const [draft, setDraft] = useState<Draft>({
    id: entry?.id,
    date: entry?.effectiveFrom ?? localDate(),
    hours: entry ? String(entry.weeklyHours ?? '') : String(employee.weeklyHours ?? ''),
    fte: String(entry?.fte ?? employee.fte),
    linked: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft || !employee.id || saving) return;
    if (!draft.date || draft.fte === '') {
      setError('Bitte Gültigkeitsdatum und VZÄ eintragen.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.workingTimes.save({
        id: draft.id, employeeId: employee.id, effectiveFrom: draft.date,
        weeklyHours: draft.hours === '' ? null : Number(draft.hours), fte: Number(draft.fte),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };
  return (
        <Dialog open title={draft.id ? 'Arbeitszeit bearbeiten' : 'Neuer Eintrag'}
          width={typeSelection ? 560 : 480} primaryLabel={saving ? 'Speichern…' : 'Speichern'}
          primaryDisabled={saving} onPrimary={() => void save()}
          onClose={() => { if (!saving) onClose(); }}
          help={[{ title: 'Wie gelten die Zeiträume?', body: 'Ein Stand gilt bis zur nächsten Änderung oder zum Beschäftigungsende.' }]}>
          {typeSelection}
          <div className="field">
            <label htmlFor="working-time-date">Gültig ab</label>
            <input id="working-time-date" className="input" type="date" value={draft.date}
              onChange={event => setDraft({ ...draft, date: event.target.value })} />
          </div>
          <div className="cd-linked-row">
            <div className="field">
              <label htmlFor="working-time-hours">Wochenstunden</label>
              <input id="working-time-hours" className="input" type="number" min="0" max="168" step="0.1"
                value={draft.hours} onChange={event => {
                  const hours = event.target.value;
                  setDraft({ ...draft, hours, fte: draft.linked && hours !== ''
                    ? String(deriveFteFromWeeklyHours(Number(hours), baseHours)) : draft.fte });
                }} />
            </div>
            <button type="button" className="btn btn-secondary btn-icon" aria-pressed={draft.linked}
              aria-label="VZÄ aus Wochenstunden berechnen" onClick={() => setDraft({
                ...draft, linked: !draft.linked,
                fte: !draft.linked && draft.hours !== ''
                  ? String(deriveFteFromWeeklyHours(Number(draft.hours), baseHours)) : draft.fte,
              })}>
              <Icon name={draft.linked ? 'link' : 'linkOff'} size={16} />
            </button>
            <div className="field">
              <label htmlFor="working-time-fte">VZÄ</label>
              <input id="working-time-fte" className="input" type="number" min="0" max="1" step="0.01"
                value={draft.fte} disabled={draft.linked}
                onChange={event => setDraft({ ...draft, fte: event.target.value })} />
            </div>
          </div>
          {error && <p role="alert" className="cd-danger-link">{error}</p>}
        </Dialog>
  );
};
export default WorkingTimeModal;
