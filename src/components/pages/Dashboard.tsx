import { annualFteLabel } from '../../shared/annualFte';
import { localDate } from '../../utils/calendarDate';
import React from 'react';
import Segmented from '../ui/Segmented';
import Icon from '../ui/Icon';
import ListPanel from '../ui/ListPanel';
import TaskRow from '../ui/TaskRow';
import Timeline from '../ui/Timeline';
import type { UnifiedEvent, YearDataset } from '../../shared/types';
import type { DashboardTask, DataQualityCheck, TaskTarget } from '../../utils/dashboardTasks';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

/** Bar colours follow the qualification order, most-qualified first. */
const QUAL_COLORS = [
  'var(--color-accent-2-500)',
  'var(--color-accent-2-300)',
  'var(--color-accent-500)',
  'var(--color-neutral-400)',
];

export const greetingFor = (date: Date): string => {
  const hour = date.getHours();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  if (hour < 5) return 'Hallo, Nachteule';
  if (hour < 7) return 'Frühaufsteher, Respekt';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 13) return 'Mahlzeit';
  if (hour < 17) return weekend ? 'Wochenendschicht?' : 'Guten Tag';
  if (hour < 20) return 'Schönen Abend';
  if (hour < 23) return 'Noch am Schreibtisch?';
  return 'Ab ins Bett — das läuft morgen nicht weg';
};

const fte2 = (value: number) => value.toFixed(2).replace('.', ',');

/** Enough to act on without turning the dashboard into a list page. */
const TASK_PREVIEW_COUNT = 5;

type DashboardProps = {
  year: number;
  years: number[];
  dataset: YearDataset | null;
  baseHours: number;
  totalFte: number;
  totalHeadcount: number;
  actionNeededCount: number;
  tasks: DashboardTask[];
  doneTaskIds: string[];
  quality: DataQualityCheck[];
  upcoming: UnifiedEvent[];
  onYearChange: (year: number) => void;
  onToggleTask: (id: string) => void;
  onOpenTarget: (target: TaskTarget) => void;
  onOpenEvent: (event: UnifiedEvent) => void;
  onOpenReport: () => void;
  onGoCalendar: () => void;
  onOpenTasks: () => void;
};

