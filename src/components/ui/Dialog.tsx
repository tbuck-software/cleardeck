import React, { useEffect } from 'react';
import Icon from './Icon';

type DialogProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Design widths run 460–620px; pass the one the screen specifies. */
  width?: number;
  children?: React.ReactNode;
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
  title,
  subtitle,
  width = 480,
  children,
  primaryLabel,
  primaryDisabled,
  primaryDanger,
  cancelLabel = 'Abbrechen',
  deleteLabel,
  onPrimary,
  onDelete,
  onClose,
}: DialogProps) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop cd-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
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
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Schließen" onClick={onClose}>
            <Icon name="close" />
          </button>
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
