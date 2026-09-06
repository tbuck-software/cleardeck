import Checkbox from '../ui/Checkbox';
import FieldHelp from '../ui/FieldHelp';
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
      primaryLabel={modal.mode === 'edit' ? 'Speichern' : 'Anlegen'}
      primaryDisabled={!modal.name.trim()}
      onPrimary={onSave}
      deleteLabel={modal.mode === 'edit' && onDelete ? 'Versorgung beenden' : undefined}
      onDelete={onDelete}
      onClose={onClose}
    >
      <div className="cd-field-grid">
        <label className="cd-form-label">
          Versorgungsstatus
          <select
            className="input"
            value={modal.serviceStatus ?? 'active'}
            onChange={(e) =>
              onChange({ ...modal, serviceStatus: e.target.value as 'active' | 'ended' })
            }
          >
            <option value="active">Aktiv</option>
            <option value="ended">Beendet / archiviert</option>
          </select>
        </label>
        <label className="cd-form-label">
          Versorgungsende
          <input
            className="input"
            type="date"
            value={modal.serviceEndDate ?? ''}
            onChange={(e) => onChange({ ...modal, serviceEndDate: e.target.value || null })}
          />
        </label>
        <label className="cd-form-label cd-field-wide">
          Leistungsumfang für Anlage 7
          <select
            className="input"
            value={modal.serviceScope ?? 'unknown'}
            onChange={(e) =>
              onChange({
                ...modal,
                serviceScope: e.target.value as 'eligible' | 'excluded' | 'unknown',
              })
            }
          >
            <option value="unknown">Noch zu prüfen</option>
            <option value="eligible">§§ 36/39 SGB XI oder §§ 37/37c SGB V</option>
            <option value="excluded">Ausschließlich ausgeschlossene Leistungen</option>
          </select>
        </label>
        <FieldHelp title="Welche Leistungen gehören zur MD-Liste?">
          Ausgeschlossen: nur Haushalt nach SGB XI, nur § 45a/45b oder deren Kombination, sowie nur
          Beratung § 37 Abs. 3. Pflegerische Betreuung nach § 36 gehört zur Liste.
        </FieldHelp>
        <label className="cd-form-label cd-field-wide">
          Vertretung / Betreuung
          <select
            className="input"
            value={modal.representativeStatus ?? 'unknown'}
            onChange={(e) =>
              onChange({
                ...modal,
                representativeStatus: e.target.value as 'present' | 'none' | 'unknown',
              })
            }
          >
            <option value="unknown">Ungeklärt</option>
            <option value="present">Vorhanden</option>
            <option value="none">Keine vorhanden</option>
          </select>
        </label>
      </div>
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
          Einstufung und Quelle
        </div>

        <div className="cd-field-grid">
          <label className="cd-form-label">
            Quelle
            <select
              className="input"
              value={modal.assessmentSource ?? 'unknown'}
              onChange={(e) =>
                onChange({
                  ...modal,
                  assessmentSource: e.target.value as 'report' | 'own' | 'unknown',
                })
              }
            >
              <option value="unknown">Unbekannt</option>
              <option value="report">Pflegegrad-Gutachten</option>
              <option value="own">Eigene Einschätzung</option>
            </select>
          </label>
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
          <FieldHelp title="Kriterien für Mobilität und Kognition">
            Gutachten höchstens ein Jahr alt: Modul 1 ab 4, Modul 2 ab 6 ungewichteten Punkten.
            Sonst selbst einschätzen: körperlich bedingte personelle Hilfe bei Treppen und in der
            Wohnung; Kognition bei nahezu täglichen Störungen von Gedächtnis, Zeit, Ort oder
            Personenerkennung.
          </FieldHelp>
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
          <label className="cd-form-label">
            Versorgungsform
            <select
              className="input"
              value={modal.akiSetting ?? ''}
              onChange={(e) =>
                onChange({ ...modal, akiSetting: (e.target.value || null) as 'EV' | 'MV' | null })
              }
            >
              <option value="">Unbekannt</option>
              <option value="EV">Einfachversorgung (EV)</option>
              <option value="MV">Mehrfachversorgung (MV)</option>
            </select>
          </label>
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
