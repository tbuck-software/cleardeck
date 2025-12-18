import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCakeCandles, faAward } from '@fortawesome/free-solid-svg-icons';
import type { BirthdayAnniversary } from '../../shared/types';

type BirthdaysAnniversariesListProps = {
  items: BirthdayAnniversary[];
  onItemClick: (item: BirthdayAnniversary) => void;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
};

const getDaysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr);
  eventDate.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const BirthdaysAnniversariesList = ({
  items,
  onItemClick,
}: BirthdaysAnniversariesListProps) => {
  if (items.length === 0) {
    return (
      <div className="birthdays-container">
        <div className="empty">Keine anstehenden Geburtstage oder Jubiläen.</div>
      </div>
    );
  }

  return (
    <div className="birthdays-container">
      <div className="birthdays-list">
        {items.map((item, index) => {
          const daysUntil = getDaysUntil(item.date);
          const isToday = daysUntil === 0;
          const isTomorrow = daysUntil === 1;
          const isBirthday = item.type === 'birthday';

          return (
            <button
              key={`${item.employeeId}-${item.type}-${index}`}
              className={`birthday-item ${isToday ? 'today' : ''}`}
              onClick={() => onItemClick(item)}
            >
              <div className={`birthday-icon ${isBirthday ? 'birthday' : 'anniversary'}`}>
                <FontAwesomeIcon icon={isBirthday ? faCakeCandles : faAward} />
              </div>
              <div className="birthday-content">
                <div className="birthday-header">
                  <span className="birthday-name">{item.employeeName}</span>
                  <span className="birthday-date">
                    {isToday ? 'Heute' : isTomorrow ? 'Morgen' : formatDate(item.date)}
                  </span>
                </div>
                <div className="birthday-detail muted">
                  {isBirthday
                    ? `${item.age}. Geburtstag`
                    : `${item.years}-jähriges Dienstjubiläum`}
                </div>
              </div>
              {!isToday && !isTomorrow && daysUntil <= 7 && (
                <div className="birthday-badge">In {daysUntil} Tagen</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BirthdaysAnniversariesList;
