import React, { useEffect, useRef, useState } from 'react';

export type ActionMenuItem = { label: string; onSelect: () => void };

type Props = {
  items: ActionMenuItem[];
  /** Trigger content. Set ariaLabel instead when the trigger is icon-only. */
  children: React.ReactNode;
  ariaLabel?: string;
  triggerClassName?: string;
};

/** Dropdown used by the page headers: scrim closes it, Escape returns focus. */
const ActionMenu = ({
  items,
  children,
  ariaLabel,
  triggerClassName = 'btn btn-secondary',
}: Props) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="cd-menu-anchor">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
      {open && (
        <>
          <div className="cd-menu-scrim" onClick={() => setOpen(false)} />
          <div className="cd-menu" role="menu">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ActionMenu;
