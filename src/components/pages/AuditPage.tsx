import HelpPopover from '../ui/HelpPopover';
import { localDate } from '../../utils/calendarDate';
import React from 'react';
import Icon from '../ui/Icon';
import { formatDateDE } from '../../utils/dateFormat';
import {
  TEILGRUPPE_TARGET,
  teilgruppeOf,
  visitDue,
  isActivePatient,
  needsAssessment,
  hkpCodesOf,
  representativeMissing,
  serviceScopeOf,
} from '../../utils/qpr';
import type { AuditResult, AuditWithDetails, PatientWithLatestVisit } from '../../shared/types';

/** Weakest QB 1–3 letter — mirrors worstResult() in the repository. */
const worstOf = (results: AuditResult[]): 'A' | 'B' | 'C' | 'D' | null => {
  const letters = results.map((row) => row.result);
  return (['D', 'C', 'B', 'A'] as const).find((letter) => letters.includes(letter)) ?? null;
};

/** A handful of names is a hint; forty is a wall. */
const NAMES_SHOWN = 4;

const nameList = (names: string[]): string =>
  names.length <= NAMES_SHOWN
    ? names.join(', ')
    : `${names.slice(0, NAMES_SHOWN).join(', ')} und ${names.length - NAMES_SHOWN} weitere`;

const RESULT_TAG: Record<string, string> = {
  A: 'tag-ok',
  B: 'tag-accent-2',
  C: 'tag-accent',
  D: 'tag-bad',
};

type AuditPageProps = {
  patients: PatientWithLatestVisit[];
  audits: AuditWithDetails[];
  visitIntervalDays: number;
  onCreateAudit: () => void;
  onOpenAudit: (audit: AuditWithDetails) => void;
  onExportPersonList: () => void;
  onGoPatients: () => void;
  onOpenPatient: (id: number) => void;
};

