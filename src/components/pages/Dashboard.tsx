import React from 'react';
import {
  faBriefcase,
  faChartPie,
  faClipboardCheck,
  faGraduationCap,
  faListCheck,
  faShieldHalved,
  faTriangleExclamation,
  faUsers,
  faUserPlus,
  faUserMinus,
  faPercent,
} from '@fortawesome/free-solid-svg-icons';
import type {
  EmployeeDashboardStats,
  QualificationType,
  YearDataset,
  UnifiedEvent,
  UnifiedEventType,
} from '../../shared/types';
import StatCard from '../ui/StatCard';
import UpcomingEventsList from '../ui/UpcomingEventsList';
import EventsFilterDropdown from '../ui/EventsFilterDropdown';

type DashboardProps = {
  year: number;
  dataset: YearDataset | null;
  baseHours: number;
  averageFte: number;
  totalFte: number;
  totalHeadcount: number;
  qualifications: QualificationType[];
  unifiedEvents: UnifiedEvent[];
  hiddenEventTypes: UnifiedEventType[];
  employeeDashboardStats: EmployeeDashboardStats | null;
  onEventClick: (event: UnifiedEvent) => void;
  onToggleEventFilter: (type: UnifiedEventType) => void;
  onShowAllEvents: () => void;
  onHideAllEvents: () => void;
};

