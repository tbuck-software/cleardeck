import React from 'react';

const levels = [
  { value: 0, label: '–', short: 'Offen', full: 'Offen' },
  { value: 1, label: '1', short: 'Unterwies.', full: 'Unterwiesen' },
  { value: 2, label: '2', short: 'Beobacht.', full: 'Beobachtet' },
  { value: 3, label: '3', short: 'U. Aufsicht', full: 'Unter Aufsicht' },
  { value: 4, label: '4', short: 'Selbstst.', full: 'Selbstständig' },
  { value: 5, label: '5', short: 'Anleiten', full: 'Kann anleiten' },
] as const;

type CompetencyLevelPickerProps = {
  value: number;
  onChange: (level: number | null) => void;
};

const CompetencyLevelPicker = ({
  value,
  onChange,
}: CompetencyLevelPickerProps) => {
  return (
    <div
      className="clp"
      role="radiogroup"
      aria-label="Kompetenzstufe"
      style={{ '--clp-fill': `${(value / 5) * 100}%` } as React.CSSProperties}
    >
      <div className="clp-rail">
        <div className="clp-rail-fill" />
      </div>

      {levels.map((level) => {
        const isActive = level.value === value;
        const isFilled = value > 0 && level.value > 0 && level.value < value;
        const isAhead = level.value > value || (value === 0 && level.value > 0);

        return (
          <button
            key={level.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`Stufe ${level.value}: ${level.full}`}
            className={[
              'clp-node',
              isActive && 'clp-node--active',
              isFilled && 'clp-node--filled',
              isAhead && 'clp-node--ahead',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(level.value === 0 ? null : level.value)}
          >
            <span className="clp-dot">{level.label}</span>
            <span className="clp-desc">{level.short}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CompetencyLevelPicker;
