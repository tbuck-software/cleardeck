import React from 'react';
import Dialog from '../ui/Dialog';
import Combobox from '../ui/Combobox';
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
      subtitle={employeeName}
      help={[
        {
          title: 'Stufen und Bestätigung',
          body: 'Stufen 1–5: Einarbeitung läuft. Stufe 6: abgeschlossen mit Bestätigung. Die Stufe ist keine eigenständige Einsatzberechtigung. Frühere Stände bleiben dokumentiert.',
        },
      ]}
      primaryLabel="Speichern"
      onPrimary={onSave}
      deleteLabel={isAssigned ? 'Entfernen' : undefined}
      onDelete={isAssigned ? onDelete : undefined}
      onClose={onClose}
    >
      {!isAssigned && (
        <div className="field">
          <label htmlFor="employee-competency">Kompetenz</label>
          <Combobox
            id="employee-competency"
            placeholder="Kürzel oder Bezeichnung eingeben"
            options={availableDefinitions.map((definition) => ({
              value: definition.id as number,
              label: definition.name,
              code: definition.code ?? undefined,
              group: definition.category || 'Allgemein',
            }))}
            value={state.competencyDefinitionId}
            onChange={(next) => {
              const selectedId = next == null ? null : Number(next);
              const definition = availableDefinitions.find((entry) => entry.id === selectedId);
              onChange({
                competencyDefinitionId: selectedId,
                competencyName: definition?.name ?? '',
              });
            }}
          />
        </div>
      )}

      <div className="field">
        <label>Stufe</label>
        <CompetencyLevelPicker
          legacy={state.stageScheme === 'legacy'}
          value={state.level ?? 0}
          onChange={(level) => onChange({ level })}
        />
      </div>

      {state.stageScheme === 'legacy' && (
        <p>
          Alter Stufenstand, Abschluss noch ungeprüft.{' '}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              onChange({ stageScheme: 'practice-v1', level: null, approvedAt: '', approvedBy: '' })
            }
          >
            Stand neu einschätzen
          </button>
        </p>
      )}
      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="competency-approved-at">Bestätigt am</label>
          <input
            id="competency-approved-at"
            className="input"
            type="date"
            value={state.approvedAt}
            onChange={(event) => onChange({ approvedAt: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="competency-approved-by">Bestätigt durch</label>
          <input
            id="competency-approved-by"
            className="input"
            placeholder="Pflegedienstleitung"
            value={state.approvedBy}
            onChange={(event) => onChange({ approvedBy: event.target.value })}
          />
        </div>
      </div>

      {!!state.stageHistory?.length && (
        <details className="cd-disclosure">
          <summary>Bisherige Stände ({state.stageHistory.length})</summary>
          <div className="cd-disclosure-body">
            {state.stageHistory.map((entry, i) => (
              <p key={i}>
                {entry.changedAt}: {entry.stageScheme === 'legacy' ? 'Altmodell' : 'Einarbeitung'}{' '}
                Stufe {entry.level ?? 'offen'} · {entry.approvedAt || 'ohne Bestätigungsdatum'} ·{' '}
                {entry.approvedBy || 'keine Person erfasst'} · {entry.note}
              </p>
            ))}
          </div>
        </details>
      )}
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