const Dashboard = ({
  year,
  dataset,
  averageFte,
  totalFte,
  totalHeadcount,
  qualifications,
  unifiedEvents,
  hiddenEventTypes,
  employeeDashboardStats,
  onEventClick,
  onToggleEventFilter,
  onShowAllEvents,
  onHideAllEvents,
}: DashboardProps) => {
  const fullTimeCount = dataset?.employees.filter((e) => e.fte >= 1).length ?? 0;
  const fullTimePercent =
    totalHeadcount > 0 ? Math.round((fullTimeCount / totalHeadcount) * 100) : 0;
  const newHires =
    dataset?.employees.filter((e) => e.startDate.startsWith(`${year}`)).length ?? 0;
  const leavers =
    dataset?.employees.filter((e) => e.endDate?.startsWith(`${year}`)).length ?? 0;
  const instructionStats = employeeDashboardStats?.instructions;
  const competencyStats = employeeDashboardStats?.competencies;

  return (
    <div className="stack dashboard">
      <div className="card dashboard-hero">
        <div className="hero-content">
          <p className="eyebrow">Übersicht {year}</p>
          <h2>Willkommen zurück</h2>
          <p className="subtitle">Kennzahlen und Qualifikationen im gewählten Jahr.</p>
        </div>
        <div className="hero-decoration">
          {/* Optional decoration or pattern */}
        </div>
      </div>

      <div className="dashboard-masonry">
        {/* Spalte 1: Ereignisse + Qualifikationen */}
        <div className="card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Termine</p>
              <h3>Bevorstehende Ereignisse</h3>
            </div>
            <EventsFilterDropdown
              hiddenEventTypes={hiddenEventTypes}
              onToggleFilter={onToggleEventFilter}
              onShowAll={onShowAllEvents}
              onHideAll={onHideAllEvents}
            />
          </div>
          <UpcomingEventsList
            events={unifiedEvents}
            hasActiveFilters={hiddenEventTypes.length > 0}
            onEventClick={onEventClick}
          />
        </div>

        <div className="card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Qualifikationen</p>
              <h3>VZÄ je Qualifikation</h3>
            </div>
          </div>
          <div className="qual-grid">
            {qualifications.length > 0 ? (
              qualifications.map((q) => {
                const cat = dataset?.aggregation.categories.find(
                  (c) => c.qualification === q.name,
                );
                const fte = cat?.fte ?? 0;
                const headcount = cat?.headcount ?? 0;
                const percent = totalFte > 0 ? Math.min(100, (fte / totalFte) * 100) : 0;

                return (
                  <div className="qual-card" key={q.name}>
                    <div className="qual-card-head">
                      <div className="qual-icon">
                        <div className="qual-dot" />
                      </div>
                      <div className="qual-info">
                        <div className="qual-title">{q.name}</div>
                        <div className="qual-meta">{headcount} Personen</div>
                      </div>
                      <div className="qual-fte">{fte.toFixed(2)}</div>
                    </div>
                    <div className="qual-progress-wrapper">
                      <div className="qual-progress">
                        <div className="qual-progress-bar" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="qual-percent">{Math.round(percent)}%</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty">Keine Qualifikationen definiert.</div>
            )}
          </div>
        </div>

        {/* Spalte 2: Jahr im Blick + Abteilungen */}
        <div className="card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Kennzahlen</p>
              <h3>Jahr im Blick</h3>
            </div>
          </div>
          <div className="grid stats-grid dashboard-stats">
            <StatCard
              label="Gesamt VZÄ"
              value={`${totalFte.toFixed(2)}`}
              sub="Summe aller Stellenanteile"
              icon={faChartPie}
            />
            <StatCard
              label="Team"
              value={`${totalHeadcount}`}
              sub="im gewählten Jahr"
              icon={faUsers}
            />
            <StatCard
              label="Ø VZÄ je Person"
              value={averageFte.toFixed(2)}
              sub="Durchschnittliche Auslastung"
              icon={faBriefcase}
            />
            <StatCard
              label="Qualifikationen"
              value={`${dataset?.aggregation.categories.length ?? 0}`}
              sub="mit VZÄ im Jahr"
              icon={faGraduationCap}
            />
            <StatCard
              label="Vollzeit-Quote"
              value={`${fullTimePercent}%`}
              sub={`${fullTimeCount} Vollzeit-Kräfte`}
              icon={faPercent}
            />
            <StatCard
              label="Neu im Jahr"
              value={`${newHires}`}
              sub="Neueintritte"
              icon={faUserPlus}
            />
            <StatCard
              label="Ausgeschieden"
              value={`${leavers}`}
              sub="Austritte im Jahr"
              icon={faUserMinus}
            />
          </div>
        </div>

        <div className="card dashboard-focus-card dashboard-focus-card-alert">
          <div className="form-header">
            <div>
              <p className="eyebrow">Compliance</p>
              <h3>Einweisungen im Fokus</h3>
              <p className="subtitle small">Aktive Mitarbeitende, offene Pflichten und kurzfristige Faelligkeiten.</p>
            </div>
          </div>
          <div className="dashboard-focus-metrics">
            <StatCard
              label="Überfällig"
              value={`${instructionStats?.overdue ?? 0}`}
              sub="sofort handeln"
              icon={faTriangleExclamation}
            />
            <StatCard
              label="30 Tage"
              value={`${instructionStats?.dueSoon ?? 0}`}
              sub="bald fällig"
              icon={faClipboardCheck}
            />
            <StatCard
              label="Erledigt"
              value={`${instructionStats?.completedRate ?? 0}%`}
              sub={`${instructionStats?.totalAssigned ?? 0} zugewiesen`}
              icon={faShieldHalved}
            />
          </div>
          <div className="dashboard-focus-list">
            <div className="dashboard-focus-list-head">
              <span>Meiste offenen Einweisungen</span>
              <span>{instructionStats?.topOpenEmployees.length ?? 0} Treffer</span>
            </div>
            {instructionStats && instructionStats.topOpenEmployees.length > 0 ? (
              instructionStats.topOpenEmployees.map((entry) => (
                <div className="dashboard-focus-row" key={`instruction-gap-${entry.employeeId}`}>
                  <div>
                    <strong>{entry.employeeName}</strong>
                    <span>{entry.count} offen</span>
                  </div>
                  <span className="dashboard-focus-pill danger">{entry.count}</span>
                </div>
              ))
            ) : (
              <div className="empty compact-empty">Keine offenen Einweisungen im aktiven Team.</div>
            )}
          </div>
        </div>

        <div className="card dashboard-focus-card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Kompetenzstatus</p>
              <h3>Freigaben und Lücken</h3>
              <p className="subtitle small">Offene Kompetenzen und ausstehende Freigaben im aktuellen Team.</p>
            </div>
          </div>
          <div className="dashboard-focus-metrics">
            <StatCard
              label="Offen"
              value={`${competencyStats?.open ?? 0}`}
              sub="ohne Stufe"
              icon={faGraduationCap}
            />
            <StatCard
              label="Freigaben"
              value={`${competencyStats?.pendingApproval ?? 0}`}
              sub="ausstehend"
              icon={faListCheck}
            />
            <StatCard
              label="Freigegeben"
              value={`${competencyStats?.approvedRate ?? 0}%`}
              sub={`${competencyStats?.totalAssigned ?? 0} zugewiesen`}
              icon={faUsers}
            />
          </div>
          <div className="dashboard-focus-list">
            <div className="dashboard-focus-list-head">
              <span>Größte Kompetenzlücken</span>
              <span>{competencyStats?.topGapEmployees.length ?? 0} Treffer</span>
            </div>
            {competencyStats && competencyStats.topGapEmployees.length > 0 ? (
              competencyStats.topGapEmployees.map((entry) => (
                <div className="dashboard-focus-row" key={`competency-gap-${entry.employeeId}`}>
                  <div>
                    <strong>{entry.employeeName}</strong>
                    <span>{entry.count} Themen mit Gap</span>
                  </div>
                  <span className="dashboard-focus-pill">{entry.count}</span>
                </div>
              ))
            ) : (
              <div className="empty compact-empty">Keine offenen Kompetenzlücken im aktiven Team.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