const AuditPage = ({
  patients: allPatients,
  audits,
  visitIntervalDays,
  onCreateAudit,
  onOpenAudit,
  onExportPersonList,
  onGoPatients,
  onOpenPatient,
}: AuditPageProps) => {
  const today = localDate();

  const activePatients = allPatients.filter((p) => isActivePatient(p, today));
  const unknownScope = activePatients.filter((p) => serviceScopeOf(p).scope === 'unknown');
  const patients = activePatients.filter((p) => serviceScopeOf(p).scope === 'eligible');
  const unrated = patients.filter((patient) => needsAssessment(patient, today));
  const missingVisitDate = patients.filter(
    (patient) => visitDue(patient, today, visitIntervalDays).missingAnchor,
  );
  const overdue = patients.filter((patient) => visitDue(patient, today, visitIntervalDays).overdue);
  const missingContact = patients.filter(representativeMissing);
  const countOf = (group: 'A' | 'B' | 'C') =>
    patients.filter(
      (patient) =>
        !needsAssessment(patient, today) &&
        teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) === group,
    ).length;
  const countD = patients.filter((patient) => hkpCodesOf(patient).length > 0).length;
  const countNone = patients.filter(
    (patient) =>
      !needsAssessment(patient, today) &&
      teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) === 'none' &&
      hkpCodesOf(patient).length === 0,
  ).length;
  const intensiveCare = patients.filter((patient) => patient.intensiveCare != null).length;

  const latest = audits.find((audit) => audit.confirmed);

  const checks = [
    {
      id: 'scope',
      title: unknownScope.length
        ? `${unknownScope.length} aktive Personen mit ungeklärtem Leistungsumfang`
        : 'Leistungsumfang der aktiven Personen geklärt',
      sub: unknownScope.length
        ? `${nameList(unknownScope.map((p) => p.name))} · Stammdaten öffnen und erbrachte Leistungen auswählen`
        : '',
      dot: unknownScope.length ? 'var(--bad-800)' : 'var(--ok-800)',
      go: onGoPatients,
    },
    {
      id: 'assessment',
      title: unrated.length
        ? `${unrated.length} ${unrated.length === 1 ? 'Klient:in' : 'Klient:innen'} ohne Gutachten-Daten`
        : 'Alle Klient:innen haben Mobilität und Kognition hinterlegt',
      sub: unrated.length
        ? `${nameList(unrated.map((patient) => patient.name))} · Quelle und Datum prüfen`
        : '',
      dot: unrated.length ? 'var(--bad-800)' : 'var(--ok-800)',
      go:
        unrated.length && unrated[0].id != null
          ? () => onOpenPatient(unrated[0].id as number)
          : undefined,
    },
    {
      id: 'visits',
      title: missingVisitDate.length
        ? `${missingVisitDate.length} Personen ohne Aufnahme- oder Visitendatum`
        : overdue.length
          ? `${overdue.length} ${overdue.length === 1 ? 'Pflegevisite' : 'Pflegevisiten'} überfällig`
          : 'Alle Pflegevisiten aktuell',
      sub: overdue.length ? nameList(overdue.map((patient) => patient.name)) : '',
      dot: overdue.length || missingVisitDate.length ? 'var(--color-accent-500)' : 'var(--ok-800)',
      go: missingVisitDate.length
        ? () => onOpenPatient(missingVisitDate[0].id as number)
        : overdue.length && overdue[0].id != null
          ? () => onOpenPatient(overdue[0].id as number)
          : undefined,
    },
    {
      id: 'contact',
      title: missingContact.length
        ? `${missingContact.length} ${missingContact.length === 1 ? 'Person' : 'Personen'} ohne Bevollmächtigte/Betreuung`
        : 'Kontakte für die Personenliste vollständig',
      sub: missingContact.length ? 'Vertretung klären oder Name und Telefon ergänzen' : '',
      dot: missingContact.length ? 'var(--color-neutral-500)' : 'var(--ok-800)',
      go: onGoPatients,
    },
    {
      id: 'sample',
      title: `Allgemeine Pflege, Merkmalsbestand: A ${countOf('A')}/${TEILGRUPPE_TARGET.A} · B ${countOf('B')}/${TEILGRUPPE_TARGET.B} · C ${countOf('C')}/${TEILGRUPPE_TARGET.C} · D (HKP) ${countD}/${TEILGRUPPE_TARGET.D}${intensiveCare ? ` · AKI/pHKP ${intensiveCare}` : ''}`,
      sub: 'Verfügbare Personen, keine Ziehung. Sollzahlen nur für allgemeine Pflege.',
      dot: 'var(--ok-800)',
      go: onGoPatients,
    },
  ];

  return (
    <div className="cd-page cd-medium">
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            MD-Prüfung
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            Qualitätsprüfung nach QPR ambulant
            {latest
              ? ` · letzte Prüfung ${formatDateDE(latest.auditDate)}`
              : ' · noch keine bestätigte Prüfung'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HelpPopover
            heading="MD-Prüfung"
            entries={[
              {
                title: 'Personenliste und Stichprobe',
                body: (
                  <>
                    Personenliste nach Anlage 7: alphabetisch alle Personen mit Leistungen nach
                    §§ 36/39 SGB XI beziehungsweise §§ 37/37c SGB V. Enthalten sind Name,
                    gegebenenfalls Vertretung mit Telefon, Teilgruppe A/B/C, aufwändige
                    HKP-Ziffern und AKI/pHKP. Ausnahmen erläutert das Personenformular. Die Liste
                    wird nach Ankündigung erstellt und zu Prüfungsbeginn vorgelegt. Regelprüfungen
                    werden grundsätzlich zwei Arbeitstage vorher angekündigt; Anlassprüfungen
                    sollen unangemeldet erfolgen.
                    <p>
                      Die Sollzahlen gelten nur nach Kapitel 8.1. Bei AKI-/pHKP-Verträgen gelten
                      Kapitel 8.2/8.3; deren Auswahl berechnet ClearDeck nicht. Der MD zieht
                      zuerst je zwei Personen aus A, B und C, danach drei weitere aus D.
                      Unterbesetzte Gruppen werden nicht aufgefüllt. {countNone} Personen ohne
                      Beeinträchtigung und ohne aufwändige HKP sind nicht stichprobenrelevant.
                    </p>
                  </>
                ),
              },
              {
                title: 'Bewertung und Originalbericht',
                body: 'QB 1–3 werden je Qualitätsaspekt mit A–D bewertet (A keine Auffälligkeiten · B ohne Risiko · C Defizit mit Risiko · D Defizit mit eingetretener Folge), QB 4 beschreibend, QB 5 erfüllt / nicht erfüllt, Abrechnung nach Auffälligkeiten. Der Buchstabe in der Liste ist das schwächste Ergebnis aus QB 1–3 — im Prüfbericht stehen die Ergebnisse je Qualitätsaspekt und Person (P1–PX). ClearDeck erfasst hier nur eine interne Zusammenfassung mit Referenz zum vollständigen Originalbericht.',
              },
            ]}
          />
          <button type="button" className="btn btn-secondary" onClick={onCreateAudit}>
            Prüfung erfassen
          </button>
          <button type="button" className="btn btn-primary" onClick={onExportPersonList}>
            <Icon name="download" size={16} />
            Personenliste (Anlage 7) exportieren
          </button>
        </div>
      </header>

      <section>
        <h3 className="cd-h3" style={{ marginBottom: 12 }}>
          Vorbereitung
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {checks.map((check) => (
            <button
              key={check.id}
              type="button"
              className="cd-item"
              style={{ borderRadius: 'var(--radius-md)' }}
              disabled={!check.go}
              onClick={check.go}
            >
              <span className="cd-dot-lg" style={{ background: check.dot }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{check.title}</div>
                {check.sub && <div className="cd-muted-13">{check.sub}</div>}
              </div>
              {check.go && <span className="cd-arrow">→</span>}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="cd-h3" style={{ marginBottom: 12 }}>
          Prüfungen
        </h3>
        <div className="cd-panel">
          {audits.length === 0 && (
            <div className="cd-empty">
              Noch keine Prüfung erfasst. Ergebnisse aus dem Prüfbericht eintragen.
            </div>
          )}
          {audits.map((audit) => {
            const graded = audit.results.filter((row) => ['A', 'B', 'C', 'D'].includes(row.result));
            const overall = audit.confirmed ? worstOf(graded) : null;
            const unmet = audit.results.filter((row) => row.result === 'no').length;
            return (
              <button
                key={audit.id}
                type="button"
                className="cd-item"
                onClick={() => onOpenAudit(audit)}
              >
                <span
                  className={`tag ${RESULT_TAG[overall ?? ''] ?? 'tag-neutral'}`}
                  style={{ flex: 'none', fontWeight: 700, width: 34, justifyContent: 'center' }}
                >
                  {overall ?? '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{formatDateDE(audit.auditDate)}</div>
                  <div className="cd-muted-13">
                    {audit.inspector || 'Ohne Prüfstelle'} ·{' '}
                    {audit.confirmed
                      ? `Interne Zusammenfassung, höchste erfasste Defizitstufe ${overall ?? 'offen'}`
                      : 'Entwurf / unbestätigter Altstand'}
                    {unmet ? ` · ${unmet} Kriterium nicht erfüllt` : ''} · {audit.clientIds.length}{' '}
                    Klient:innen
                  </div>
                </div>
                <span className="cd-arrow">→</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AuditPage;
