import { faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import type { CompetencyDefinition } from '../../shared/types';
import type { SuggestedCompetencyModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';

type RecommendedCompetenciesModalProps = {
  state: SuggestedCompetencyModalState;
  definitions: CompetencyDefinition[];
  onToggle: (definitionId: number) => void;
  onSelectAll: () => void;
  onClose: () => void;
  onSave: () => void;
};

const RecommendedCompetenciesModal = ({
  state,
  definitions,
  onToggle,
  onSelectAll,
  onClose,
  onSave,
}: RecommendedCompetenciesModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide">
        <ModalHeader
          icon={faLayerGroup}
          title="Passend zur Qualifikation"
          subtitle="Wähle aus, welche vorgeschlagenen Kompetenzen diesem Teammitglied zugeordnet werden sollen."
          onClose={onClose}
        />
        <div className="selection-toolbar">
          <span className="selection-counter">
            {state.selectedDefinitionIds.length} von {definitions.length} ausgewählt
          </span>
          <button className="ghost-button" onClick={onSelectAll}>
            Alle aktivieren
          </button>
        </div>
        <div className="selection-list">
          {definitions.map((definition) => {
            const definitionId = definition.id as number;
            const checked = state.selectedDefinitionIds.includes(definitionId);
            return (
              <label key={definitionId} className={`selection-item${checked ? ' selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(definitionId)}
                />
                <div className="selection-item-body">
                  <div className="selection-item-title-row">
                    <strong>{definition.name}</strong>
                    <div className="selection-tags">
                      {definition.code && <span className="selection-tag">{definition.code}</span>}
                      <span className="selection-tag subtle">
                        {definition.category ?? 'Allgemein'}
                      </span>
                      <span className="selection-tag subtle">
                        {definition.relevance ?? 'Alle'}
                      </span>
                    </div>
                  </div>
                  {definition.note && <span className="muted">{definition.note}</span>}
                </div>
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <div className="modal-actions-left" />
          <div className="modal-actions-right">
            <button className="ghost-button" onClick={onClose}>
              Abbrechen
            </button>
            <button
              className="primary"
              onClick={onSave}
              disabled={state.selectedDefinitionIds.length === 0}
            >
              Auswahl übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendedCompetenciesModal;
