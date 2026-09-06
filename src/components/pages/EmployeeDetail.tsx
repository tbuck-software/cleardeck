import { localDate } from '../../utils/calendarDate';
import React from 'react';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import Segmented from '../ui/Segmented';
import { formatDateDE } from '../../utils/dateFormat';
import { daysBetween } from '../../utils/qpr';
import type {
  EmployeeCompetency,
  EmployeeInstruction,
  EmployeeWithPeriod,
} from '../../shared/types';
import type { TimelineItem } from '../../types/ui';

export type DetailTab = 'comp' | 'instr' | 'hist';

/** Level 0 means "not yet assessed"; 1–5 follow the Kompetenzmatrix. */
export const COMPETENCY_LEVELS = [
  'Offen',
  'Stufe 1',
  'Stufe 2',
  'Stufe 3',
  'Stufe 4',
  'Stufe 5',
  'Abgeschlossen',
];

const fte2 = (value: number | null | undefined) =>
  value == null ? '—' : value.toFixed(2).replace('.', ',');

const instructionState = (
  instruction: EmployeeInstruction,
  today: string,
  reminderDays: number,
) => {
  if (instruction.completedAt)
    return {
      label: instruction.evidenceRef
        ? 'durchgeführt · Beleg verknüpft'
        : 'durchgeführt · Beleg fehlt',
      tagClass: instruction.evidenceRef ? 'tag-accent-2' : 'tag-neutral',
    };
  if (!instruction.dueDate) return { label: 'offen', tagClass: 'tag-neutral' };
  if (instruction.dueDate < today) return { label: 'überfällig', tagClass: 'tag-bad' };
  if (daysBetween(today, instruction.dueDate) <= reminderDays)
    return { label: 'bald fällig', tagClass: 'tag-accent' };
  return { label: 'offen', tagClass: 'tag-neutral' };
};

type EmployeeDetailProps = {
  employee: EmployeeWithPeriod;
  baseHours: number;
  instructionReminderDays?: number;
  tab: DetailTab;
  competencies: EmployeeCompetency[];
  instructions: EmployeeInstruction[];
  timelineItems: TimelineItem[];
  suggestedCompetencyCount: number;
  /** 0 disables the add button and explains why, instead of leaving it dead. */
  availableCompetencyCount: number;
  availableInstructionCount: number;
  onTabChange: (tab: DetailTab) => void;
  onEdit: () => void;
  onAddCompetency: () => void;
  onAddInstruction: () => void;
  onOpenSuggestedCompetencies: () => void;
  onSelectCompetency: (competency: EmployeeCompetency) => void;
  onSelectInstruction: (instruction: EmployeeInstruction) => void;
  onStartNewPeriod: () => void;
  onSelectTimelineItem: (item: TimelineItem) => void;
};

