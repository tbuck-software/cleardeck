import React, { useRef, useState } from 'react';
import type { BulkCompetencyChange, EmployeeCompetency } from '../../shared/types';
import api from '../../services/api';
import { LEGACY_COMPETENCY_LEVELS } from '../../utils/competencyLevels';
import { localDate } from '../../utils/calendarDate';
import { userFacingErrorMessage } from '../../utils/errorMessage';
import Dialog from '../ui/Dialog';

type Props = {
  employeeId: number;
  employeeName: string;
  entries: EmployeeCompetency[];
  onSaved: (entries: EmployeeCompetency[]) => void;
  onClose: () => void;
};

const BulkCompetencyModal = ({ employeeId, employeeName, entries, onSaved, onClose }: Props) => {
  const [levels, setLevels] = useState({ legacy: '', 'practice-v1': '' });
  const [approvedAt, setApprovedAt] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const saveInFlight = useRef(false);
  const dirty = Object.values(levels).some(Boolean) || !!approvedAt || !!approvedBy;
  const groups = (['legacy', 'practice-v1'] as const)
    .map((scheme) => ({
      scheme,
      count: entries.filter((entry) => entry.stageScheme === scheme).length,
    }))
    .filter((group) => group.count > 0);
  const changes: BulkCompetencyChange['changes'] = entries.flatMap((entry) => {
    const scheme = entry.stageScheme;
    if (!scheme || levels[scheme] === '') return [];
    return [
      {
        competencyDefinitionId: entry.competencyDefinitionId,
        stageScheme: scheme,
        level: Number(levels[scheme]),
      },
    ];
  });
  const completion = levels['practice-v1'] === '6';
  const close = () => {
    if (saveInFlight.current) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const save = async () => {
    if (saveInFlight.current || !changes.length) return;
    if (completion && (!approvedAt || !approvedBy.trim())) {
      setError('Bitte Bestätigungsdatum und verantwortliche Person eintragen.');
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.competencies.bulkChange({
        employeeId,
        changes,
        ...(completion ? { completion: { approvedAt, approvedBy: approvedBy.trim() } } : {}),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(userFacingErrorMessage(err, 'Speichern fehlgeschlagen.'));
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      manageFocus
      width={480}
      title={discard ? 'Änderungen verwerfen?' : 'Stufe ändern'}
      subtitle={discard ? undefined : `${employeeName} · ${entries.length} Kompetenzen ausgewählt`}
      primaryLabel={discard ? 'Verwerfen' : saving ? 'Speichern…' : 'Speichern'}
      primaryDanger={discard}
      primaryDisabled={!discard && (saving || !changes.length)}
      cancelLabel={discard ? 'Weiter bearbeiten' : 'Abbrechen'}
      onPrimary={discard ? onClose : () => void save()}
      onClose={discard ? () => setDiscard(false) : close}
    >
      {discard ? (
        <p>Die eingegebenen Änderungen wurden noch nicht gespeichert.</p>
      ) : (
        <>
          {groups.map(({ scheme, count }) => (
            <div className="field" key={scheme}>
              <label htmlFor={`bulk-level-${scheme}`}>
                {groups.length > 1
                  ? `${scheme === 'legacy' ? 'Altmodell' : 'Einarbeitung'} · ${count} ${count === 1 ? 'Kompetenz' : 'Kompetenzen'}`
                  : 'Stufe'}
              </label>
              <select
                id={`bulk-level-${scheme}`}
                className="input"
                value={levels[scheme]}
                disabled={saving}
                onChange={(event) => setLevels({ ...levels, [scheme]: event.target.value })}
              >
                <option value="">Beibehalten</option>
                {(scheme === 'legacy'
                  ? LEGACY_COMPETENCY_LEVELS
                  : [
                      'Offen',
                      'Stufe 1 · Einarbeitung',
                      'Stufe 2 · Einarbeitung',
                      'Stufe 3 · Einarbeitung',
                      'Stufe 4 · Einarbeitung',
                      'Stufe 5 · Einarbeitung',
                      '6 · Abgeschlossen',
                    ]
                ).map((label, level) => (
                  <option key={level} value={level}>
                    {scheme === 'legacy' && level > 0 ? `${level} · ${label}` : label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {completion && (
            <div className="cd-field-grid">
              <div className="field">
                <label htmlFor="bulk-approved-at">Bestätigt am</label>
                <input
                  id="bulk-approved-at"
                  className="input"
                  type="date"
                  max={localDate()}
                  required
                  value={approvedAt}
                  disabled={saving}
                  onChange={(event) => setApprovedAt(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="bulk-approved-by">Bestätigt durch</label>
                <input
                  id="bulk-approved-by"
                  className="input"
                  required
                  value={approvedBy}
                  disabled={saving}
                  onChange={(event) => setApprovedBy(event.target.value)}
                />
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="cd-danger-link">
              {error}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
};
export default BulkCompetencyModal;
