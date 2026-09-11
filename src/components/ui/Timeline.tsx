import React from 'react';

export type TimelineEntry = {
  key: string;
  /** Already formatted for display — the timeline does no date arithmetic. */
  date: React.ReactNode;
  title: React.ReactNode;
  subline?: React.ReactNode;
  tag?: React.ReactNode;
  /** Dot colour by entry type; falls back to the accent. */
  color?: string;
  ariaLabel?: string;
  onOpen?: () => void;
};

type TimelineProps = {
  items: TimelineEntry[];
  empty?: React.ReactNode;
  /** Kurze Vorschau ohne Linie: Datum, Text und Tag in einer Zeile. */
  compact?: boolean;
  className?: string;
};

const Timeline = ({ items, empty, compact, className }: TimelineProps) => (
  <div
    className={`cd-timeline${compact ? ' cd-timeline-compact' : ''}${className ? ` ${className}` : ''}`}
  >
    {items.length === 0 && empty != null && <div className="cd-empty">{empty}</div>}
    {items.map((item) => {
      const body = (
        <>
          <span className="cd-timeline-date">{item.date}</span>
          {!compact && (
            <span className="cd-timeline-rail">
              <span style={{ background: item.color ?? 'var(--color-accent-500)' }} />
              <span />
            </span>
          )}
          <span className="cd-timeline-copy">
            <span className="cd-timeline-title">{item.title}</span>
            {item.subline != null && item.subline !== '' && (
              <span className="cd-timeline-sub">{item.subline}</span>
            )}
          </span>
          {item.tag != null && item.tag !== '' && (
            <span className="cd-timeline-tag">{item.tag}</span>
          )}
        </>
      );
      return item.onOpen ? (
        <button
          key={item.key}
          type="button"
          className="cd-timeline-row cd-timeline-open"
          aria-label={item.ariaLabel}
          onClick={item.onOpen}
        >
          {body}
        </button>
      ) : (
        <div key={item.key} className="cd-timeline-row">
          {body}
        </div>
      );
    })}
  </div>
);

export default Timeline;
