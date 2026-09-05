import React from 'react';
import Dialog from '../ui/Dialog';
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

    <div className="cd-panel" style={{ maxHeight: 360, overflowY: 'auto' }}>
      {definitions.length === 0 && <div className="cd-empty">Keine passenden Vorschläge.</div>}
      {definitions.map((definition) => {
        const definitionId = definition.id as number;
        const checked = state.selectedDefinitionIds.includes(definitionId);
        return (
          <label key={definitionId} className="cd-item" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(definitionId)}
              style={{ width: 16, height: 16, flex: 'none', accentColor: 'var(--color-accent)' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {definition.code ? `${definition.code} · ` : ''}
                {definition.name}
              </div>
              {definition.note && <div className="cd-muted-13">{definition.note}</div>}
            </div>
            <div className="cd-tag-row">
              <span className="tag tag-neutral">{definition.category ?? 'Allgemein'}</span>
              <span className="tag tag-neutral">{definition.relevance ?? 'Alle'}</span>
            </div>
          </label>
        );
      })}
    </div>
  </Dialog>
);

export default RecommendedCompetenciesModal;
