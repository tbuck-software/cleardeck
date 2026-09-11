import React, { useEffect, useRef, useState } from 'react';
import Checkbox from '../ui/Checkbox';
import type { EmployeeCompetency } from '../../shared/types';
import { COMPETENCY_LEVELS, LEGACY_COMPETENCY_LEVELS } from '../../utils/competencyLevels';
import { formatDateDE } from '../../utils/dateFormat';
import Icon from '../ui/Icon';
import BulkCompetencyModal from '../modals/BulkCompetencyModal';

type Props = {
  employeeId: number;
  employeeName: string;
  competencies: EmployeeCompetency[];
  availableCompetencyCount: number;
  suggestedCompetencyCount: number;
  onAddCompetency: () => void;
  onOpenSuggestedCompetencies: () => void;
  onSelectCompetency: (entry: EmployeeCompetency) => void;
  onSaved: (entries: EmployeeCompetency[]) => void;
};
const EmployeeCompetencies = ({
  employeeId,
  employeeName,
  competencies,
  availableCompetencyCount,
  suggestedCompetencyCount,
  onAddCompetency,
  onOpenSuggestedCompetencies,
  onSelectCompetency,
  onSaved,
}: Props) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);
  const selected = competencies.filter((entry) =>
    selectedIds.includes(entry.competencyDefinitionId),
  );
  useEffect(() => {
    if (allRef.current)
      allRef.current.indeterminate = selected.length > 0 && selected.length < competencies.length;
  }, [selected.length, competencies.length]);
  return (
    <section className="cd-competency-section">
      <div className="cd-section-head">
        <div>
          <h3 className="cd-h3">Kompetenzmatrix</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {availableCompetencyCount === 0 && (
            <span className="cd-muted-13">Alle Kompetenzen des Katalogs sind zugeordnet.</span>
          )}
          {suggestedCompetencyCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenSuggestedCompetencies}
            >
              {suggestedCompetencyCount} Vorschläge aus Qualifikation
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={availableCompetencyCount === 0}
            onClick={onAddCompetency}
          >
            <Icon name="plus" size={16} />
            Kompetenz hinzufügen
          </button>
        </div>
      </div>
      {competencies.length > 0 && (
        <div className="cd-bulk-toolbar">
          <Checkbox
            className="cd-select-all"
            inputRef={allRef}
            checked={selected.length === competencies.length}
            aria-label={`Alle ${competencies.length} Kompetenzen auswählen`}
            onChange={(event) =>
              setSelectedIds(
                event.target.checked
                  ? competencies.map((entry) => entry.competencyDefinitionId)
                  : [],
              )
            }
          >
            Alle auswählen
          </Checkbox>
          {selected.length > 0 && (
            <>
              <span role="status" className="cd-muted-13">
                {selected.length} ausgewählt
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                Stufe ändern
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds([])}>
                Auswahl aufheben
              </button>
            </>
          )}
        </div>
      )}
      <div className="cd-competency-list">
        {competencies.length === 0 && (
          <div className="cd-empty">Noch keine Kompetenzen zugeordnet.</div>
        )}
        {competencies.map((competency) => {
          const level = competency.level ?? 0;
          const tagClass = !level
            ? 'tag-neutral'
            : level === 6 && competency.stageScheme === 'practice-v1'
              ? 'tag-accent-2'
              : 'tag-accent';
          return (
            <div
              key={competency.id ?? competency.competencyDefinitionId}
              className="cd-selectable-row"
              data-selected={selectedIds.includes(competency.competencyDefinitionId)}
            >
              <Checkbox
                className="cd-row-select"
                aria-label={`${competency.competencyName} auswählen`}
                checked={selectedIds.includes(competency.competencyDefinitionId)}
                onChange={(event) =>
                  setSelectedIds((ids) =>
                    event.target.checked
                      ? [...ids, competency.competencyDefinitionId]
                      : ids.filter((id) => id !== competency.competencyDefinitionId),
                  )
                }
              />
              <button
                type="button"
                className="cd-item cd-competency-row"
                onClick={() => onSelectCompetency(competency)}
              >
                <span className="cd-code">{competency.competencyCode ?? ''}</span>
                <div className="cd-competency-copy">
                  <div style={{ fontWeight: 600 }}>{competency.competencyName}</div>
                  <div className="cd-muted-13">
                    {competency.category ?? 'Ohne Kategorie'}
                    {competency.stageScheme === 'legacy' ? ' · Altmodell' : ''} ·{' '}
                    {competency.approvedAt
                      ? `bestätigt ${formatDateDE(competency.approvedAt)}`
                      : 'keine Bestätigung'}
                  </div>
                </div>
                {competency.stageHistory?.length ? (
                  <div className="cd-muted-13">
                    {competency.stageHistory.length} dokumentierte Stände; zuletzt{' '}
                    {competency.stageHistory[0].changedAt}
                  </div>
                ) : null}
                <div
                  className="cd-level-dots"
                  aria-label={`Stufe ${level} von ${competency.stageScheme === 'legacy' ? 5 : 6}`}
                >
                  {(competency.stageScheme === 'legacy' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]).map(
                    (step) => (
                      <span
                        key={step}
                        style={{
                          background:
                            level && step <= level
                              ? level === 6 && competency.stageScheme === 'practice-v1'
                                ? 'var(--color-accent-2-500)'
                                : 'var(--color-accent-500)'
                              : 'transparent',
                          border: `2px solid ${level && step <= level ? 'transparent' : 'var(--color-neutral-300)'}`,
                        }}
                      />
                    ),
                  )}
                </div>
                <span
                  className={`tag ${tagClass}`}
                  style={{ flex: 'none', minWidth: 110, justifyContent: 'center' }}
                >
                  {level
                    ? competency.stageScheme === 'legacy'
                      ? `${level} · ${LEGACY_COMPETENCY_LEVELS[level]}`
                      : COMPETENCY_LEVELS[level]
                    : 'Offen'}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {editing && (
        <BulkCompetencyModal
          employeeId={employeeId}
          employeeName={employeeName}
          entries={selected}
          onClose={() => setEditing(false)}
          onSaved={(entries) => {
            onSaved(entries);
            setSelectedIds([]);
            allRef.current?.focus();
          }}
        />
      )}
    </section>
  );
};
export default EmployeeCompetencies;