const EmployeeDetail = ({
  employee,
  baseHours,
  instructionReminderDays = 30,
  tab,
  competencies,
  instructions,
  timelineItems,
  suggestedCompetencyCount,
  availableCompetencyCount,
  availableInstructionCount,
  onTabChange,
  onEdit,
  onAddCompetency,
  onAddInstruction,
  onOpenSuggestedCompetencies,
  onSelectCompetency,
  onSelectInstruction,
  onStartNewPeriod,
  onSelectTimelineItem,
}: EmployeeDetailProps) => {
  const today = localDate();
  const leaving = employee.status === 'active' && employee.endDate;
  const statusTag =
    employee.status === 'left'
      ? { tagClass: 'tag-neutral', label: 'ausgeschieden' }
      : leaving
        ? { tagClass: 'tag-accent', label: `Austritt ${formatDateDE(employee.endDate)}` }
        : { tagClass: 'tag-accent-2', label: 'aktiv' };

  const openCompetencies = competencies.filter(
    (entry) => entry.stageScheme !== 'practice-v1' || entry.level !== 6,
  ).length;
  const openInstructions = instructions.filter((entry) => !entry.completedAt).length;
  const openCount = openCompetencies + openInstructions;

  const endForTenure = employee.endDate && employee.endDate < today ? employee.endDate : today;
  const tenureYears = employee.startDate
    ? Math.floor(daysBetween(employee.startDate, endForTenure) / 365)
    : 0;

  return (
    <div className="cd-page cd-detail">
      <header className="cd-detail-header">
        <Avatar name={employee.name} size={72} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="cd-detail-title">
            <h1 className="cd-h1" style={{ marginTop: 0 }}>
              {employee.name}
            </h1>
            <span className={`tag ${statusTag.tagClass}`}>{statusTag.label}</span>
          </div>
          <p className="cd-muted" style={{ margin: '6px 0 0' }}>
            {employee.qualification} · seit {formatDateDE(employee.startDate)} ({tenureYears} Jahre)
          </p>
          {employee.note && <p style={{ margin: '10px 0 0', fontSize: 14 }}>{employee.note}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            <Icon name="edit" size={16} />
            Bearbeiten
          </button>
        </div>
      </header>

      {employee.hoursVerified === false && (
        <p role="status" className="cd-muted-13">
          Stunden und VZÄ noch ungeprüft. Personalbeleg unter „Bearbeiten“ bestätigen.
        </p>
      )}
      <div className="cd-facts">
        <div>
          <div className="cd-fact-value">{employee.weeklyHours ?? '—'} h</div>
          <div className="cd-fact-label">Wochenstunden</div>
        </div>
        <div>
          <div className="cd-fact-value">{employee.hoursMissing ? '—' : fte2(employee.fte)}</div>
          <div className="cd-fact-label">VZÄ (Basis {baseHours} h)</div>
        </div>
        <div>
          <div className="cd-fact-value">
            {employee.birthDate ? formatDateDE(employee.birthDate) : 'fehlt'}
          </div>
          <div className="cd-fact-label">Geburtstag</div>
        </div>
        <div>
          <div
            className="cd-fact-value"
            style={{ color: openCount ? 'var(--color-accent-700)' : 'var(--ok-800)' }}
          >
            {openCount}
          </div>
          <div className="cd-fact-label">offene Pflichten</div>
        </div>
      </div>

      <Segmented
        ariaLabel="Bereich"
        style={{ alignSelf: 'flex-start' }}
        options={[
          { value: 'comp' as DetailTab, label: 'Kompetenzen', count: competencies.length },
          { value: 'instr' as DetailTab, label: 'Einweisungen', count: instructions.length },
          { value: 'hist' as DetailTab, label: 'Historie', count: timelineItems.length },
        ]}
        value={tab}
        onChange={onTabChange}
      />

      {tab === 'comp' && (
        <section>
          <div className="cd-section-head">
            <div>
              <h3 className="cd-h3">Kompetenzmatrix</h3>
              <p className="cd-muted-14" style={{ margin: '4px 0 0' }}>
                Stufen 1–5 dokumentieren die laufende Einarbeitung, Stufe 6 den bestätigten
                Abschluss. Klick auf eine Zeile öffnet den Verlauf.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {availableCompetencyCount === 0 && (
                <span className="cd-muted-13">Alle Kompetenzen des Katalogs sind zugeordnet.</span>
              )}
              {suggestedCompetencyCount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onOpenSuggestedCompetencies}
                >
                  {suggestedCompetencyCount} Vorschläge aus Qualifikation
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={availableCompetencyCount === 0}
                onClick={onAddCompetency}
              >
                <Icon name="plus" size={16} />
                Kompetenz hinzufügen
              </button>
            </div>
          </div>
          <div className="cd-panel">
            {competencies.length === 0 && (
              <div className="cd-empty">Noch keine Kompetenzen zugeordnet.</div>
            )}
            {competencies.map((competency) => {
              const level = competency.level ?? 0;
              const tagClass = !level
                ? 'tag-neutral'
                : level === 6 && competency.stageScheme === 'practice-v1'
                  ? 'tag-accent-2'
                  : 'tag-accent';
              return (
                <button
                  key={competency.id ?? competency.competencyDefinitionId}
                  type="button"
                  className="cd-item"
                  onClick={() => onSelectCompetency(competency)}
                >
                  <span className="cd-code">{competency.competencyCode ?? ''}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{competency.competencyName}</div>
                    <div className="cd-muted-13">
                      {competency.category ?? 'Ohne Kategorie'} ·{' '}
                      {competency.approvedAt
                        ? `bestätigt ${formatDateDE(competency.approvedAt)}`
                        : 'keine Bestätigung'}
                    </div>
                  </div>
                  {competency.stageHistory?.length ? (
                    <div className="cd-muted-13">
                      {competency.stageHistory.length} dokumentierte Stände; zuletzt{' '}
                      {competency.stageHistory[0].changedAt}
                    </div>
                  ) : null}
                  <div className="cd-level-dots" aria-label={`Stufe ${level} von 6`}>
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                      <span
                        key={step}
                        style={{
                          background:
                            level && step <= level
                              ? level === 6 && competency.stageScheme === 'practice-v1'
                                ? 'var(--color-accent-2-500)'
                                : 'var(--color-accent-500)'
                              : 'transparent',
                          border: `2px solid ${level && step <= level ? 'transparent' : 'var(--color-neutral-300)'}`,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className={`tag ${tagClass}`}
                    style={{ flex: 'none', minWidth: 110, justifyContent: 'center' }}
                  >
                    {level
                      ? `${level} · ${competency.stageScheme === 'legacy' ? `Altmodell Stufe ${level}, fachlich prüfen` : COMPETENCY_LEVELS[level]}`
                      : 'Offen'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'instr' && (
        <section>
          <div className="cd-section-head">
            <div>
              <h3 className="cd-h3">Einweisungen</h3>
              <p className="cd-muted-14" style={{ margin: '4px 0 0' }}>
                Pflichtunterweisungen mit Rechtsgrundlage und Fälligkeit.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {availableInstructionCount === 0 && (
                <span className="cd-muted-13">
                  Zu jeder Einweisung läuft bereits ein offener Eintrag.
                </span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={availableInstructionCount === 0}
                onClick={onAddInstruction}
              >
                <Icon name="plus" size={16} />
                Einweisung hinzufügen
              </button>
            </div>
          </div>
          <div className="cd-panel">
            {instructions.length === 0 && (
              <div className="cd-empty">Noch keine Einweisungen zugeordnet.</div>
            )}
            {instructions.map((instruction) => {
              const state = instructionState(instruction, today, instructionReminderDays);
              return (
                <button
                  key={instruction.id ?? instruction.instructionDefinitionId}
                  type="button"
                  className="cd-item"
                  onClick={() => onSelectInstruction(instruction)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{instruction.instructionName}</div>
                    <div className="cd-muted-13">
                      {instruction.legalBasis ?? 'Intern'} ·{' '}
                      {instruction.completedAt
                        ? `durchgeführt ${formatDateDE(instruction.completedAt)}`
                        : 'noch offen'}
                    </div>
                  </div>
                  <span className="cd-muted-13" style={{ flex: 'none' }}>
                    {instruction.dueDate
                      ? `fällig ${formatDateDE(instruction.dueDate)}`
                      : 'ohne Frist'}
                  </span>
                  <span
                    className={`tag ${state.tagClass}`}
                    style={{ flex: 'none', minWidth: 90, justifyContent: 'center' }}
                  >
                    {state.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'hist' && employee.hoursHistory?.length ? (
        <section>
          <h3 className="cd-h3">Arbeitszeitstände und Korrekturen</h3>
          <p className="cd-muted-13">
            Wirksamkeitsdatum und Erfassung sind getrennt. Mehrere Zeilen für dasselbe
            Wirksamkeitsdatum dokumentieren Korrekturen.
          </p>
          <div className="cd-table-wrap cd-history-table">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Gültig ab</th>
                  <th>Stunden</th>
                  <th>VZÄ</th>
                  <th>Quelle / Status</th>
                  <th>Erfasst</th>
                </tr>
              </thead>
              <tbody>
                {employee.hoursHistory.map((h, i) => (
                  <tr key={i}>
                    <td>{formatDateDE(h.effectiveFrom)}</td>
                    <td>{h.weeklyHours ?? 'unbekannt'}</td>
                    <td>{h.fte == null ? 'unbekannt' : fte2(h.fte)}</td>
                    <td>
                      {h.sourceRef || 'Quelle nicht hinterlegt'} ·{' '}
                      {h.verified ? 'bestätigt' : 'ungeprüft'}
                    </td>
                    <td>{h.changedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {tab === 'hist' && (
        <section>
          <div className="cd-section-head">
            <div>
              <h3 className="cd-h3">Historie</h3>
              <p className="cd-muted-14" style={{ margin: '4px 0 0' }}>
                Beschäftigungsperioden und Ereignisse — Grundlage für die Jahreszuordnung.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onStartNewPeriod}>
              <Icon name="plus" size={16} />
              Eintrag hinzufügen
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 8 }}>
            {timelineItems.length === 0 && <div className="cd-empty">Keine Einträge.</div>}
            {timelineItems.map((item, index) => {
              const isPeriod = item.kind === 'period';
              const title = isPeriod
                ? item.record.endDate
                  ? 'Beschäftigungsperiode'
                  : 'Eintritt'
                : item.record.title;
              const detail = isPeriod
                ? `${item.record.qualification}${item.record.endDate ? ` · bis ${formatDateDE(item.record.endDate)}` : ''}`
                : (item.record.details ?? '');
              return (
                <div
                  key={`${item.kind}-${item.record.id ?? index}`}
                  className="cd-timeline-row cd-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTimelineItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTimelineItem(item);
                    }
                  }}
                >
                  <div className="cd-timeline-date">{formatDateDE(item.date)}</div>
                  <div className="cd-timeline-rail">
                    <span
                      style={{
                        background: isPeriod
                          ? 'var(--color-accent-2-500)'
                          : 'var(--color-accent-500)',
                      }}
                    />
                    <span />
                  </div>
                  <div style={{ paddingBottom: 22 }}>
                    <div style={{ fontWeight: 600 }}>{title}</div>
                    <div className="cd-muted-14">{detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default EmployeeDetail;
