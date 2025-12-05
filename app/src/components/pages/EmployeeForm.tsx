import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import type { EmploymentPeriod, QualificationType } from '../../shared/types';
import type { FormState, Page } from '../../types/ui';
import { fteHelp } from '../../constants';
import HistoryList from '../employees/HistoryList';

type EmployeeFormProps = {
  page: Page;
  form: FormState;
  qualifications: QualificationType[];
  addNewPeriod: boolean;
  periods: EmploymentPeriod[];
  loading: boolean;
  onChange: (next: FormState) => void;
  onReset: () => void;
  onSave: () => void | Promise<void>;
  onToggleAddPeriod: (next: boolean) => void;
  onDelete?: () => void;
};

const EmployeeForm = ({
  page,
  form,
  qualifications,
  addNewPeriod,
  periods,
  loading,
  onChange,
  onReset,
  onSave,
  onToggleAddPeriod,
  onDelete,
}: EmployeeFormProps) => (
  <div className="grid form-layout">
    <div className="card form-card">
      <div className="form-header">
        <div>
          <p className="eyebrow">Erfassen / Bearbeiten</p>
          <h3>{page === 'edit' ? 'Datensatz aktualisieren' : 'Neue Person'}</h3>
        </div>
        <div className="form-actions">
          {page === 'edit' && form.id && onDelete && (
            <button className="ghost-button danger" onClick={onDelete}>
              <FontAwesomeIcon icon={faTrash} /> Löschen
            </button>
          )}
          <button className="ghost-button" onClick={onReset}>
            Zurücksetzen
          </button>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Name*
          <input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Vor- und Nachname"
          />
        </label>
        <label>
          Qualifikation
          <select value={form.qualification} onChange={(e) => onChange({ ...form, qualification: e.target.value })}>
            {qualifications.map((q) => (
              <option key={q.id ?? q.name} value={q.name}>
                {q.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ ...form, startDate: e.target.value })}
          />
        </label>
        <label>
          Ende
          <input type="date" value={form.endDate} onChange={(e) => onChange({ ...form, endDate: e.target.value })} />
        </label>
        <label>
          <abbr className="help" title={fteHelp}>
            FTE / VZÄ
          </abbr>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.fte}
            onChange={(e) => onChange({ ...form, fte: Number(e.target.value) })}
          />
        </label>
        <label className="full-width">
          Notiz / Bemerkung
          <textarea
            value={form.note}
            onChange={(e) => onChange({ ...form, note: e.target.value })}
            placeholder="Fortbildungen, Besonderheiten, Ansprechpartner"
          />
        </label>
        {page === 'edit' && form.id && (
          <label className="full-width checkbox">
            <input type="checkbox" checked={addNewPeriod} onChange={(e) => onToggleAddPeriod(e.target.checked)} />
            Neue Historienperiode anlegen (bestehende Einträge bleiben erhalten)
          </label>
        )}
      </div>

      <div className="form-actions">
        <button className="primary" onClick={onSave} disabled={loading}>
          {loading ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>

    {page === 'edit' && <HistoryList items={periods} />}
  </div>
);

export default EmployeeForm;
