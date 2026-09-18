import React from 'react';
import Checkbox from '../ui/Checkbox';
import Dialog from '../ui/Dialog';
import ListPanel from '../ui/ListPanel';
import ListRow from '../ui/ListRow';
import type { CompetencyDefinition } from '../../shared/types';
import type { SuggestedCompetencyModalState } from '../../types/ui';
import { matchesQualificationRelevance } from '../../utils/qualificationRelevance';

type RecommendedCompetenciesModalProps = {
  state: SuggestedCompetencyModalState;
  definitions: CompetencyDefinition[];
  qualifications: string[];
  employeeQualification: string;
  assignedIds: number[];
  busy: boolean;
  onQualificationChange: (qualification: string) => void;
  onToggle: (definitionId: number) => void;
  onSelectAll: () => void;
  onClose: () => void;
  onSave: () => void;
};

const RecommendedCompetenciesModal = ({
  state, definitions, qualifications, employeeQualification, assignedIds, busy,
  onQualificationChange, onToggle, onSelectAll, onClose, onSave,
}: RecommendedCompetenciesModalProps) => {
  const qualification = state.qualification ?? employeeQualification;
  const options = [...new Set([
    employeeQualification, 'Pflegefachkraft', 'Pflegefachassistenz', 'Pflegehilfskraft',
    ...qualifications, qualification,
  ])].filter(Boolean);
  const matching = definitions.filter((entry) =>
    entry.id != null && matchesQualificationRelevance(qualification, entry.relevance),
  );
  const existing = matching.filter((entry) => assignedIds.includes(entry.id!));
  const available = matching.filter((entry) => !assignedIds.includes(entry.id!));
  const selectedCount = available.filter((entry) => state.selectedDefinitionIds.includes(entry.id!)).length;
  return (
    <Dialog
      open={state.open}
      manageFocus
      width={620}
      title="Kompetenzen aus Vorlage"
      subtitle="Vorlage aus der Relevanz im Kompetenzkatalog. Prüfe die Auswahl für diese Person."
      primaryLabel={busy ? 'Wird übernommen …' : `${selectedCount} ${selectedCount === 1 ? 'Kompetenz' : 'Kompetenzen'} hinzufügen`}
      primaryDisabled={busy || selectedCount === 0}
      onPrimary={onSave}
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="competency-template-qualification">Berufsgruppe / Qualifikation</label>
        <select
          id="competency-template-qualification"
          className="input"
          value={qualification}
          disabled={busy}
          onChange={(event) => onQualificationChange(event.target.value)}
        >
          {!qualification && <option value="">Keine Qualifikation hinterlegt</option>}
          {options.map((name) => <option key={name} value={name}>{name}{name === employeeQualification ? ' · aktuell bei dieser Person' : ''}</option>)}
        </select>
      </div>
      <p className="cd-muted-13">
        Neue Kompetenzen starten offen. Den Einarbeitungsstand dokumentierst du anschließend
        über „Stufe ändern“. Die Vorlage bestätigt keine Durchführungserlaubnis.
      </p>
      <div className="cd-section-head" style={{ marginBottom: 0 }}>
        <span className="cd-muted-13" role="status">
          {selectedCount} von {available.length} neuen Kompetenzen ausgewählt · {existing.length} bereits zugeordnet
        </span>
        <button type="button" className="btn btn-ghost" disabled={busy || available.length === 0} onClick={onSelectAll}>
          Alle neuen auswählen
        </button>
      </div>
      <ListPanel style={{ maxHeight: 360, overflowY: 'auto' }}>
        {matching.length === 0 && <div className="cd-empty">Für diese Qualifikation sind keine Kompetenzen im Katalog hinterlegt.</div>}
        {matching.map((definition) => {
          const definitionId = definition.id!;
          const assigned = assignedIds.includes(definitionId);
          const checked = !assigned && state.selectedDefinitionIds.includes(definitionId);
          const label = `${definition.code ? `${definition.code} · ` : ''}${definition.name}`;
          return (
            <ListRow
              key={definitionId}
              selected={checked}
              leading={
                <Checkbox
                  aria-label={`${label} auswählen`}
                  checked={assigned || checked}
                  disabled={assigned || busy}
                  onChange={() => onToggle(definitionId)}
                />
              }
              title={label}
              subline={definition.note}
              tag={<span className="tag tag-neutral">{assigned ? 'Bereits zugeordnet' : definition.category ?? 'Allgemein'}</span>}
              onSelect={assigned || busy ? undefined : () => onToggle(definitionId)}
            />
          );
        })}
      </ListPanel>
      {existing.length > 0 && <p className="cd-muted-13">Bereits zugeordnete Kompetenzen behalten ihre Stufen, Notizen, Bestätigungen und ihren Verlauf.</p>}
    </Dialog>
  );
};

export default RecommendedCompetenciesModal;
