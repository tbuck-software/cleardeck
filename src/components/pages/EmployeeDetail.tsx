import { localDate } from '../../utils/calendarDate';
import React, { useState } from 'react';
import EmployeeCompetencies from './EmployeeCompetencies';
import WorkingTimeModal from '../modals/WorkingTimeModal';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import Segmented from '../ui/Segmented';
import { formatDateDE } from '../../utils/dateFormat';
import { daysBetween } from '../../utils/qpr';
import type {
  EmployeeCompetency,
  EmployeeInstruction,
  EmployeeWithPeriod,
  WorkingTime,
} from '../../shared/types';
import type { TimelineItem } from '../../types/ui';

export type DetailTab = 'comp' | 'instr' | 'hist';


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
  onWorkingTimeSaved: () => Promise<void>;
  onCompetenciesSaved: (entries: EmployeeCompetency[]) => void;
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
  onWorkingTimeSaved,
  onCompetenciesSaved,
  onAddCompetency,
  onAddInstruction,
  onOpenSuggestedCompetencies,
  onSelectCompetency,
  onSelectInstruction,
  onStartNewPeriod,
  onSelectTimelineItem,
}: EmployeeDetailProps) => {
  const [workingTimeEdit, setWorkingTimeEdit] = useState<WorkingTime | null>();
  const workingTimes = employee.workingTimes ?? [];
  const workingHistory = employee.hoursHistory ?? [];
  const periodItems = timelineItems.filter((item) => item.kind === 'period');
  const employmentStartDate = employee.employmentStartDate;

  const hasMeaningfulEventNote = (item: Extract<TimelineItem, { kind: 'event' }>): boolean => {
    const { record } = item;
    const title = record.title.trim().toLocaleLowerCase('de-DE');
    const genericBoundaryTitles = new Set([
      'eintritt',
      'austritt',
      'einstieg',
      'join',
      'leave',
      'entry',
      'exit',
    ]);
    if (!genericBoundaryTitles.has(title)) return true;
    const details = record.details?.trim() ?? '';
    const generatedDetails =
      /^Startdatum\s*:?\s*\d{4}-\d{2}-\d{2}$/i.test(details) ||
      /^Enddatum\s*:?\s*\d{4}-\d{2}-\d{2}$/i.test(details) ||
      details === 'Aus bisherigem Eintrittsereignis übernommen. Qualifikation und Stunden prüfen.' ||
      details === 'Beschafftigungsverhaeltnis beendet.' ||
      details === 'Beschäftigungsverhältnis beendet.';
    return Boolean(
      (details && !generatedDetails) ||
        record.previousValue?.trim() ||
        record.newValue?.trim() ||
        (record.meta && Object.keys(record.meta).length > 0),
    );
  };
  const historyItems = [
    ...timelineItems.filter(item => !(item.kind === 'event' &&
      (item.record.type === 'fte-change' || item.record.type === 'weekly-hours-change') &&
      workingHistory.some(entry => entry.effectiveFrom === item.date))),
    ...workingTimes.map(record => ({
      kind: 'working-time' as const, date: record.effectiveFrom, record,
    })),
  ]
    .filter((item) => {
      if (item.kind !== 'event' || (item.record.type !== 'join' && item.record.type !== 'leave')) {
        return true;
      }
      if (hasMeaningfulEventNote(item)) return true;
      const isBoundary = periodItems.some((period) =>
        item.record.type === 'join'
          ? period.record.startDate === item.date
          : period.record.endDate === item.date,
      );
      return !isBoundary;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
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
  const tenureYears = employmentStartDate
    ? Math.floor(daysBetween(employmentStartDate, endForTenure) / 365)
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
            {employee.qualification} · Abschnitt seit {formatDateDE(employee.startDate)}
            <span className="cd-detail-employment-start">
              Beschäftigt seit {formatDateDE(employmentStartDate)} ({tenureYears} Jahre)
            </span>
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
          Arbeitszeit aus Altdaten übernommen. Stunden und Gültigkeitsdatum unter „Bearbeiten“ prüfen.
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
          { value: 'hist' as DetailTab, label: 'Historie', count: historyItems.length },
        ]}
        value={tab}
        onChange={onTabChange}
      />

      {tab === 'comp' && (
        <EmployeeCompetencies employeeId={employee.id!} employeeName={employee.name}
          competencies={competencies} availableCompetencyCount={availableCompetencyCount}
          suggestedCompetencyCount={suggestedCompetencyCount} onSaved={onCompetenciesSaved}
          onAddCompetency={onAddCompetency} onOpenSuggestedCompetencies={onOpenSuggestedCompetencies}
          onSelectCompetency={onSelectCompetency} />
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

      {tab === 'hist' && (
        <section>
          <div className="cd-section-head">
            <div>
              <h3 className="cd-h3">Historie</h3>
              <p className="cd-muted-14" style={{ margin: '4px 0 0' }}>
                Beschäftigungsabschnitte, Arbeitszeiten und Ereignisse. Zeilen öffnen den
                Bearbeitungsdialog.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onStartNewPeriod}>
              <Icon name="plus" size={16} /> Eintrag hinzufügen
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 8 }}>
            {historyItems.length === 0 && <div className="cd-empty">Keine Einträge.</div>}
            {historyItems.map((item, index) => {
              const isPeriod = item.kind === 'period';
              const isWorkingTime = item.kind === 'working-time';
              const title = isPeriod
                ? 'Beschäftigungsperiode'
                : isWorkingTime ? 'Arbeitszeit' : item.record.title;
              const detail = isPeriod
                ? `${item.record.qualification}${item.record.endDate ? ` · bis ${formatDateDE(item.record.endDate)}` : ''}`
                : isWorkingTime
                  ? `${item.record.weeklyHours ?? '—'} Std./Woche · ${fte2(item.record.fte)} VZÄ${item.record.effectiveUntil ? ` · bis ${formatDateDE(item.record.effectiveUntil)}` : ''}`
                  : (item.record.details ?? '');
              return (
                <button
                  key={`${item.kind}-${item.record.id ?? index}`}
                  type="button"
                  className="cd-timeline-row cd-row cd-history-row"
                  aria-label={`${title} ab ${formatDateDE(item.date)} bearbeiten`}
                  onClick={() => (isWorkingTime ? setWorkingTimeEdit(item.record) : onSelectTimelineItem(item))}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    if (isWorkingTime) setWorkingTimeEdit(item.record);
                    else onSelectTimelineItem(item);
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
                </button>
              );
            })}
          </div>
        </section>
      )}
      {workingTimeEdit !== undefined && (
        <WorkingTimeModal entry={workingTimeEdit} employee={employee} baseHours={baseHours}
          onSaved={onWorkingTimeSaved} onClose={() => setWorkingTimeEdit(undefined)} />
      )}
    </div>
  );
};

export default EmployeeDetail;
