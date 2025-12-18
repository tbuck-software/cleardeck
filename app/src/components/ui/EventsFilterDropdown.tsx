import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightToBracket,
  faArrowRightFromBracket,
  faStethoscope,
  faKitMedical,
  faCalendarDay,
  faFilter,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { EmployeeEventType } from '../../shared/types';

type EventsFilterDropdownProps = {
  hiddenEventTypes: EmployeeEventType[];
  onToggleFilter: (type: EmployeeEventType) => void;
  onShowAll: () => void;
  onHideAll: () => void;
};

const typeLabels: Record<EmployeeEventType, string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
};

const typeIcons: Record<EmployeeEventType, IconDefinition> = {
  join: faArrowRightToBracket,
  leave: faArrowRightFromBracket,
  'name-change': faArrowRightToBracket,
  'note-change': faArrowRightToBracket,
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
};

const allEventTypes: EmployeeEventType[] = [
  'join',
  'leave',
  'care-visit',
  'emergency-training',
  'custom',
];

const EventsFilterDropdown = ({
  hiddenEventTypes,
  onToggleFilter,
  onShowAll,
  onHideAll,
}: EventsFilterDropdownProps) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasActiveFilters = hiddenEventTypes.length > 0;
  const allHidden = hiddenEventTypes.length === allEventTypes.length;

  return (
    <div className="filter-dropdown-container">
      <button
        className={`ghost-button small filter-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
        onClick={() => setFilterOpen(!filterOpen)}
        title="Filter"
      >
        <FontAwesomeIcon icon={faFilter} />
        {hasActiveFilters && (
          <span className="filter-badge">{hiddenEventTypes.length}</span>
        )}
      </button>
      {filterOpen && (
        <div className="filter-dropdown">
          <div className="filter-dropdown-header">Anzeigen:</div>
          {allEventTypes.map((type) => {
            const isHidden = hiddenEventTypes.includes(type);
            return (
              <button
                key={type}
                className={`filter-option ${isHidden ? 'hidden' : ''}`}
                onClick={() => onToggleFilter(type)}
              >
                <span className={`filter-check ${isHidden ? '' : 'active'}`}>
                  {!isHidden && <FontAwesomeIcon icon={faCheck} />}
                </span>
                <FontAwesomeIcon
                  icon={typeIcons[type]}
                  className={`filter-icon event-${type}`}
                />
                <span>{typeLabels[type]}</span>
              </button>
            );
          })}
          <div className="filter-dropdown-actions">
            <button
              className="filter-action-btn"
              onClick={onShowAll}
              disabled={!hasActiveFilters}
            >
              Alle anzeigen
            </button>
            <button
              className="filter-action-btn"
              onClick={onHideAll}
              disabled={allHidden}
            >
              Alle ausblenden
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsFilterDropdown;
