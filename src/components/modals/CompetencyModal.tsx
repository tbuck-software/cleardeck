import React from 'react';
import Dialog from '../ui/Dialog';
import type { CompetencyModalState } from '../../types/ui';

type CompetencyModalProps = {
  state: CompetencyModalState;
  onChange: (next: Partial<CompetencyModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: number) => void;
};

const CompetencyModal = ({ state, onChange, onClose, onSave, onDelete }: CompetencyModalProps) => (
  <Dialog
    open={state.open}
    width={520}
    title={state.id ? 'Kompetenz bearbeiten' : 'Neue Kompetenz'}
    subtitle="Änderungen gelten sofort für alle Zuordnungen."
    primaryLabel="Speichern"
    primaryDisabled={!state.value.trim()}
    onPrimary={onSave}
    deleteLabel={state.id && onDelete ? 'Löschen' : undefined}
    onDelete={state.id && onDelete ? () => onDelete(state.id as number) : undefined}
    onClose={onClose}
  >
    <div className="cd-field-grid">
      <div className="field">
        <label htmlFor="competency-code">Kürzel</label>
        <input
          id="competency-code"
          className="input"
          placeholder="z. B. K01"
          value={state.code}
          onChange={(event) => onChange({ code: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="competency-category">Kategorie</label>
        <select
          id="competency-category"
          className="input"
          value={state.category}
          onChange={(event) => onChange({ category: event.target.value })}
        >
          <option value="Allgemein">Allgemein</option>
          <option value="SGB XI">SGB XI</option>
          <option value="SGB V">SGB V</option>
        </select>
      </div>
      <div className="field cd-field-wide">
        <label htmlFor="competency-relevance">Relevanz</label>
        <select
          id="competency-relevance"
          className="input"
          value={state.relevance}
          onChange={(event) => onChange({ relevance: event.target.value })}
        >
          <option value="Alle">Alle</option>
          <option value="Nur PFK">Nur PFK</option>
          <option value="Nur PHK">Nur PHK</option>
          <option value="Azubi">Azubi</option>
          <option value="Praxisanleitung">Praxisanleitung</option>
          <option value="QMB">QMB</option>
        </select>
      </div>
      <div className="field cd-field-wide">
        <label htmlFor="competency-name">Bezeichnung</label>
        <input
          id="competency-name"
          className="input"
          placeholder="z. B. Wundversorgung chronisch"
          value={state.value}
          onChange={(event) => onChange({ value: event.target.value })}
        />
      </div>
    </div>
    <div className="field">
      <label htmlFor="competency-note">Notiz</label>
      <textarea
        id="competency-note"
        className="input"
        style={{ minHeight: 70 }}
        placeholder="Wofür gilt das, was ist zu beachten?"
        value={state.note}
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </div>
  </Dialog>
);

export default CompetencyModal;
