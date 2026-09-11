import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

export type ComboboxOption = {
  value: string | number;
  label: string;
  code?: string;
  group?: string;
  disabled?: boolean;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

/** Umlauts and ß fold onto their base letters, so "Strumpfe" finds "Strümpfe". */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const optionText = (option: ComboboxOption): string =>
  option.code ? `${option.code} ${option.label}` : option.label;

const displayText = (option: ComboboxOption): string =>
  option.code ? `${option.code} · ${option.label}` : option.label;

const Combobox = ({
  options,
  value,
  onChange,
  placeholder,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ComboboxProps) => {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // null means "nothing typed yet" — the field then shows the selection and the full list.
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((option) => option.value === value) ?? null;
  const matches = useMemo(() => {
    const terms = normalize(query ?? '').split(/\s+/).filter(Boolean);
    if (terms.length === 0) return options;
    return options.filter((option) => {
      const haystack = normalize(optionText(option));
      return terms.every((term) => haystack.includes(term));
    });
  }, [options, query]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, ComboboxOption[]>();
    matches.forEach((option) => {
      const key = option.group ?? '';
      if (!byGroup.has(key)) {
        byGroup.set(key, []);
        order.push(key);
      }
      byGroup.get(key)?.push(option);
    });
    return order.map((key) => ({ group: key, options: byGroup.get(key) ?? [] }));
  }, [matches]);

  const flat = useMemo(() => groups.flatMap((entry) => entry.options), [groups]);
  const indexOf = (option: ComboboxOption) => flat.indexOf(option);
  const activeId = flat[highlight] ? `${baseId}-option-${indexOf(flat[highlight])}` : undefined;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, highlight, matches]);

  const openList = () => {
    setOpen(true);
    const current = selected ? flat.indexOf(selected) : -1;
    setHighlight(current >= 0 ? current : 0);
  };

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const select = (option: ComboboxOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  const move = (step: number) => {
    if (flat.length === 0) return;
    let next = highlight;
    for (let i = 0; i < flat.length; i += 1) {
      next = (next + step + flat.length) % flat.length;
      if (!flat[next].disabled) break;
    }
    setHighlight(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      const option = flat[highlight];
      if (option) select(option);
      return;
    }
    if (event.key === 'Escape') {
      if (!open) return;
      // Keeps the surrounding dialog open — Escape belongs to the popover first.
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab' && open) close();
  };

  return (
    <div className="cd-combobox" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="input cd-combobox-input"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open ? activeId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        placeholder={placeholder}
        value={query ?? (selected ? displayText(selected) : '')}
        onFocus={openList}
        onClick={() => {
          if (!open) openList();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {selected && (
        <button
          type="button"
          className="cd-combobox-clear"
          aria-label="Auswahl entfernen"
          onClick={() => {
            onChange(null);
            setQuery(null);
            inputRef.current?.focus();
          }}
        >
          <Icon name="close" size={14} />
        </button>
      )}

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          className="cd-menu cd-combobox-menu"
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onMouseDown={(event) => event.preventDefault()}
        >
          {flat.length === 0 && <p className="cd-combobox-empty">Keine Treffer.</p>}
          {groups.map((entry) => (
            <React.Fragment key={entry.group}>
              {entry.group && <p className="cd-combobox-group">{entry.group}</p>}
              {entry.options.map((option) => {
                const index = indexOf(option);
                const active = index === highlight;
                return (
                  <div
                    key={option.value}
                    id={`${baseId}-option-${index}`}
                    className={`cd-combobox-option${active ? ' is-active' : ''}`}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    data-active={active || undefined}
                    onMouseMove={() => !option.disabled && setHighlight(index)}
                    onClick={() => select(option)}
                  >
                    {option.code && (
                      <span className="tag tag-neutral cd-combobox-code">{option.code}</span>
                    )}
                    <span className="cd-combobox-label">{option.label}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default Combobox;
