import React from 'react';
import type { DepartmentStats } from '../../shared/types';

type DepartmentStatsCardProps = {
  stats: DepartmentStats[];
  totalFte: number;
};

const DepartmentStatsCard = ({ stats, totalFte }: DepartmentStatsCardProps) => {
  if (stats.length === 0) {
    return (
      <div className="department-stats-container">
        <div className="empty">Keine Abteilungen zugeordnet.</div>
      </div>
    );
  }

  // Generate colors for departments
  const colors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#64748b', // slate
  ];

  return (
    <div className="department-stats-container">
      <div className="department-chart">
        <div className="department-bar-container">
          {stats.map((dept, index) => {
            const percent = totalFte > 0 ? (dept.fte / totalFte) * 100 : 0;
            const color = colors[index % colors.length];
            return (
              <div
                key={dept.department}
                className="department-bar-segment"
                style={{
                  width: `${percent}%`,
                  backgroundColor: color,
                }}
                title={`${dept.department}: ${dept.fte.toFixed(2)} VZÄ (${Math.round(percent)}%)`}
              />
            );
          })}
        </div>
      </div>
      <div className="department-legend">
        {stats.map((dept, index) => {
          const percent = totalFte > 0 ? (dept.fte / totalFte) * 100 : 0;
          const color = colors[index % colors.length];
          return (
            <div key={dept.department} className="department-legend-item">
              <div className="department-legend-color" style={{ backgroundColor: color }} />
              <div className="department-legend-info">
                <span className="department-legend-name">{dept.department}</span>
                <span className="department-legend-value">
                  {dept.headcount} Pers. &middot; {dept.fte.toFixed(2)} VZÄ &middot; {Math.round(percent)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentStatsCard;
