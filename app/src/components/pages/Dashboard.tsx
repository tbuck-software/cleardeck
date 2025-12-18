import React from 'react';
import {
  faBriefcase,
  faChartPie,
  faGraduationCap,
  faUsers,
  faUserPlus,
  faUserMinus,
  faPercent,
} from '@fortawesome/free-solid-svg-icons';
import type {
  QualificationType,
  YearDataset,
  UpcomingEvent,
  EmployeeEventType,
  ExpiringTraining,
  DepartmentStats,
  BirthdayAnniversary,
} from '../../shared/types';
import StatCard from '../ui/StatCard';
import UpcomingEventsList from '../ui/UpcomingEventsList';
import EventsFilterDropdown from '../ui/EventsFilterDropdown';
import ExpiringTrainingsList from '../ui/ExpiringTrainingsList';
import DepartmentStatsCard from '../ui/DepartmentStatsCard';
import BirthdaysAnniversariesList from '../ui/BirthdaysAnniversariesList';

type DashboardProps = {
  year: number;
  dataset: YearDataset | null;
  baseHours: number;
  averageFte: number;
  totalFte: number;
  totalHeadcount: number;
  qualifications: QualificationType[];
  upcomingEvents: UpcomingEvent[];
  hiddenEventTypes: EmployeeEventType[];
  onEventClick: (event: UpcomingEvent) => void;
  onToggleEventFilter: (type: EmployeeEventType) => void;
  onShowAllEvents: () => void;
  onHideAllEvents: () => void;
  expiringTrainings: ExpiringTraining[];
  departmentStats: DepartmentStats[];
  birthdaysAnniversaries: BirthdayAnniversary[];
  onTrainingClick: (training: ExpiringTraining) => void;
  onBirthdayClick: (item: BirthdayAnniversary) => void;
};

const Dashboard = ({
  year,
  dataset,
  averageFte,
  totalFte,
  totalHeadcount,
  qualifications,
  upcomingEvents,
  hiddenEventTypes,
  onEventClick,
  onToggleEventFilter,
  onShowAllEvents,
  onHideAllEvents,
  expiringTrainings,
  departmentStats,
  birthdaysAnniversaries,
  onTrainingClick,
  onBirthdayClick,
}: DashboardProps) => {
  const fullTimeCount = dataset?.employees.filter((e) => e.fte >= 1).length ?? 0;
  const fullTimePercent =
    totalHeadcount > 0 ? Math.round((fullTimeCount / totalHeadcount) * 100) : 0;
  const newHires =
    dataset?.employees.filter((e) => e.startDate.startsWith(`${year}`)).length ?? 0;
  const leavers =
    dataset?.employees.filter((e) => e.endDate?.startsWith(`${year}`)).length ?? 0;

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
            events={upcomingEvents}
            hasActiveFilters={hiddenEventTypes.length > 0}
            onEventClick={onEventClick}
          />
        </div>

        <div className="card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Schulungen</p>
              <h3>Ablaufende Zertifikate</h3>
            </div>
          </div>
          <ExpiringTrainingsList
            trainings={expiringTrainings}
            onTrainingClick={onTrainingClick}
          />
        </div>

        <div className="card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Team</p>
              <h3>Geburtstage & Jubiläen</h3>
            </div>
          </div>
          <BirthdaysAnniversariesList
            items={birthdaysAnniversaries}
            onItemClick={onBirthdayClick}
          />
        </div>

        <div className="card">
          <div className="form-header">
            <div>
              <p className="eyebrow">Organisation</p>
              <h3>Abteilungen</h3>
            </div>
          </div>
          <DepartmentStatsCard stats={departmentStats} totalFte={totalFte} />
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
      </div>
    </div>
  );
};

export default Dashboard;