const Dashboard = ({
  year,
  years,
  dataset,
  baseHours,
  totalFte,
  totalHeadcount,
  actionNeededCount,
  tasks,
  doneTaskIds,
  quality,
  upcoming,
  onYearChange,
  onToggleTask,
  onOpenTarget,
  onOpenEvent,
  onOpenReport,
  onGoCalendar,
  onOpenTasks,
}: DashboardProps) => {
  const now = new Date();
  const today = localDate(now);
  const todayLabel = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const employees = dataset?.employees ?? [];
  // Eintritt ist der Beginn der zusammenhängenden Beschäftigung, nicht der
  // Beginn eines neuen Abschnitts innerhalb des Jahres.
  const newHires = employees.filter((employee) =>
    employee.employmentStartDate.startsWith(String(year)),
  ).length;
  const leavers = employees.filter((employee) => employee.endDate?.startsWith(String(year))).length;
  // The preview is a working queue: only open tasks, newest urgency first.
  // Ticking one removes it and pulls the next in, which is the whole point at
  // a few hundred open items.
  const openTasks = tasks.filter((task) => !doneTaskIds.includes(task.id));
  const openTaskCount = openTasks.length;
  const preview = openTasks.slice(0, TASK_PREVIEW_COUNT);
  const remaining = openTaskCount - preview.length;

  const annual = dataset?.annualSummary;
  const categories = (annual?.aggregation ?? dataset?.aggregation)?.categories ?? [];
  const methodLabel = annual ? annualFteLabel(annual.method) : `Basis ${baseHours} Std./Woche`;
  const provisional = annual && (annual.unverifiedHoursCount > 0 || employees.some(e => e.annualFteMissing));

  const kpis = [
    {
      value: fte2(totalFte),
      label: annual ? 'Jahres-VZÄ gesamt' : 'VZÄ gesamt',
      title: methodLabel,
      color: 'var(--color-accent-700)',
    },
    {
      value: String(totalHeadcount),
      label: 'Personen',
      sub: `im Jahr ${year} beschäftigt`,
      color: 'var(--color-text)',
    },
    {
      value: fte2(totalFte / Math.max(1, totalHeadcount)),
      label: annual ? 'Ø Jahres-VZÄ je Person' : 'Ø VZÄ je Person',
      title: `${methodLabel}; über alle im Jahr Beschäftigten`,
      color: 'var(--color-text)',
    },
    {
      value: String(newHires),
      label: 'Eintritte',
      sub: `im Jahr ${year}`,
      color: 'var(--color-accent-2-700)',
    },
    {
      value: String(leavers),
      label: 'Austritte',
      sub: `im Jahr ${year}`,
      color: 'var(--color-text)',
    },
    {
      value: String(actionNeededCount),
      label: 'Handlungsbedarf',
      sub: 'Patient:innen · offene Visitenmaßnahmen',
      color: actionNeededCount > 0 ? 'var(--bad-800)' : 'var(--ok-800)',
    },
  ];

  return (
    <div className="cd-page cd-dashboard">
      <header className="cd-page-header">
        <div>
          <div className="cd-eyebrow">{todayLabel}</div>
          <h1 className="cd-h1">{greetingFor(now)}</h1>
        </div>
        <Segmented
          ariaLabel="Jahr"
          options={years.map((value) => ({ value, label: String(value) }))}
          value={year}
          onChange={onYearChange}
        />
      </header>

      <section>
        <div className="cd-section-head">
          <h3 className="cd-h3">Heute zu tun</h3>
          <span className="cd-muted-13">
            {openTaskCount} offen · automatisch aus Fristen, Visiten und Datenlücken
          </span>
        </div>
        <ListPanel>
          {openTasks.length === 0 && (
            <div className="cd-empty">
              Keine weiteren Aufgaben in dieser Ansicht. Zurückgestellte Aufgaben und nicht erfasste
              Nachweise sind damit nicht fachlich erledigt.
            </div>
          )}
          {preview.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              done={false}
              onToggle={onToggleTask}
              onOpen={onOpenTarget}
            />
          ))}
          {remaining > 0 && (
            <button type="button" className="cd-more" onClick={onOpenTasks}>
              Alle {openTaskCount} Aufgaben anzeigen
              <Icon name="chevronRight" size={15} />
            </button>
          )}
        </ListPanel>
      </section>

      <section className="cd-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label}>
            <div className="cd-kpi-value" title={kpi.title} style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>{kpi.label}</div>
            {kpi.sub && <div className="cd-muted-13">{kpi.sub}</div>}
          </div>
        ))}
      </section>

      <div className="cd-two-col">
        <section>
          <h3 className="cd-h3">
            {annual ? 'Jahres-VZÄ' : 'VZÄ'} je Qualifikation <span className="cd-h3-note">· {year}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {categories.map((category, index) => (
              <div key={category.qualification}>
                <div className="cd-bar-label">
                  <span style={{ fontWeight: 600 }}>{category.qualification}</span>
                  <span className="cd-muted" title={annual?.method === 'month-end-average'
                    ? 'Personen an mindestens einem Monatsende; je Qualifikation einmal gezählt.'
                    : undefined}>
                    {category.headcount} Personen ·{' '}
                    <strong title={methodLabel} style={{ color: 'var(--color-text)' }}>{fte2(category.fte)}</strong> VZÄ
                  </span>
                </div>
                <div className="cd-bar-track">
                  <div
                    className="cd-bar-fill"
                    style={{
                      background: QUAL_COLORS[index % QUAL_COLORS.length],
                      width: `${totalFte ? Math.round((category.fte / totalFte) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="cd-empty">Keine Beschäftigten im Jahr {year}.</div>
            )}
          </div>
          <p className="cd-muted-13" style={{ margin: '14px 0 0' }}>
            Basis {baseHours} Std./Woche.
            {provisional && ' Vorläufig: Stellenanteile fehlen oder sind unbestätigt.'}{' '}
            <button type="button" className="cd-link" onClick={onOpenReport}>
              Jahresnachweis {year - 1} erstellen →
            </button>
          </p>
        </section>

        <section>
          <div className="cd-section-head">
            <h3 className="cd-h3">Nächste 30 Tage</h3>
            <button type="button" className="btn btn-ghost" onClick={onGoCalendar}>
              Kalender
            </button>
          </div>
          <Timeline
            compact
            empty="Keine Termine in den nächsten 30 Tagen."
            items={upcoming.map((event) => {
              const days = Math.round(
                (new Date(`${event.date}T00:00:00`).getTime() -
                  new Date(`${today}T00:00:00`).getTime()) /
                  86400000,
              );
              const soon = days <= 3;
              const name = event.employeeName ?? event.patientName ?? event.title;
              return {
                key: event.id,
                date: (
                  <span
                    className="cd-daychip"
                    style={{ color: soon ? 'var(--color-accent-700)' : 'var(--color-text)' }}
                  >
                    {event.date.slice(8, 10)}
                    <span className="cd-daychip-mon">
                      {MONTHS_SHORT[Number(event.date.slice(5, 7)) - 1]}
                    </span>
                  </span>
                ),
                title: name,
                subline: event.title,
                tag: (
                  <span className={`tag ${soon ? 'tag-accent' : 'tag-neutral'}`}>
                    {days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`}
                  </span>
                ),
                ariaLabel: `${name} öffnen`,
                onOpen: () => onOpenEvent(event),
              };
            })}
          />
        </section>
      </div>

      <section>
        <h3 className="cd-h3" style={{ marginBottom: 6 }}>
          Datenqualität
        </h3>
        <p className="cd-muted-14" style={{ margin: '0 0 14px' }}>
          Lücken, die den Jahresnachweis unvollständig machen würden.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {quality.map((check) => (
            <button
              key={check.id}
              type="button"
              className="btn btn-secondary"
              style={{ gap: 10 }}
              disabled={!check.target}
              onClick={() => check.target && onOpenTarget(check.target)}
            >
              <span className="cd-dot" style={{ background: check.dot }} />
              {check.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
