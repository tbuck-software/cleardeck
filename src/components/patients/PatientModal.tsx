import Checkbox from '../ui/Checkbox';
import React from 'react';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
import BirthDateInput from '../ui/BirthDateInput';
import {
  HKP_SHORT,
  hkpCodesOf,
  needsAssessment,
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
      { value: NONE, label: 'unbekannt' },
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
      help={[
        {
          title: 'Welche Leistungen gehören zur MD-Liste?',
          body: 'Enthalten sind Leistungen nach §§ 36/39 SGB XI oder §§ 37/37c SGB V; pflegerische Betreuung nach § 36 gehört dazu. Ausgeschlossen: nur Haushalt nach SGB XI, nur § 45a/45b oder deren Kombination, sowie nur Beratung § 37 Abs. 3.',
        },
        {
          title: 'Kriterien für Mobilität und Kognition',
          body: 'Gutachten höchstens ein Jahr alt: Modul 1 ab 4, Modul 2 ab 6 ungewichteten Punkten. Sonst selbst einschätzen: körperlich bedingte personelle Hilfe bei Treppen und in der Wohnung; Kognition bei nahezu täglichen Störungen von Gedächtnis, Zeit, Ort oder Personenerkennung.',
        },
      ]}
      primaryLabel={modal.mode === 'edit' ? 'Speichern' : 'Anlegen'}
      primaryDisabled={!modal.name.trim()}
      onPrimary={onSave}
      deleteLabel={modal.mode === 'edit' && onDelete ? 'Versorgung beenden' : undefined}
      onDelete={onDelete}
      onClose={onClose}
    >
      <div className="cd-form-section">
        <p className="cd-form-legend">Versorgung</p>
        <div className="cd-field-grid">
          <div className="field">
            <label>Versorgungsstatus</label>
            <Segmented
              fill
              ariaLabel="Versorgungsstatus"
              options={[
                { value: 'active' as const, label: 'Aktiv' },
                { value: 'ended' as const, label: 'Beendet' },
              ]}
              value={modal.serviceStatus ?? 'active'}
              onChange={(serviceStatus) => onChange({ ...modal, serviceStatus })}
            />
          </div>
          <label className="cd-form-label">
            Versorgungsende
            <input
              className="input"
              type="date"
              value={modal.serviceEndDate ?? ''}
              onChange={(e) => onChange({ ...modal, serviceEndDate: e.target.value || null })}
            />
          </label>
          <div className="field cd-field-wide">
            <label>Leistungsumfang für Anlage 7</label>
            <Segmented
              fill
              wrap
              ariaLabel="Leistungsumfang für Anlage 7"
              options={[
                { value: 'unknown' as const, label: 'Noch zu prüfen' },
                { value: 'eligible' as const, label: 'Auf der Liste' },
                { value: 'excluded' as const, label: 'Ausgeschlossen' },
              ]}
              value={modal.serviceScope ?? 'unknown'}
              onChange={(serviceScope) => onChange({ ...modal, serviceScope })}
            />
          </div>
          <div className="field cd-field-wide">
            <label>Vertretung / Betreuung</label>
            <Segmented
              fill
              wrap
              ariaLabel="Vertretung / Betreuung"
              options={[
                { value: 'unknown' as const, label: 'Ungeklärt' },
                { value: 'present' as const, label: 'Vorhanden' },
                { value: 'none' as const, label: 'Keine vorhanden' },
              ]}
              value={modal.representativeStatus ?? 'unknown'}
              onChange={(representativeStatus) => onChange({ ...modal, representativeStatus })}
            />
          </div>
        </div>
      </div>

      <div className="cd-form-section">
        <p className="cd-form-legend">Stammdaten</p>
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
            <label htmlFor="patient-birthdate">Geburtsdatum</label>
            <BirthDateInput
              id="patient-birthdate"
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
            <label htmlFor="patient-contact">Kontakt der Vertretung</label>
            <input
              id="patient-contact"
              className="input"
              placeholder="Name und Telefon"
              value={modal.contact}
              onChange={(event) => onChange({ ...modal, contact: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="cd-form-section">
        <p className="cd-form-legend">Einstufung und Quelle</p>

        <div className="cd-field-grid">
          <div className="field cd-field-wide">
            <label>Quelle</label>
            <Segmented
              fill
              wrap
              ariaLabel="Quelle der Einstufung"
              options={[
                { value: 'unknown' as const, label: 'Unbekannt' },
                { value: 'report' as const, label: 'Pflegegrad-Gutachten' },
                { value: 'own' as const, label: 'Eigene Einschätzung' },
              ]}
              value={modal.assessmentSource ?? 'unknown'}
              onChange={(assessmentSource) => onChange({ ...modal, assessmentSource })}
            />
          </div>
          <label className="cd-form-label">
            Datum
            <input
              className="input"
              type="date"
              value={modal.assessmentDate ?? ''}
              onChange={(e) => onChange({ ...modal, assessmentDate: e.target.value || null })}
            />
          </label>
          <label className="cd-form-label cd-field-wide">
            Begründung
            <textarea
              className="input"
              value={modal.assessmentNote ?? ''}
              onChange={(e) => onChange({ ...modal, assessmentNote: e.target.value })}
            />
          </label>
          {needsAssessment(modal) && (
            <p role="status" className="cd-field-wide">
              Einstufung offen oder veraltet. Quelle, Datum und Merkmale prüfen.
            </p>
          )}
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
            <div className="cd-checkbox-group">
              {(['6', '8', '29', '31a'] as HkpCode[]).map((code) => (
                <Checkbox
                  key={code}
                  checked={hkpCodesOf(modal).includes(code)}
                  onChange={(event) => {
                    const codes = event.target.checked
                      ? [...hkpCodesOf(modal), code]
                      : hkpCodesOf(modal).filter((c) => c !== code);
                    onChange({ ...modal, hkpCodes: codes, hkpCode: codes[0] ?? null });
                  }}
                >
                  {code} {HKP_SHORT[code]}
                </Checkbox>
              ))}
            </div>
          </div>

          <div className="field cd-field-wide">
            <label>Mobilität (Modul 1)</label>
            <Segmented
              fill
              ariaLabel="Mobilität"
              options={mobility.options}
              value={mobility.value}
              onChange={(value) =>
                onChange({ ...modal, mobilityImpaired: value === NONE ? null : value === 'yes' })
              }
            />
          </div>

          <div className="field cd-field-wide">
            <label>Kognition (Modul 2)</label>
            <Segmented
              fill
              ariaLabel="Kognition"
              options={cognition.options}
              value={cognition.value}
              onChange={(value) =>
                onChange({ ...modal, cognitionImpaired: value === NONE ? null : value === 'yes' })
              }
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
              ...(['AKI', 'AKI-B', 'pHKP'] as IntensiveCare[]).map((value) => ({
                value,
                label: INTENSIVE_CARE_LABEL[value],
              })),
            ]}
            value={modal.intensiveCare ?? NONE}
            onChange={(value) =>
              onChange({
                ...modal,
                intensiveCare: value === NONE ? null : (value as IntensiveCare),
              })
            }
          />
          {modal.intensiveCare?.startsWith('pHKP') && (
            <p className="cd-muted-13" style={{ margin: '6px 0 0', fontSize: 12 }}>
              Erstverordnung nur, wenn der Verordnungsbeginn weniger als vier Wochen zurückliegt.
            </p>
          )}
        </div>

        {modal.intensiveCare?.startsWith('AKI') && (
          <div className="field">
            <label>Versorgungsform</label>
            <Segmented
              fill
              wrap
              ariaLabel="Versorgungsform"
              options={[
                { value: NONE, label: 'Unbekannt' },
                { value: 'EV', label: 'Einfachversorgung (EV)' },
                { value: 'MV', label: 'Mehrfachversorgung (MV)' },
              ]}
              value={modal.akiSetting ?? NONE}
              onChange={(value) =>
                onChange({ ...modal, akiSetting: value === NONE ? null : (value as 'EV' | 'MV') })
              }
            />
          </div>
        )}
        {modal.intensiveCare?.startsWith('pHKP') && (
          <div className="cd-field-grid">
            <Checkbox
              checked={modal.phkpFirst ?? false}
              onChange={(e) => onChange({ ...modal, phkpFirst: e.target.checked })}
            >
              Erstverordnung angekreuzt
            </Checkbox>
            <label className="cd-form-label">
              Vom-Datum der Verordnung
              <input
                className="input"
                type="date"
                value={modal.phkpStartDate ?? ''}
                onChange={(e) => onChange({ ...modal, phkpStartDate: e.target.value || null })}
              />
            </label>
            <p className="cd-muted-13">
              E wird nur mit Erstverordnung und einem weniger als vier Wochen zurückliegenden
              Vom-Datum exportiert.
            </p>
          </div>
        )}
        <div className="cd-group-preview">
          <span
            className={`tag ${group ? 'tag-accent-2' : 'tag-neutral'}`}
            style={{ fontWeight: 700 }}
          >
            {group == null ? '—' : group === 'none' ? 'ohne' : group}
          </span>
          <span>
            {group == null
              ? 'Teilgruppe offen — Mobilität und Kognition eintragen'
              : TEILGRUPPE_LABEL[group]}
            {hkpCodesOf(modal).length
              ? ` · zusätzlich D-Merkmal (HKP ${hkpCodesOf(modal).join(', ')})`
              : ''}
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
