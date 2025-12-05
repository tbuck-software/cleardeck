import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon?: IconDefinition;
};

const StatCard = ({ label, value, sub, icon }: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-content">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
    {icon && (
      <div className="stat-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
    )}
  </div>
);

export default StatCard;
