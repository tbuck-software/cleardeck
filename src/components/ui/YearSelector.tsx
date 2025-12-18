import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';

type YearSelectorProps = {
  year: number;
  currentYear: number;
  onChange: (year: number) => void;
};

const YearSelector = ({ year, currentYear, onChange }: YearSelectorProps) => (
  <div className="year-selector">
    <FontAwesomeIcon icon={faCalendarDays} />
    <input
      type="number"
      value={year}
      onChange={(e) => onChange(Number(e.target.value))}
      min={2000}
      max={2099}
    />
    <button className="ghost-button" onClick={() => onChange(currentYear)}>
      aktuelles Jahr
    </button>
  </div>
);

export default YearSelector;
