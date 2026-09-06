import React, { useEffect, useRef } from 'react';
import Icon from './Icon';
import HelpPopover, { type HelpEntry } from './HelpPopover';

type DialogProps = {
  open: boolean;
  manageFocus?: boolean;
  title: string;
  subtitle?: string;
  /** Design widths run 460–620px; pass the one the screen specifies. */
  width?: number;
  children?: React.ReactNode;
  /** Background notes for this dialog, collected behind the head's help button. */
  help?: HelpEntry[];
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryDanger?: boolean;
  cancelLabel?: string;
  deleteLabel?: string;
  onPrimary?: () => void;
  onDelete?: () => void;
  onClose: () => void;
};

const Dialog = ({
  open,
  manageFocus = false,
  title,
  subtitle,
  width = 480,
  children,
  help,
  primaryLabel,
  primaryDisabled,
  primaryDanger,
  cancelLabel = 'Abbrechen',
  deleteLabel,
  onPrimary,
  onDelete,
  onClose,
}: DialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      }
      if (manageFocus && event.key === 'Tab') {
        const targets = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('*') ?? [],
        ).filter(
          (element) =>
            element.matches('button, input, select, textarea, a[href], [tabindex="0"]') &&
            !element.matches(':disabled, [hidden], [tabindex="-1"], input[type="hidden"]'),
        );

        const first = targets[0];
        const last = targets[targets.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (manageFocus && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, manageFocus]);
  useEffect(() => {
    if (open && manageFocus) {
      (
        dialogRef.current?.querySelector<HTMLElement>('select, input, textarea') ??
        dialogRef.current?.querySelector<HTMLElement>('button') ??
        dialogRef.current
      )?.focus();
    }
  }, [open, manageFocus, title]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop cd-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
        ref={dialogRef}
        tabIndex={manageFocus ? -1 : undefined}
        style={{ width: `min(${width}px, 100%)`, margin: '0 auto' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cd-dialog-head">
          <div className="dialog-title" style={{ fontSize: 24 }}>
            {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {help && <HelpPopover heading={title} entries={help} />}
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Schließen"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        {subtitle && <p className="cd-dialog-sub">{subtitle}</p>}

        {children}

        <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            {deleteLabel && onDelete && (
              <button type="button" className="btn btn-ghost cd-danger-link" onClick={onDelete}>
                {deleteLabel}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {cancelLabel}
            </button>
            {primaryLabel && onPrimary && (
              <button
                type="button"
                className="btn btn-primary"
                style={primaryDanger ? { background: 'var(--bad-800)' } : undefined}
                disabled={primaryDisabled}
                onClick={onPrimary}
              >
                {primaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
