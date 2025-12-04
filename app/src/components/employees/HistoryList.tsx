import React from 'react';
import type { EmploymentPeriod } from '../../shared/types';

type HistoryListProps = {
  items: EmploymentPeriod[];
};

const HistoryList = ({ items }: HistoryListProps) => (
  <div className="history">
    <div className="history-header">
      <span>Historie</span>
      <small>Stellenanteil pro Zeitraum</small>
    </div>
    {items.length === 0 && <div className="history-empty">Keine Historie hinterlegt.</div>}
    {items.map((item) => (
      <div className="history-row" key={item.id ?? `${item.startDate}-${item.endDate}`}>
        <div>
          <div className="history-title">
            {item.startDate} – {item.endDate ?? 'aktuell'}
          </div>
          <div className="history-meta">
            FTE/VZÄ: {item.fte} · Quali: {item.qualification ?? '—'}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default HistoryList;
