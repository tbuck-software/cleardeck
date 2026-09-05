import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

export type PaletteResult = {
  id: string;
  kind: string;
  title: string;
  sub?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  results: (query: string) => PaletteResult[];
  onClose: () => void;
};

const CommandPalette = ({ open, results, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    // Synchronously: the effect runs after the input is in the DOM, and waiting
    // a frame would drop the first characters of a fast ⌘K-then-type.
    inputRef.current?.focus();
  }, [open]);

  const items = useMemo(() => (open ? results(query).slice(0, 8) : []), [open, results, query]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (items.length === 0 ? 0 : (current + 1) % items.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (items.length === 0 ? 0 : (current - 1 + items.length) % items.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[active];
      if (item) {
        onClose();
        item.run();
      }
    }
  };

  return (
    <div className="dialog-backdrop palette-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog palette"
        role="dialog"
        aria-modal="true"
        aria-label="Suchen"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-search">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Person, Patient:in, Seite oder Aktion…"
            aria-label="Suchbegriff"
          />
          <kbd className="cd-kbd">Esc</kbd>
        </div>
        <div className="palette-rule" />
        {items.length === 0 ? (
          <div className="palette-empty">Nichts gefunden.</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="cd-item"
              data-active={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => {
                onClose();
                item.run();
              }}
            >
              <span className="tag tag-neutral" style={{ flex: 'none', minWidth: 72, justifyContent: 'center' }}>
                {item.kind}
              </span>
              <span style={{ flex: 1, fontWeight: 600 }}>{item.title}</span>
              {item.sub && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{item.sub}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default CommandPalette;
