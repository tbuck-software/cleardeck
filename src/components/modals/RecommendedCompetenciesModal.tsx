import React from 'react';
import Checkbox from '../ui/Checkbox';
import Dialog from '../ui/Dialog';
import ListPanel from '../ui/ListPanel';
import ListRow from '../ui/ListRow';
import type { CompetencyDefinition } from '../../shared/types';
import type { SuggestedCompetencyModalState } from '../../types/ui';

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
}: RecommendedCompetenciesModalProps) => (
  <Dialog
    open={state.open}
    width={560}
    title="Passend zur Qualifikation"
    subtitle="Wähle aus, welche vorgeschlagenen Kompetenzen zugeordnet werden sollen."
    primaryLabel="Auswahl übernehmen"
    primaryDisabled={state.selectedDefinitionIds.length === 0}
    onPrimary={onSave}
    onClose={onClose}
  >
    <div className="cd-section-head" style={{ marginBottom: 0 }}>
      <span className="cd-muted-13">
        {state.selectedDefinitionIds.length} von {definitions.length} ausgewählt
      </span>
      <button type="button" className="btn btn-ghost" onClick={onSelectAll}>
        Alle aktivieren
      </button>
    </div>

    <ListPanel style={{ maxHeight: 360, overflowY: 'auto' }}>
      {definitions.length === 0 && <div className="cd-empty">Keine passenden Vorschläge.</div>}
      {definitions.map((definition) => {
        const definitionId = definition.id as number;
        const checked = state.selectedDefinitionIds.includes(definitionId);
        const label = `${definition.code ? `${definition.code} · ` : ''}${definition.name}`;
        return (
          <ListRow
            key={definitionId}
            selected={checked}
            leading={
              <Checkbox
                aria-label={`${label} auswählen`}
                checked={checked}
                onChange={() => onToggle(definitionId)}
              />
            }
            title={label}
            subline={definition.note}
            tag={
              <>
                <span className="tag tag-neutral">{definition.category ?? 'Allgemein'}</span>
                <span className="tag tag-neutral">{definition.relevance ?? 'Alle'}</span>
              </>
            }
            onSelect={() => onToggle(definitionId)}
          />
        );
      })}
    </ListPanel>
  </Dialog>
);

export default RecommendedCompetenciesModal;
