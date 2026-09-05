import React from 'react';

type ProgressBarProps = {
  /** 0–100, or undefined while the total is still unknown. */
  value?: number;
  label: string;
  /** Shown under the bar on the left; the percentage sits on the right. */
  note?: string;
  color?: string;
};

/**
 * The app's own bar rather than <progress>, which renders in the OS style and
 * ignores the design's tokens.
 */
const ProgressBar = ({ value, label, note, color = 'var(--color-accent)' }: ProgressBarProps) => {
  const known = typeof value === 'number' && Number.isFinite(value);
  const percent = known ? Math.max(0, Math.min(100, Math.round(value as number))) : undefined;

  return (
    <div className="cd-progress">
      <div
        className="cd-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        {known ? (
          <div className="cd-bar-fill cd-progress-fill" style={{ background: color, width: `${percent}%` }} />
        ) : (
          <div className="cd-bar-fill cd-progress-pending" style={{ background: color }} />
        )}
      </div>
      {(note || known) && (
        <div className="cd-progress-meta">
          <span>{note}</span>
          {known && <span>{percent} %</span>}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
