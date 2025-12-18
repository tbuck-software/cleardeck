import React from 'react';
import type { EmploymentPeriod } from '../../shared/types';
import { formatDateDE } from '../../utils/dateFormat';

type HistoryListProps = {
  items: EmploymentPeriod[];
};

const HistoryList = ({ items }: HistoryListProps) => (
  <div className="history">
    <div className="history-header">
      <span>Historie</span>
      <small>Beschäftigungszeiträume</small>
    </div>
    {items.length === 0 && <div className="history-empty">Keine Historie hinterlegt.</div>}
    {items.map((item) => (
      <div className="history-row" key={item.id ?? `${item.startDate}-${item.endDate}`}>
        <div>
          <div className="history-title">
            {formatDateDE(item.startDate)} – {item.endDate ? formatDateDE(item.endDate) : 'aktuell'}
          </div>
          <div className="history-meta">
            Quali: {item.qualification ?? '—'}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default HistoryList;
