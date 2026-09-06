import React from 'react';
import { COMPETENCY_LEVELS, LEGACY_COMPETENCY_LEVELS } from '../../utils/competencyLevels';

type CompetencyLevelPickerProps = {
  value: number;
  legacy?: boolean;
  onChange: (level: number) => void;
};

const CompetencyLevelPicker = ({ value, onChange, legacy = false }: CompetencyLevelPickerProps) => (
  <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Kompetenzstufe">
    {(legacy
      ? LEGACY_COMPETENCY_LEVELS
      : COMPETENCY_LEVELS
    ).map((label, level) => {
      const active = value === level;
      return (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(level)}
          style={{
            flex: 1,
            border: `2px solid ${active ? 'var(--color-accent)' : 'var(--color-divider)'}`,
            background: active ? 'var(--color-accent)' : 'transparent',
            color: active ? '#fff' : 'inherit',
            borderRadius: 'var(--radius-md)',
            padding: '10px 4px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ font: '700 20px/1 var(--font-heading)', letterSpacing: '-0.02em' }}>
            {level === 0 ? '–' : level}
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{label}</div>
        </button>
      );
    })}
  </div>
);

export default CompetencyLevelPicker;
