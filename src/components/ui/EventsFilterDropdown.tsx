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
  faCakeCandles,
  faAward,
  faCertificate,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { UnifiedEventType } from '../../shared/types';

type EventsFilterDropdownProps = {
  hiddenEventTypes: UnifiedEventType[];
  onToggleFilter: (type: UnifiedEventType) => void;
  onShowAll: () => void;
  onHideAll: () => void;
};

const typeLabels: Record<UnifiedEventType, string> = {
  join: 'Eintritt',
  leave: 'Austritt',
  'name-change': 'Namensänderung',
  'note-change': 'Notizänderung',
  'fte-change': 'VZÄ-Änderung',
  'weekly-hours-change': 'Wochenstundenänderung',
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Ereignis',
  birthday: 'Geburtstag',
  anniversary: 'Jubiläum',
  'certificate-expiry': 'Zertifikat',
  'patient-birthday': 'Patient:in Geb.',
  'patient-visit': 'QPR-Visite',
};

const typeIcons: Record<UnifiedEventType, IconDefinition> = {
  join: faArrowRightToBracket,
  leave: faArrowRightFromBracket,
  'name-change': faArrowRightToBracket,
  'note-change': faArrowRightToBracket,
  'fte-change': faArrowRightToBracket,
  'weekly-hours-change': faArrowRightToBracket,
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
  birthday: faCakeCandles,
  anniversary: faAward,
  'certificate-expiry': faCertificate,
  'patient-birthday': faCakeCandles,
  'patient-visit': faClipboardList,
};

const allEventTypes: UnifiedEventType[] = [
  'join',
  'leave',
  'name-change',
  'note-change',
  'fte-change',
  'weekly-hours-change',
  'care-visit',
  'emergency-training',
  'custom',
  'birthday',
  'anniversary',
  'certificate-expiry',
  'patient-birthday',
  'patient-visit',
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
