import React from 'react';
import Icon from '../ui/Icon';
import { formatDateDE } from '../../utils/dateFormat';
import { dueColor } from './PatientList';
import {
  HKP_LABEL,
  INTENSIVE_CARE_LABEL,
  TEILGRUPPE_LABEL,
  TEILGRUPPE_SHORT,
  teilgruppeOf,
  visitDue,
} from '../../utils/qpr';
import type { PatientVisit, PatientWithLatestVisit } from '../../shared/types';

const ageOf = (birthDate?: string | null): string => {
  if (!birthDate || birthDate.startsWith('0000')) return '';
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return `${age} Jahre`;
};

type PatientDetailProps = {
  patient: PatientWithLatestVisit;
  visits: PatientVisit[];
  visitIntervalDays: number;
  onEdit: () => void;
  onNewVisit: () => void;
  onSelectVisit: (visit: PatientVisit) => void;
};

const PatientDetail = ({
  patient,
  visits,
  visitIntervalDays,
  onEdit,
  onNewVisit,
  onSelectVisit,
}: PatientDetailProps) => {
  const today = new Date().toISOString().slice(0, 10);
  const group = teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
  const due = visitDue(
    { latestVisitDate: patient.latestVisitDate, admissionDate: patient.admissionDate },
    today,
    visitIntervalDays,
  );
  const age = ageOf(patient.birthDate);

  const missing = 'fehlt';
  const facts: { label: string; value: string }[] = [
    { label: 'Pflegegrad', value: patient.careLevel ? `PG ${patient.careLevel}` : missing },
    {
      label: 'Kognition (Modul 2)',
      value:
        patient.cognitionImpaired == null
          ? missing
          : patient.cognitionImpaired
            ? 'eingeschränkt'
            : 'nicht eingeschränkt',
    },
    {
      label: 'Mobilität (Modul 1)',
      value:
        patient.mobilityImpaired == null
          ? missing
          : patient.mobilityImpaired
            ? 'eingeschränkt'
            : 'nicht eingeschränkt',
    },
    {
      label: 'Aufwändige HKP (Teilgruppe D)',
      value: patient.hkpCode ? `Ziffer ${patient.hkpCode} · ${HKP_LABEL[patient.hkpCode]}` : 'keine',
    },
    {
      label: 'AKI / pHKP',
      value: patient.intensiveCare ? INTENSIVE_CARE_LABEL[patient.intensiveCare] : 'nein',
    },
    {
      label: 'Bevollmächtigte / Betreuung',
      value: patient.contact?.trim() || 'nicht hinterlegt',
    },
  ];

  return (
    <div className="cd-page cd-detail" style={{ maxWidth: 1100 }}>
      <header className="cd-detail-header">
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="cd-detail-title">
            <h1 className="cd-h1" style={{ marginTop: 0 }}>
              {patient.name}
            </h1>
            <span className={`tag ${group ? 'tag-accent-2' : 'tag-neutral'}`} style={{ fontWeight: 700 }}>
              {group == null
                ? 'Teilgruppe offen'
                : group === 'none'
                  ? 'Ohne Beeinträchtigung'
                  : `Teilgruppe ${group}`}
            </span>
            {patient.hkpCode && <span className="tag tag-accent">Teilgruppe D · HKP {patient.hkpCode}</span>}
            {patient.latestActionNeeded && <span className="tag tag-accent">Handlungsbedarf</span>}
          </div>
          <p className="cd-muted" style={{ margin: '6px 0 0' }}>
            {patient.diagnosis || 'Ohne Diagnose'} · {formatDateDE(patient.birthDate)}
            {age ? ` (${age})` : ''} · {group ? TEILGRUPPE_SHORT[group] : 'Gutachten-Daten fehlen'}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 14 }}>{patient.note || 'Keine Notiz.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            Bearbeiten
          </button>
          <button type="button" className="btn btn-primary" onClick={onNewVisit}>
            <Icon name="plus" size={16} />
            Neue Visite
          </button>
        </div>
      </header>

      <section>
        <h3 className="cd-h3" style={{ marginBottom: 4 }}>
          Gutachten &amp; Teilgruppe
        </h3>
        <p className="cd-muted-13" style={{ margin: '0 0 14px' }}>
          Grundlage für die Personenliste nach Anlage 7. Quelle: Pflegegrad-Gutachten (Modul 1 Mobilität ≥ 4 Punkte,
          Modul 2 Kognition ≥ 6 Punkte), nicht älter als ein Jahr — sonst eigene Einschätzung.
        </p>
        <div className="cd-fact-grid">
          {facts.map((fact) => (
            <div key={fact.label}>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{fact.label}</div>
              <div
                style={{ fontWeight: 600, color: fact.value === missing ? 'var(--bad-800)' : 'var(--color-text)' }}
              >
                {fact.value}
              </div>
            </div>
          ))}
        </div>
        {group != null && (
          <p className="cd-muted-13" style={{ margin: '14px 0 0' }}>
            {TEILGRUPPE_LABEL[group]}
          </p>
        )}
        <p style={{ margin: '18px 0 0', fontSize: 14, fontWeight: 600, color: dueColor(due.daysUntilDue) }}>
          {due.overdue
            ? `Nächste Pflegevisite überfällig seit ${-due.daysUntilDue} Tagen (fällig ${formatDateDE(due.dueDate)}).`
            : `Nächste Pflegevisite fällig am ${formatDateDE(due.dueDate)} — ${due.label}.`}
        </p>
      </section>

      <section>
        <h3 className="cd-h3" style={{ marginBottom: 12 }}>
          Pflegevisiten
        </h3>
        <div className="cd-panel">
          {visits.length === 0 && <div className="cd-empty">Noch keine Visite dokumentiert.</div>}
          {visits.map((visit) => (
            <button key={visit.id} type="button" className="cd-item" onClick={() => onSelectVisit(visit)}>
              <span
                className="cd-dot-lg"
                style={{
                  background: visit.actionNeeded ? 'var(--color-accent-500)' : 'var(--color-accent-2-300)',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{formatDateDE(visit.visitDate)}</div>
                <div className="cd-muted-13">{visit.comment || 'Ohne Beobachtung'}</div>
              </div>
              {visit.actionNeeded && (
                <span className="tag tag-accent" style={{ flex: 'none' }}>
                  Handlungsbedarf
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PatientDetail;
