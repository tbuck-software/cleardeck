import Checkbox from '../ui/Checkbox';
import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
import BirthDateInput from '../ui/BirthDateInput';
import {
  HKP_SHORT,
  hkpCodesOf,
  needsAssessment,
  serviceScopeOf,
  INTENSIVE_CARE_LABEL,
  SERVICE_SCOPE_LABEL,
  TEILGRUPPE_LABEL,
  teilgruppeOf,
} from '../../utils/qpr';
import type { HkpCode, IntensiveCare, ServiceDefinition, ServiceType } from '../../shared/types';
import { SERVICE_TYPE_LABEL, SERVICE_TYPES } from '../../shared/services';
import type { PatientModalState } from '../../types/ui';
import {
  CARE_LEVEL_OPTIONS,
  UNKNOWN_CARE_LEVEL_LABEL,
  isCareLevel,
} from '../../utils/careLevel';

/** Form controls need a concrete value, so null is carried as a sentinel. */
const NONE = '__none__';
const UNKNOWN_CARE_LEVEL = '__unknown_care_level__';

type PatientModalProps = {
  modal: PatientModalState;
  onChange: (next: PatientModalState) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  serviceDefinitions?: ServiceDefinition[];
};

const PatientModal = ({
  modal,
  serviceDefinitions = [],
  onChange,
  onClose,
  onSave,
  onDelete,
}: PatientModalProps) => {
  const group = teilgruppeOf(modal.cognitionImpaired, modal.mobilityImpaired);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<ServiceType[]>([]);
  const selectedServiceIds = modal.serviceDefinitionIds ?? [];
  const selectedServices = serviceDefinitions.filter(
    (definition) => definition.id != null && selectedServiceIds.includes(definition.id),
  );
  const serviceSource = modal.serviceScopeSource ?? 'services';
  const hasLegacyDecision = serviceSource === 'legacy' && selectedServiceIds.length === 0;
  const serviceDecision = hasLegacyDecision
    ? serviceScopeOf({ serviceScope: modal.serviceScope, serviceScopeSource: 'legacy' })
    : serviceScopeOf({
        serviceScope: 'unknown',
        serviceScopeSource: 'services',
        services: selectedServices.map((definition) => ({
          serviceDefinitionId: definition.id as number,
          label: definition.name,
          serviceType: definition.serviceType,
        })),
      });
  const activeDefinitions = serviceDefinitions.filter(
    (definition) => definition.active !== false || selectedServiceIds.includes(definition.id ?? -1),
  );
  const normalizedSearch = serviceSearch.trim().toLocaleLowerCase();
  const filteredDefinitions = activeDefinitions.filter(
    (entry) => !normalizedSearch || entry.name.toLocaleLowerCase().includes(normalizedSearch),
  );
  const groupsWithSelection = SERVICE_TYPES.filter((serviceType) =>
    activeDefinitions.some(
      (entry) =>
        entry.serviceType === serviceType &&
        entry.id != null &&
        selectedServiceIds.includes(entry.id),
    ),
  );
  const autoOpenGroups = SERVICE_TYPES.filter(
    (serviceType) =>
      groupsWithSelection.includes(serviceType) ||
      (normalizedSearch.length > 0 &&
        filteredDefinitions.some((entry) => entry.serviceType === serviceType)),
  );
  const autoOpenKey = autoOpenGroups.join(',');
  // The dialog stays mounted, so the picker has to be emptied per patient.
  useEffect(() => {
    setServicesExpanded(false);
    setServiceSearch('');
    setOpenGroups(groupsWithSelection);
  }, [modal.open, modal.id]);
  // Groups open when they gain a selection or a search hit; a group the user
  // closed stays closed until that set changes again.
  useEffect(() => {
    setOpenGroups((previous) =>
      autoOpenGroups.every((serviceType) => previous.includes(serviceType))
        ? previous
        : [...new Set([...previous, ...autoOpenGroups])],
    );
  }, [autoOpenKey]);
  const selectedSummary =
    selectedServices.length === 0
      ? hasLegacyDecision
        ? 'Übernommene Entscheidung'
        : 'Noch nicht erfasst'
      : `${selectedServices
          .slice(0, 2)
          .map((service) => service.name)
          .join(', ')}${selectedServices.length > 2 ? ` + ${selectedServices.length - 2} weitere` : ''}`;
  const toggleService = (id: number) => {
    const nextIds = selectedServiceIds.includes(id)
      ? selectedServiceIds.filter((current) => current !== id)
      : [...selectedServiceIds, id];
    onChange({ ...modal, serviceDefinitionIds: nextIds, serviceScopeSource: 'services' });
  };
  const clearServicesAsUnknown = () =>
    onChange({ ...modal, serviceDefinitionIds: [], serviceScopeSource: 'services' });

  const impairmentOptions = (current: boolean | null) => ({
    value: current == null ? NONE : current ? 'yes' : 'no',
    options: [
      { value: NONE, label: 'Unbekannt' },
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
          body: 'Die QPR nennt dafür die Leistungen nach § 36 und § 39 SGB XI sowie § 37 und § 37c SGB V. Nur Haushaltshilfe, nur § 45a/45b oder nur ein Beratungsbesuch nach § 37 Abs. 3 werden ausgeschlossen. Die Anlage 7 ist die daraus erstellte Personenliste.',
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
            <details
              className="cd-service-picker"
              open={servicesExpanded}
              onToggle={(event) => setServicesExpanded(event.currentTarget.open)}
            >
              <summary>
                <span>Welche Leistungen erbringt euer Dienst für diese Person?</span>
                <span className="cd-service-summary" title={selectedSummary}>
                  {selectedSummary}
                </span>
              </summary>
              <div className="cd-service-picker-body">
                <p className="cd-muted-13" style={{ margin: '0 0 8px' }}>
                  Mehrere Leistungen auswählen. Die Einordnung für die MD-Personenliste ergibt sich
                  daraus.
                </p>
                <input
                  className="input cd-service-search"
                  type="search"
                  aria-label="Leistungen durchsuchen"
                  placeholder="Leistungen durchsuchen"
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                />
                <div className="cd-service-choice-list">
                  {SERVICE_TYPES.map((serviceType) => {
                    const entries = filteredDefinitions.filter((entry) => entry.serviceType === serviceType);
                    if (!entries.length) return null;
                    return (
                      <details
                        key={serviceType}
                        className="cd-service-choice-group"
                        open={openGroups.includes(serviceType)}
                        onToggle={(event) =>
                          setOpenGroups((previous) =>
                            event.currentTarget.open
                              ? [...new Set([...previous, serviceType])]
                              : previous.filter((current) => current !== serviceType),
                          )
                        }
                      >
                        <summary>
                          {SERVICE_TYPE_LABEL[serviceType]}
                          <span className="cd-muted-13">{entries.length}</span>
                        </summary>
                        <div className="cd-checkbox-group">
                          {entries.map((entry) => (
                            <Checkbox
                              key={entry.id}
                              checked={entry.id != null && selectedServiceIds.includes(entry.id)}
                              onChange={() => {
                                if (entry.id != null) toggleService(entry.id);
                              }}
                            >
                              {entry.name}
                              {entry.active === false ? ' (inaktiv)' : ''}
                            </Checkbox>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                  {normalizedSearch.length > 0 && filteredDefinitions.length === 0 ? (
                    <p className="cd-muted-13" role="status">
                      Keine Leistungen gefunden.
                    </p>
                  ) : null}
                </div>
                {hasLegacyDecision && (
                  <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
                    Es gilt noch eine übernommene Entscheidung. Sie wird verworfen, sobald
                    Leistungen ausgewählt oder als unbekannt geführt werden.
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-pressed={!hasLegacyDecision && selectedServiceIds.length === 0}
                  onClick={clearServicesAsUnknown}
                >
                  {hasLegacyDecision
                    ? 'Übernommene Entscheidung verwerfen'
                    : 'Leistungen noch unbekannt'}
                </button>
              </div>
            </details>
            <div className="cd-group-preview" role="status">
              <span
                className={`tag ${serviceDecision.scope === 'eligible' ? 'tag-ok' : serviceDecision.scope === 'excluded' ? 'tag-neutral' : 'tag-accent'}`}
                style={{ fontWeight: 700 }}
              >
                {SERVICE_SCOPE_LABEL[serviceDecision.scope]}
              </span>
              <span>{serviceDecision.reason}</span>
            </div>
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
          <div className="field cd-field-wide">
            <label>Pflegegrad</label>
            <select
              className="input"
              aria-label="Pflegegrad"
              value={modal.careLevel == null ? UNKNOWN_CARE_LEVEL : String(modal.careLevel)}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onChange({
                  ...modal,
                  careLevel: isCareLevel(parsed) ? parsed : null,
                });
              }}
            >
              <option value={UNKNOWN_CARE_LEVEL}>{UNKNOWN_CARE_LEVEL_LABEL}</option>
              {CARE_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field cd-field-wide">
            <p className="cd-muted-13" style={{ margin: '0 0 8px' }}>
              Besondere Merkmale für die MD-Stichprobe: vorhandene HKP-Ziffern separat auswählen;
              aus den erbrachten Leistungen werden sie nicht abgeleitet.
            </p>
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
