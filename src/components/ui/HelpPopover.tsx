import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export type HelpEntry = {
  title: string;
  body: React.ReactNode;
};

type HelpPopoverProps = {
  /** All background notes for one screen, in reading order. */
  entries: HelpEntry[];
  /** Named after the screen, so the popover says what it explains. */
  heading?: string;
  label?: string;
  /** Which edge the panel lines up with; dialogs and page headers open to the left. */
  align?: 'start' | 'end';
};

/** Hover has to survive the gap between trigger and panel. */
const CLOSE_DELAY = 160;

const HelpPopover = ({ entries, heading, label = 'Hilfe', align = 'end' }: HelpPopoverProps) => {
  const [open, setOpen] = useState(false);
  // Clicking pins the panel so it survives the pointer leaving it.
  const [pinned, setPinned] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      setPinned(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (anchorRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setPinned(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  if (entries.length === 0) return null;

  const show = () => {
    cancelClose();
    setOpen(true);
  };

  const hide = () => {
    if (pinned) return;
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  return (
    <div
      className="cd-helpover-anchor"
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        className={`cd-help-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          const next = !(open && pinned);
          setPinned(next);
          setOpen(next);
        }}
      >
        <Icon name="help" size={16} />
        {label && <span>{label}</span>}
      </button>

      {open && (
        <div
          className={`cd-helpover cd-helpover-${align}`}
          role="dialog"
          aria-label={heading ?? label}
        >
          {heading && <div className="cd-helpover-head">{heading}</div>}
          {entries.map((entry) => (
            <section key={entry.title} className="cd-helpover-entry">
              <h4>{entry.title}</h4>
              <div>{entry.body}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpPopover;
