import React, { useState } from 'react';
import Dialog from '../ui/Dialog';
import { formatDateDE } from '../../utils/dateFormat';
import { teilgruppeOf } from '../../utils/qpr';
import type {
  AuditSectionDefinition,
  AuditWithDetails,
  PatientWithLatestVisit,
} from '../../shared/types';

const RESULT_TAG: Record<string, string> = {
  A: 'tag-ok',
  B: 'tag-accent-2',
  C: 'tag-accent',
  D: 'tag-bad',
  ok: 'tag-ok',
  no: 'tag-bad',
  text: 'tag-neutral',
  unrecorded: 'tag-neutral',
};

const RESULT_LABEL: Record<string, string> = {
  A: 'Keine Auffälligkeiten',
  B: 'Auffälligkeiten ohne Risiko negativer Folgen',
  C: 'Defizite mit Risiko negativer Folgen',
  D: 'Defizite mit eingetretenen negativen Folgen',
  ok: 'erfüllt',
  no: 'nicht erfüllt / Auffälligkeiten',
  text: 'beschreibend',
  unrecorded: 'Nicht erfasst',
};

const RESULT_MARK: Record<string, string> = { unrecorded: '?', ok: '✓', no: '✗', text: '—' };

/** The MD draws up to nine; beyond that the rest is one click away. */
const CLIENTS_SHOWN = 9;

type AuditViewModalProps = {
  audit: AuditWithDetails | null;
  sections: AuditSectionDefinition[];
  patients: PatientWithLatestVisit[];
  onEdit: () => void;
  onOpenPatient: (id: number) => void;
  onClose: () => void;
};

const AuditViewModal = ({
  audit,
  sections,
  patients,
  onEdit,
  onOpenPatient,
  onClose,
}: AuditViewModalProps) => {
  const [allClients, setAllClients] = useState(false);

  if (!audit) return null;

  const clientIds = allClients ? audit.clientIds : audit.clientIds.slice(0, CLIENTS_SHOWN);
  const hiddenClients = audit.clientIds.length - clientIds.length;

  return (
    <Dialog
      open
      width={620}
      title={`Prüfung ${formatDateDE(audit.auditDate)}`}
      subtitle={audit.inspector || 'Ohne Prüfstelle'}
      primaryLabel="Bearbeiten"
      onPrimary={onEdit}
      cancelLabel="Schließen"
      onClose={onClose}
    >
      <p>
        {audit.confirmed ? 'Geprüfte interne Zusammenfassung' : 'Entwurf / unbestätigter Altstand'}.
        Einzelbefunde je Aspekt und Person: {audit.reportRef || 'Originalbericht nicht hinterlegt'}.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sections.map((section) => {
          const row = audit.results.find((entry) => entry.sectionKey === section.key);
          const result = row?.result ?? 'unrecorded';
          return (
            <div
              key={section.key}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: '1px solid var(--color-divider)',
              }}
            >
              <span
                className={`tag ${RESULT_TAG[result]}`}
                style={{
                  flex: 'none',
                  fontWeight: 700,
                  width: 34,
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {RESULT_MARK[result] ?? result}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {section.name}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--color-neutral-700)' }}>
                    · {RESULT_LABEL[result]}
                  </span>
                </div>
                <div className="cd-muted-13">{row?.note || 'Keine gesonderte Notiz erfasst'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {audit.findings && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-neutral-700)',
              marginBottom: 6,
            }}
          >
            Feststellungen / Maßnahmen
          </div>
          <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{audit.findings}</p>
        </div>
      )}

      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-neutral-700)',
            marginBottom: 8,
          }}
        >
          Geprüfte Klient:innen
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {audit.clientIds.length === 0 && <span className="cd-muted-13">Keine erfasst.</span>}
          {clientIds.map((id) => {
            const patient = patients.find((entry) => entry.id === id);
            if (!patient) return null;
            const group = teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
            const label = `${group == null || group === 'none' ? '–' : group}${patient.hkpCode ? '+D' : ''}`;
            return (
              <button
                key={id}
                type="button"
                className="btn btn-secondary"
                style={{ gap: 8, padding: '5px 12px' }}
                onClick={() => onOpenPatient(id)}
              >
                <span className="tag tag-accent-2" style={{ fontWeight: 700, padding: '0 6px' }}>
                  {label}
                </span>
                {patient.name}
              </button>
            );
          })}
          {hiddenClients > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setAllClients(true)}>
              und {hiddenClients} weitere
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default AuditViewModal;
