import React from 'react';
import Dialog from '../ui/Dialog';
import CompetencyLevelPicker from '../ui/CompetencyLevelPicker';
import type { CompetencyDefinition } from '../../shared/types';
import type { EmployeeCompetencyModalState } from '../../types/ui';

type EmployeeCompetencyModalProps = {
  state: EmployeeCompetencyModalState;
  employeeName: string;
  availableDefinitions: CompetencyDefinition[];
  onChange: (next: Partial<EmployeeCompetencyModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const EmployeeCompetencyModal = ({
  state,
  employeeName,
  availableDefinitions,
  onChange,
  onClose,
  onSave,
  onDelete,
}: EmployeeCompetencyModalProps) => {
  const isAssigned = Boolean(state.id);

  return (
    <Dialog
      open={state.open}
      width={560}
      title={isAssigned ? state.competencyName : 'Kompetenz hinzufügen'}
      subtitle={`${employeeName} · Stufe und fachliche Freigabe`}
      primaryLabel="Speichern"
      onPrimary={onSave}
      deleteLabel={isAssigned ? 'Entfernen' : undefined}
      onDelete={isAssigned ? onDelete : undefined}
      onClose={onClose}
    >
      {!isAssigned && (
        <div className="field">
          <label htmlFor="employee-competency">Kompetenz</label>
          <select
            id="employee-competency"
            className="input"
            value={state.competencyDefinitionId ?? ''}
            onChange={(event) => {
              const selectedId = Number(event.target.value);
              const definition = availableDefinitions.find((entry) => entry.id === selectedId);
              onChange({
                competencyDefinitionId: selectedId,
                competencyName: definition?.name ?? '',
              });
            }}
          >
            {availableDefinitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.code ? `${definition.code} · ` : ''}
                {definition.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Stufe</label>
        <CompetencyLevelPicker value={state.level ?? 0} onChange={(level) => onChange({ level })} />
      </div>

      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="competency-approved-at">Freigegeben am</label>
          <input
            id="competency-approved-at"
            className="input"
            type="date"
            value={state.approvedAt}
            onChange={(event) => onChange({ approvedAt: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="competency-approved-by">Freigegeben durch</label>
          <input
            id="competency-approved-by"
            className="input"
            placeholder="Pflegedienstleitung"
            value={state.approvedBy}
            onChange={(event) => onChange({ approvedBy: event.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="competency-entry-note">Notiz</label>
        <textarea
          id="competency-entry-note"
          className="input"
          style={{ minHeight: 70 }}
          value={state.note}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </div>
    </Dialog>
  );
};

export default EmployeeCompetencyModal;
