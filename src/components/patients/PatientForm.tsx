import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import type { PatientFormState, Page } from '../../types/ui';
import type { QprRating } from '../../shared/types';
import BirthDateInput from '../ui/BirthDateInput';

type PatientFormProps = {
  page: Page;
  form: PatientFormState;
  loading: boolean;
  onChange: (next: PatientFormState) => void;
  onReset: () => void;
  onSave: () => void | Promise<void>;
  onDelete?: () => void;
  onBack: () => void;
};

const PatientForm = ({
  page,
  form,
  loading,
  onChange,
  onReset,
  onSave,
  onDelete,
  onBack,
}: PatientFormProps) => (
  <div className="card form-card">
    <div className="form-header">
      <div className="form-header-left">
        <button className="ghost-button icon-button" onClick={onBack} title="Zurueck">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <p className="eyebrow">Patient:in</p>
          <h3>{page === 'patient-edit' ? 'Bearbeiten' : 'Neue:r Patient:in'}</h3>
        </div>
      </div>
      <div className="form-actions">
        {page === 'patient-edit' && form.id && onDelete && (
          <button className="ghost-button danger" onClick={onDelete}>
            <FontAwesomeIcon icon={faTrash} /> Loeschen
          </button>
        )}
        <button className="ghost-button" onClick={onReset}>
          Zuruecksetzen
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
      <label className="full-width">
        Geburtsdatum
        <BirthDateInput
          value={form.birthDate}
          onChange={(value) => onChange({ ...form, birthDate: value })}
        />
      </label>
      <label className="full-width">
        Diagnose
        <input
          value={form.diagnosis}
          onChange={(e) => onChange({ ...form, diagnosis: e.target.value })}
          placeholder="Hauptdiagnose oder Pflegegrund"
        />
      </label>
      <label>
        QPR-Status (manuell)
        <select
          value={form.qprStatus}
          onChange={(e) => onChange({ ...form, qprStatus: e.target.value as QprRating | '' })}
        >
          <option value="">- Nicht bewertet -</option>
          <option value="A">A - Keine Auffaelligkeiten</option>
          <option value="B">B - Auffaelligkeiten ohne Risiko</option>
          <option value="C">C - Defizite mit Risiko negativer Folgen</option>
          <option value="D">D - Defizite mit eingetretenen negativen Folgen</option>
        </select>
      </label>
      <label className="full-width">
        Notiz / Bemerkung
        <textarea
          value={form.note}
          onChange={(e) => onChange({ ...form, note: e.target.value })}
          placeholder="Besonderheiten, Angehoerige, Kontakte"
        />
      </label>
    </div>

    <div className="form-footer">
      <button className="primary" onClick={onSave} disabled={loading}>
        {loading ? 'Speichern...' : 'Speichern'}
      </button>
    </div>
  </div>
);

export default PatientForm;
