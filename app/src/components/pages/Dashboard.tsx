import React from 'react';
import type { YearDataset } from '../../shared/types';
import StatCard from '../ui/StatCard';

type DashboardProps = {
  year: number;
  dataset: YearDataset | null;
  baseHours: number;
  averageFte: number;
  totalFte: number;
  totalHeadcount: number;
};

const Dashboard = ({ year, dataset, baseHours, averageFte, totalFte, totalHeadcount }: DashboardProps) => (
  <div className="stack dashboard">
    <div className="card dashboard-hero">
      <div>
        <p className="eyebrow">Übersicht {year}</p>
        <h2>Willkommen zurück</h2>
        <p className="subtitle">Kennzahlen und Qualifikationen im gewählten Jahr.</p>
      </div>
    </div>

    <div className="card">
      <div className="form-header">
        <div>
          <p className="eyebrow">Kennzahlen</p>
          <h3>Jahr im Blick</h3>
        </div>
      </div>
      <div className="grid stats-grid dashboard-stats">
        <StatCard label="Gesamt VZÄ" value={`${totalFte.toFixed(2)}`} sub="Summe aller Stellenanteile" />
        <StatCard label="Mitarbeitende" value={`${totalHeadcount}`} sub="im gewählten Jahr" />
        <StatCard label="Ø VZÄ je Person" value={averageFte.toFixed(2)} sub="Durchschnittliche Auslastung" />
        <StatCard
          label="Qualifikationen"
          value={`${dataset?.aggregation.categories.length ?? 0}`}
          sub="mit VZÄ im Jahr"
        />
        <StatCard label="Basis-Stunden" value={`${baseHours || 36}`} sub="Grundlage VZÄ-Berechnung" />
      </div>
    </div>

    <div className="card">
      <div className="form-header">
        <div>
          <p className="eyebrow">Qualifikationen</p>
          <h3>VZÄ je Qualifikation</h3>
        </div>
      </div>
      <div className="qual-grid">
        {(dataset?.aggregation.categories ?? []).length > 0 ? (
          dataset?.aggregation.categories.map((cat) => {
            const percent = totalFte > 0 ? Math.min(100, (cat.fte / totalFte) * 100) : 0;
            return (
              <div className="qual-card" key={cat.qualification}>
                <div className="qual-card-head">
                  <div className="qual-title">{cat.qualification}</div>
                  <div className="qual-meta">{cat.headcount} Personen</div>
                </div>
                <div className="qual-fte">{cat.fte.toFixed(2)} VZÄ</div>
                <div className="qual-progress">
                  <div className="qual-progress-bar" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty">Keine Qualifikationen mit VZÄ im gewählten Jahr.</div>
        )}
      </div>
    </div>
  </div>
);

export default Dashboard;
