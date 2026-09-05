import React from 'react';
import Icon from '../ui/Icon';
import { formatDateDE } from '../../utils/dateFormat';
import { TEILGRUPPE_TARGET, teilgruppeOf, visitDue } from '../../utils/qpr';
import type { AuditResult, AuditWithDetails, PatientWithLatestVisit } from '../../shared/types';

/** Weakest QB 1–3 letter — mirrors worstResult() in the repository. */
const worstOf = (results: AuditResult[]): 'A' | 'B' | 'C' | 'D' => {
  const letters = results.map((row) => row.result);
  return (['D', 'C', 'B', 'A'] as const).find((letter) => letters.includes(letter)) ?? 'A';
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
  patients,
  audits,
  visitIntervalDays,
  onCreateAudit,
  onOpenAudit,
  onExportPersonList,
  onGoPatients,
  onOpenPatient,
}: AuditPageProps) => {
  const today = new Date().toISOString().slice(0, 10);

  const unrated = patients.filter(
    (patient) => teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) == null,
  );
  const overdue = patients.filter(
    (patient) =>
      visitDue(
        { latestVisitDate: patient.latestVisitDate, admissionDate: patient.admissionDate },
        today,
        visitIntervalDays,
      ).overdue,
  );
  const missingContact = patients.filter((patient) => !patient.contact?.trim());
  const countOf = (group: 'A' | 'B' | 'C') =>
    patients.filter((patient) => teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) === group).length;
  const countD = patients.filter((patient) => patient.hkpCode != null).length;
  const countNone = patients.filter(
    (patient) => teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) === 'none',
  ).length;
  const intensiveCare = patients.filter((patient) => patient.intensiveCare != null).length;

  const latest = audits[0];

  const checks = [
    {
      id: 'assessment',
      title: unrated.length
        ? `${unrated.length} ${unrated.length === 1 ? 'Klient:in' : 'Klient:innen'} ohne Gutachten-Daten`
        : 'Alle Klient:innen haben Mobilität und Kognition hinterlegt',
      sub: unrated.length
        ? `${nameList(unrated.map((patient) => patient.name))} — Modul 1/2 aus dem Gutachten eintragen; fehlt es oder ist es älter als ein Jahr, selbst einschätzen`
        : 'Aus dem Pflegegrad-Gutachten (Modul 1 ≥ 4 Punkte, Modul 2 ≥ 6 Punkte) oder eigener Einschätzung',
      dot: unrated.length ? 'var(--bad-800)' : 'var(--ok-800)',
      go: unrated.length && unrated[0].id != null ? () => onOpenPatient(unrated[0].id as number) : undefined,
    },
    {
      id: 'visits',
      title: overdue.length
        ? `${overdue.length} ${overdue.length === 1 ? 'Pflegevisite' : 'Pflegevisiten'} überfällig`
        : 'Alle Pflegevisiten aktuell',
      sub: overdue.length
        ? `${nameList(overdue.map((patient) => patient.name))} — Fachgespräch und Dokumentation zählen gleichrangig`
        : `Alle innerhalb von ${visitIntervalDays} Tagen`,
      dot: overdue.length ? 'var(--color-accent-500)' : 'var(--ok-800)',
      go: overdue.length && overdue[0].id != null ? () => onOpenPatient(overdue[0].id as number) : undefined,
    },
    {
      id: 'contact',
      title: missingContact.length
        ? `${missingContact.length} ${missingContact.length === 1 ? 'Person' : 'Personen'} ohne Bevollmächtigte/Betreuung`
        : 'Kontakte für die Personenliste vollständig',
      sub: 'Anlage 7 verlangt Name und Telefon der bevollmächtigten oder betreuenden Person, sofern vorhanden — sonst leer lassen',
      dot: missingContact.length ? 'var(--color-neutral-500)' : 'var(--ok-800)',
      go: onGoPatients,
    },
    {
      id: 'sample',
      title: `Stichprobe: A ${countOf('A')}/${TEILGRUPPE_TARGET.A} · B ${countOf('B')}/${TEILGRUPPE_TARGET.B} · C ${countOf('C')}/${TEILGRUPPE_TARGET.C} · D (HKP) ${countD}/${TEILGRUPPE_TARGET.D}${intensiveCare ? ` · AKI/pHKP ${intensiveCare}` : ''}`,
      sub: `Der MD zieht je 2 aus A, B, C und danach 3 aus D (HKP, noch nicht gezogen) — bis zu 9; unterbesetzte Teilgruppen werden nicht aufgefüllt, die Unterschreitung steht im Prüfbericht. ${countNone} Personen ohne Beeinträchtigung und ohne HKP sind nicht stichprobenrelevant.`,
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
            {latest ? ` · letzte Prüfung ${formatDateDE(latest.auditDate)}` : ' · noch keine Prüfung erfasst'} ·
            Regelprüfung wird zwei Arbeitstage vorher angekündigt (§ 114a SGB XI), Anlassprüfungen unangemeldet
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onCreateAudit}>
            Prüfung erfassen
          </button>
          <button type="button" className="btn btn-primary" onClick={onExportPersonList}>
            <Icon name="download" size={16} />
            Personenliste (Anlage 7) exportieren
          </button>
        </div>
      </header>

      <p className="cd-muted-14" style={{ margin: '-16px 0 0', maxWidth: 720 }}>
        Personenliste nach Anlage 7: alphabetisch alle Personen mit Leistungen nach §§ 36/39 SGB XI bzw. §§ 37/37c
        SGB V — Name, Bevollmächtigte/Betreuung mit Telefon, Teilgruppe A/B/C, aufwändige HKP mit Ziffer, AKI/pHKP.
        Wird nach der Ankündigung erstellt und zu Prüfungsbeginn vorgelegt.
      </p>

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
                <div className="cd-muted-13">{check.sub}</div>
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
            <div className="cd-empty">Noch keine Prüfung erfasst. Ergebnisse aus dem Prüfbericht eintragen.</div>
          )}
          {audits.map((audit) => {
            const graded = audit.results.filter((row) => ['A', 'B', 'C', 'D'].includes(row.result));
            const overall = worstOf(graded);
            const unmet = audit.results.filter((row) => row.result === 'no').length;
            return (
              <button key={audit.id} type="button" className="cd-item" onClick={() => onOpenAudit(audit)}>
                <span
                  className={`tag ${RESULT_TAG[overall]}`}
                  style={{ flex: 'none', fontWeight: 700, width: 34, justifyContent: 'center' }}
                >
                  {overall}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{formatDateDE(audit.auditDate)}</div>
                  <div className="cd-muted-13">
                    {audit.inspector || 'Ohne Prüfstelle'} · QB 1–3 bis {overall}
                    {unmet ? ` · ${unmet} Kriterium nicht erfüllt` : ''} · {audit.clientIds.length} Klient:innen
                  </div>
                </div>
                <span className="cd-arrow">→</span>
              </button>
            );
          })}
        </div>
        <p className="cd-muted-13" style={{ margin: '12px 0 0' }}>
          QB 1–3 werden je Qualitätsaspekt mit A–D bewertet (A keine Auffälligkeiten · B ohne Risiko · C Defizit mit
          Risiko · D Defizit mit eingetretener Folge), QB 4 beschreibend, QB 5 erfüllt / nicht erfüllt, Abrechnung nach
          Auffälligkeiten. Der Buchstabe in der Liste ist das schwächste Ergebnis aus QB 1–3 — im Prüfbericht stehen die
          Ergebnisse je Qualitätsaspekt und Person (P1–P9).
        </p>
      </section>
    </div>
  );
};

export default AuditPage;
