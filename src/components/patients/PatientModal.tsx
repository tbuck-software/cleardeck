import React from 'react';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
import BirthDateInput from '../ui/BirthDateInput';
import {
  HKP_SHORT,
  INTENSIVE_CARE_LABEL,
  TEILGRUPPE_LABEL,
  teilgruppeOf,
} from '../../utils/qpr';
import type { HkpCode, IntensiveCare } from '../../shared/types';
import type { PatientModalState } from '../../types/ui';

/** Segmented controls need a concrete value, so null is carried as a sentinel. */
const NONE = '__none__';

type PatientModalProps = {
  modal: PatientModalState;
  onChange: (next: PatientModalState) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

const PatientModal = ({ modal, onChange, onClose, onSave, onDelete }: PatientModalProps) => {
  const group = teilgruppeOf(modal.cognitionImpaired, modal.mobilityImpaired);

  const impairmentOptions = (current: boolean | null) => ({
    value: current == null ? NONE : current ? 'yes' : 'no',
    options: [
      { value: 'no', label: 'nicht eingeschränkt' },
      { value: 'yes', label: 'eingeschränkt' },
    ],
  });

  const cognition = impairmentOptions(modal.cognitionImpaired);
  const mobility = impairmentOptions(modal.mobilityImpaired);

  return (
    <Dialog
      open={modal.open}
      width={560}
      title={modal.mode === 'edit' ? 'Patient:in bearbeiten' : 'Patient:in anlegen'}
      subtitle={
        modal.mode === 'edit'
          ? 'Stammdaten ändern — Visiten bleiben erhalten.'
          : 'Stammdaten erfassen, Visiten folgen auf der Detailseite.'
      }
      primaryLabel={modal.mode === 'edit' ? 'Speichern' : 'Anlegen'}
      primaryDisabled={!modal.name.trim()}
      onPrimary={onSave}
      deleteLabel={modal.mode === 'edit' && onDelete ? 'Löschen' : undefined}
      onDelete={onDelete}
      onClose={onClose}
    >
      <div className="cd-field-grid">
        <div className="field cd-field-wide">
          <label htmlFor="patient-name">Name</label>
          <input
            id="patient-name"
            className="input"
            placeholder="Vor- und Nachname"
            value={modal.name}
            onChange={(event) => onChange({ ...modal, name: event.target.value })}
          />
        </div>
        <div className="field">
          <label>Geburtsdatum</label>
          <BirthDateInput
            value={modal.birthDate}
            onChange={(birthDate) => onChange({ ...modal, birthDate })}
          />
        </div>
        <div className="field">
          <label htmlFor="patient-admission">Aufnahme</label>
          <input
            id="patient-admission"
            className="input"
            type="date"
            value={modal.admissionDate}
            onChange={(event) => onChange({ ...modal, admissionDate: event.target.value })}
          />
        </div>
        <div className="field cd-field-wide">
          <label htmlFor="patient-diagnosis">Diagnose(n)</label>
          <input
            id="patient-diagnosis"
            className="input"
            placeholder="z. B. Demenz, Hypertonie"
            value={modal.diagnosis}
            onChange={(event) => onChange({ ...modal, diagnosis: event.target.value })}
          />
        </div>
        <div className="field cd-field-wide">
          <label htmlFor="patient-contact">Bevollmächtigte / betreuende Person mit Telefon</label>
          <input
            id="patient-contact"
            className="input"
            placeholder="Name (Bezug) · Telefon — steht auf der Personenliste für den MD"
            value={modal.contact}
            onChange={(event) => onChange({ ...modal, contact: event.target.value })}
          />
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-divider)',
          paddingTop: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--color-neutral-700)',
          }}
        >
          Aus dem Pflegegrad-Gutachten
        </div>

        <div className="cd-field-grid">
          <div className="field">
            <label>Pflegegrad</label>
            <Segmented
              fill
              ariaLabel="Pflegegrad"
              options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
              value={modal.careLevel ?? 0}
              onChange={(careLevel) => onChange({ ...modal, careLevel })}
            />
          </div>

          <div className="field cd-field-wide">
            <label>Aufwändige HKP-Leistung (Ziffer)</label>
            <Segmented
              fill
              wrap
              ariaLabel="Aufwändige HKP-Leistung"
              options={[
                { value: NONE, label: 'keine' },
                ...(['6', '8', '29', '31a'] as HkpCode[]).map((code) => ({
                  value: code,
                  label: `${code} ${HKP_SHORT[code]}`,
                })),
              ]}
              value={modal.hkpCode ?? NONE}
              onChange={(value) =>
                onChange({ ...modal, hkpCode: value === NONE ? null : (value as HkpCode) })
              }
            />
          </div>

          <div className="field">
            <label>Mobilität (Modul 1)</label>
            <Segmented
              fill
              ariaLabel="Mobilität"
              options={mobility.options}
              value={mobility.value}
              onChange={(value) => onChange({ ...modal, mobilityImpaired: value === 'yes' })}
            />
          </div>

          <div className="field">
            <label>Kognition (Modul 2)</label>
            <Segmented
              fill
              ariaLabel="Kognition"
              options={cognition.options}
              value={cognition.value}
              onChange={(value) => onChange({ ...modal, cognitionImpaired: value === 'yes' })}
            />
          </div>
        </div>

        <div className="field">
          <label>Außerklinische Intensivpflege / psychiatrische HKP</label>
          <Segmented
            fill
            wrap
            ariaLabel="AKI / pHKP"
            options={[
              { value: NONE, label: 'keine' },
              ...(['AKI', 'AKI-B', 'pHKP', 'pHKP-EV'] as IntensiveCare[]).map((value) => ({
                value,
                label: INTENSIVE_CARE_LABEL[value],
              })),
            ]}
            value={modal.intensiveCare ?? NONE}
            onChange={(value) =>
              onChange({ ...modal, intensiveCare: value === NONE ? null : (value as IntensiveCare) })
            }
          />
          <p className="cd-muted-13" style={{ margin: '6px 0 0', fontSize: 12 }}>
            Erstverordnung nur, wenn der Verordnungsbeginn weniger als vier Wochen zurückliegt.
          </p>
        </div>

        <div className="cd-group-preview">
          <span className={`tag ${group ? 'tag-accent-2' : 'tag-neutral'}`} style={{ fontWeight: 700 }}>
            {group == null ? '—' : group === 'none' ? 'ohne' : group}
          </span>
          <span>
            {group == null
              ? 'Teilgruppe offen — Mobilität und Kognition eintragen'
              : TEILGRUPPE_LABEL[group]}
            {modal.hkpCode ? ` · zusätzlich Teilgruppe D (HKP ${modal.hkpCode})` : ''}
          </span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="patient-note">Notiz</label>
        <textarea
          id="patient-note"
          className="input"
          style={{ minHeight: 60 }}
          placeholder="Ansprechpartner, Besonderheiten"
          value={modal.note}
          onChange={(event) => onChange({ ...modal, note: event.target.value })}
        />
      </div>
    </Dialog>
  );
};

export default PatientModal;
