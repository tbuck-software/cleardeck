import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import type {
  EmployeeWithPeriod,
  EmploymentPeriod,
  QualificationType,
} from '../../shared/types';
import { localDate, shiftDays, validDate } from '../../utils/calendarDate';
import { formatDateDE } from '../../utils/dateFormat';

export type EmploymentActionMode = 'departure' | 'qualification';

type EmploymentActionInput =
  | { mode: 'departure'; periodId: number; endDate: string }
  | { mode: 'qualification'; periodId: number; effectiveFrom: string; qualification: string };

type Props = {
  open: boolean;
  mode: EmploymentActionMode;
  employee: EmployeeWithPeriod;
  periods: EmploymentPeriod[];
  qualifications: QualificationType[];
  onClose: () => void;
  onSave: (input: EmploymentActionInput) => Promise<void>;
};

const periodLabel = (period: EmploymentPeriod) =>
  `${formatDateDE(period.startDate)} bis ${period.endDate ? formatDateDE(period.endDate) : 'heute'}`;

const EmploymentActionModal = ({
  open,
  mode,
  employee,
  periods,
  qualifications,
  onClose,
  onSave,
}: Props) => {
  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === employee.periodId) ?? {
      id: employee.periodId,
      startDate: employee.startDate,
      endDate: employee.endDate,
      qualification: employee.qualification,
      employeeId: employee.id,
    },
    [employee.endDate, employee.id, employee.periodId, employee.qualification, employee.startDate, periods],
  );
  const [date, setDate] = useState('');
  const [qualification, setQualification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(mode === 'departure' ? employee.endDate ?? localDate() : localDate());
    setQualification('');
    setError(null);
    setSaving(false);
  }, [employee.endDate, employee.qualification, mode, open, qualifications]);

  const dateWithinSelectedPeriod = validDate(date) &&
    date >= selectedPeriod.startDate &&
    (!selectedPeriod.endDate || date <= selectedPeriod.endDate);
  const qualificationChanged = qualification.trim() !== '' && qualification !== employee.qualification;
  const previewEnd = validDate(date) ? shiftDays(date, -1) : '';
  const canSave = Boolean(
    employee.id && selectedPeriod.id && dateWithinSelectedPeriod &&
    (mode === 'departure' || (qualificationChanged && date > selectedPeriod.startDate)),
  );

  const save = async () => {
    if (!selectedPeriod.id) return;
    if (!validDate(date)) {
      setError(mode === 'departure' ? 'Bitte ein gültiges Austrittsdatum eintragen.' : 'Bitte ein gültiges Wechseldatum eintragen.');
      return;
    }
    if (!dateWithinSelectedPeriod) {
      setError('Das Datum muss innerhalb der ausgewählten Beschäftigungsperiode liegen.');
      return;
    }
    if (mode === 'qualification' && date <= selectedPeriod.startDate) {
      setError('Der Wechsel muss nach dem Beginn der bisherigen Periode liegen.');
      return;
    }
    if (mode === 'qualification' && !qualificationChanged) {
      setError('Bitte eine andere Qualifikation auswählen.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(mode === 'departure'
        ? { mode, periodId: selectedPeriod.id, endDate: date }
        : { mode, periodId: selectedPeriod.id, effectiveFrom: date, qualification });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
      setError(message.replace(/^API [^ ]+ failed: /, ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      manageFocus
      width={560}
      title={mode === 'departure' ? 'Austritt erfassen' : 'Qualifikation wechseln'}
      subtitle={`${employee.name} · ${employee.qualification}`}
      primaryLabel={saving ? 'Speichern…' : 'Speichern'}
      primaryDisabled={!canSave || saving}
      onPrimary={() => void save()}
      onClose={() => { if (!saving) onClose(); }}
    >
      <div className="cd-action-context">
        <div>
          <span className="cd-muted-13">Ausgewählte Periode</span>
          <strong>{periodLabel(selectedPeriod)}</strong>
        </div>
        <div>
          <span className="cd-muted-13">Arbeitszeitstand</span>
          <strong>Bleibt am Übergang erhalten. Die Aktion bestätigt keine Altdaten.</strong>
        </div>
      </div>

      <div className="field">
        <label htmlFor="employment-action-date">
          {mode === 'departure' ? 'Austritt' : 'Wechsel ab'}
        </label>
        <input
          id="employment-action-date"
          className="input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      {date && !validDate(date) && (
        <p role="alert" className="cd-danger-link">Bitte ein gültiges Datum eintragen.</p>
      )}
      {validDate(date) && !dateWithinSelectedPeriod && (
        <p role="alert" className="cd-danger-link">
          Das Datum muss innerhalb der ausgewählten Beschäftigungsperiode liegen.
        </p>
      )}

      {mode === 'qualification' && (
        <>
          <div className="field">
            <label htmlFor="employment-action-qualification">Neue Qualifikation</label>
            <select
              id="employment-action-qualification"
              className="input"
              value={qualification}
              onChange={(event) => setQualification(event.target.value)}
            >
              <option value="">Bitte auswählen</option>
              {qualifications.map((entry) => (
                <option key={entry.id ?? entry.name} value={entry.name} disabled={entry.name === employee.qualification}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <div className="cd-notice cd-notice-ok" role="status">
            <div>
              <strong>Vorschau</strong>
              <div className="cd-action-preview">
                <span>{employee.qualification}</span>
                <span>bis {previewEnd ? formatDateDE(previewEnd) : '—'}</span>
                <span>{qualification || 'Neue Qualifikation'}</span>
                <span>ab {date ? formatDateDE(date) : '—'}</span>
              </div>
              <p>Beide Zeiträume werden gemeinsam gespeichert. Arbeitszeitdaten bleiben dabei unverändert.</p>
            </div>
          </div>
        </>
      )}

      {mode === 'departure' && (
        <p className="cd-muted-13">
          Spätere Arbeitszeitstände blockieren eine Verkürzung. ClearDeck erklärt den Konflikt, damit keine historischen Angaben verloren gehen.
        </p>
      )}
      {error && <p role="alert" className="cd-danger-link">{error}</p>}
    </Dialog>
  );
};

export type { EmploymentActionInput };
export default EmploymentActionModal;
