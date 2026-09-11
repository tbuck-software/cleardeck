import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import type {
  EmployeeWithPeriod,
  EmploymentPeriod,
  QualificationType,
} from '../../shared/types';
import type { EmploymentActionInput, EmploymentActionMode } from '../../types/ui';
import { localDate, shiftDays, validDate } from '../../utils/calendarDate';
import { formatDateDE } from '../../utils/dateFormat';
import { userFacingErrorMessage } from '../../utils/errorMessage';

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
  `${formatDateDE(period.startDate)} bis ${period.endDate ? formatDateDE(period.endDate) : 'offen'}`;

/** Start from a date the period can actually accept, so no dialog opens on an error. */
const initialDate = (mode: EmploymentActionMode, period: EmploymentPeriod): string => {
  const today = localDate();
  if (mode === 'departure') return period.endDate ?? (today > period.startDate ? today : period.startDate);
  const earliest = shiftDays(period.startDate, 1);
  if (today < earliest) return earliest;
  if (period.endDate && today > period.endDate) return period.endDate;
  return today;
};

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

  // Only opening resets the draft. Saving refreshes the person, and reacting to
  // that would clear the form under the user while the dialog is still open.
  useEffect(() => {
    if (!open) return;
    setDate(initialDate(mode, selectedPeriod));
    setQualification('');
    setError(null);
    setSaving(false);
  }, [mode, open]);

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
    if (!canSave || saving || !selectedPeriod.id) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(mode === 'departure'
        ? { mode, periodId: selectedPeriod.id, endDate: date }
        : { mode, periodId: selectedPeriod.id, effectiveFrom: date, qualification });
      onClose();
    } catch (err) {
      setError(userFacingErrorMessage(err));
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
      <div className="cd-notice cd-notice-neutral">
        <div>
          <div>
            <span className="cd-muted-13">Ausgewählte Periode </span>
            <strong>{periodLabel(selectedPeriod)}</strong>
          </div>
          <div>
            <span className="cd-muted-13">Arbeitszeitstand </span>
            <strong>
              {mode === 'departure'
                ? 'Bleibt unverändert. Die Aktion bestätigt keine Altdaten.'
                : 'Bleibt am Übergang erhalten. Die Aktion bestätigt keine Altdaten.'}
            </strong>
          </div>
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
                <span>
                  ab {date ? formatDateDE(date) : '—'}
                  {selectedPeriod.endDate
                    ? ` bis ${formatDateDE(selectedPeriod.endDate)}`
                    : ' · offen'}
                </span>
              </div>
              <p>Beide Zeiträume werden gemeinsam gespeichert. Arbeitszeitdaten bleiben dabei unverändert.</p>
            </div>
          </div>
        </>
      )}

      {mode === 'departure' && (
        <p className="cd-muted-13">
          Liegt ein Arbeitszeitstand nach dem Austritt, diesen zuerst in der Historie korrigieren.
        </p>
      )}
      {error && <p role="alert" className="cd-danger-link">{error}</p>}
    </Dialog>
  );
};

export default EmploymentActionModal;
