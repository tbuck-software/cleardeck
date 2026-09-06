import Checkbox from '../ui/Checkbox';
import FieldHelp from '../ui/FieldHelp';
import React, { useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import Icon from '../ui/Icon';
import Segmented from '../ui/Segmented';
import type {
  AuditResultValue,
  AuditSectionDefinition,
  PatientWithLatestVisit,
} from '../../shared/types';
import type { AuditModalState } from '../../types/ui';

/** Enough to pick from without the dialog growing a scrollbar. */
const SEARCH_RESULTS = 6;

type AuditModalProps = {
  modal: AuditModalState;
  sections: AuditSectionDefinition[];
  patients: PatientWithLatestVisit[];
  onChange: (next: AuditModalState) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const AuditModal = ({
  modal,
  sections,
  patients,
  onChange,
  onClose,
  onSave,
  onDelete,
}: AuditModalProps) => {
  const [clientSearch, setClientSearch] = useState('');

  const selected = useMemo(
    () => patients.filter((patient) => patient.id != null && modal.clientIds.includes(patient.id)),
    [patients, modal.clientIds],
  );

  // Typeahead rather than a full roster: the MD draws at most nine people, so
  // the chosen few belong on screen and the other few hundred do not.
  const matches = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase();
    if (!needle) return [];
    return patients
      .filter(
        (patient) =>
          patient.name.toLowerCase().includes(needle) &&
          !(patient.id != null && modal.clientIds.includes(patient.id)),
      )
      .slice(0, SEARCH_RESULTS);
  }, [patients, clientSearch, modal.clientIds]);

  const setResult = (key: string, result: AuditResultValue) =>
    onChange({ ...modal, results: { ...modal.results, [key]: result } });

  const toggleClient = (id: number) =>
    onChange({
      ...modal,
      clientIds: modal.clientIds.includes(id)
        ? modal.clientIds.filter((value) => value !== id)
        : [...modal.clientIds, id],
    });

  return (
    <Dialog
      open={modal.open}
      width={620}
      title={modal.mode === 'edit' ? 'Prüfung bearbeiten' : 'Prüfung erfassen'}
      subtitle="Interne Zusammenfassung des Prüfberichts"
      primaryLabel="Speichern"
      onPrimary={onSave}
      deleteLabel={modal.mode === 'edit' && onDelete ? 'Löschen' : undefined}
      onDelete={onDelete}
      onClose={onClose}
    >
      <FieldHelp title="Einordnung der Ergebnisse">
        Dies ist kein vollständiger QPR-Prüfbogen und kein offizielles Gesamturteil. Fehlende
        Angaben bleiben offen. Alte Einträge müssen anhand des Originalberichts geprüft werden.
      </FieldHelp>
      <label className="cd-form-label">
        Originalbericht
        <input
          className="input"
          value={modal.reportRef ?? ''}
          onChange={(e) => onChange({ ...modal, reportRef: e.target.value })}
        />
      </label>
      <Checkbox
        checked={modal.confirmed ?? false}
        onChange={(e) => onChange({ ...modal, confirmed: e.target.checked })}
      >
        Mit Originalbericht abgeglichen
      </Checkbox>
      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="audit-date">Prüfdatum</label>
          <input
            id="audit-date"
            className="input"
            type="date"
            value={modal.auditDate}
            onChange={(event) => onChange({ ...modal, auditDate: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="audit-inspector">Prüfer:in / Stelle</label>
          <input
            id="audit-inspector"
            className="input"
            placeholder="MD Nord, Name"
            value={modal.inspector}
            onChange={(event) => onChange({ ...modal, inspector: event.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label>Prüfart</label>
        <Segmented
          ariaLabel="Prüfart"
          options={[
            { value: 'regel' as const, label: 'Regelprüfung' },
            { value: 'anlass' as const, label: 'Anlassprüfung' },
          ]}
          value={modal.kind}
          onChange={(kind) => onChange({ ...modal, kind })}
        />
      </div>

      <div className="field">
        <label>Interne Zusammenfassung je Qualitätsbereich</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map((section) => (
            <div
              key={section.key}
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
            >
              <span style={{ flex: 1, fontSize: 14, minWidth: 200 }}>{section.name}</span>
              {section.scale === 'abcd' && (
                <Segmented
                  ariaLabel={section.name}
                  options={(['unrecorded', 'A', 'B', 'C', 'D'] as AuditResultValue[]).map(
                    (value) => ({
                      value,
                      label: value === 'unrecorded' ? 'Nicht erfasst' : value,
                    }),
                  )}
                  value={modal.results[section.key] ?? 'unrecorded'}
                  onChange={(value) => setResult(section.key, value)}
                />
              )}
              {section.scale === 'yesno' && (
                <Segmented
                  ariaLabel={section.name}
                  options={[
                    { value: 'unrecorded' as AuditResultValue, label: 'Nicht erfasst' },
                    {
                      value: 'ok' as AuditResultValue,
                      label: section.key === 'billing' ? 'Keine Auffälligkeit erfasst' : 'erfüllt',
                    },
                    {
                      value: 'no' as AuditResultValue,
                      label: section.key === 'billing' ? 'Auffälligkeit erfasst' : 'nicht erfüllt',
                    },
                  ]}
                  value={modal.results[section.key] ?? 'unrecorded'}
                  onChange={(value) => setResult(section.key, value)}
                />
              )}
              {section.scale === 'text' && (
                <span className="cd-muted-13">
                  Beschreibend in Feststellungen erfassen; keine automatische Bewertung.
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="audit-findings">Feststellungen / Maßnahmen</label>
        <textarea
          id="audit-findings"
          className="input"
          style={{ minHeight: 70 }}
          placeholder="Was wurde bemängelt, was ist bis wann zu tun?"
          value={modal.findings}
          onChange={(event) => onChange({ ...modal, findings: event.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="audit-clients">
          Geprüfte Klient:innen{selected.length > 0 ? ` · ${selected.length} gewählt` : ''}
        </label>

        {patients.length === 0 ? (
          <span className="cd-muted-13">Keine Patient:innen erfasst.</span>
        ) : (
          <>
            <div className="cd-search" style={{ maxWidth: 'none' }}>
              <Icon name="search" size={16} />
              <input
                id="audit-clients"
                className="input"
                placeholder="Nach Name suchen und hinzufügen"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
              />
            </div>

            {clientSearch.trim() !== '' && (
              <div className="cd-typeahead">
                {matches.length === 0 && (
                  <span className="cd-muted-13">Keine weiteren Treffer.</span>
                )}
                {matches.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    className="cd-item"
                    onClick={() => {
                      if (patient.id != null) toggleClient(patient.id);
                      setClientSearch('');
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 600 }}>{patient.name}</span>
                    <Icon name="plus" size={15} />
                  </button>
                ))}
              </div>
            )}

            <div className="cd-token-row">
              {selected.length === 0 && (
                <span className="cd-muted-13">
                  Noch niemand gewählt — über die Suche hinzufügen.
                </span>
              )}
              {selected.map((patient) => (
                <span key={patient.id} className="cd-token">
                  {patient.name}
                  <button
                    type="button"
                    aria-label={`${patient.name} entfernen`}
                    onClick={() => patient.id != null && toggleClient(patient.id)}
                  >
                    <Icon name="close" size={13} />
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default AuditModal;
