import React from 'react';
import type { EmployeeWithPeriod } from '../../shared/types';
import { statusLabels } from '../../constants';

type BadgeProps = {
  status: EmployeeWithPeriod['status'];
};

const Badge = ({ status }: BadgeProps) => (
  <span className={`badge badge-${status}`}>{statusLabels[status]}</span>
);

export default Badge;
