import React from 'react';

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
};

const StatCard = ({ label, value, sub }: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

export default StatCard;
