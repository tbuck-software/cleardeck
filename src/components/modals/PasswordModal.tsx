import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import Icon from '../ui/Icon';

/** Rough strength, only to steer away from the obviously weak. */
export const passwordScore = (password: string): number =>
  Math.min(
    4,
    (password.length >= 8 ? 1 : 0) +
      (password.length >= 12 ? 1 : 0) +
      (/[0-9]/.test(password) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(password) ? 1 : 0),
  );

const HINTS = ['zu kurz', 'schwach', 'brauchbar', 'gut', 'stark'];

const BAR_COLORS = [
  'var(--bad-800)',
  'var(--bad-800)',
  'var(--color-accent-500)',
  'var(--color-accent-2-500)',
  'var(--ok-800)',
];

type PasswordModalProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { currentPassword: string; newPassword: string }) => void;
  onClose: () => void;
};

const PasswordModal = ({ open, busy, error, onSubmit, onClose }: PasswordModalProps) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setRepeat('');
  }, [open]);

  const score = passwordScore(next);
  const matches = next.length > 0 && next === repeat;
  const valid = current.length > 0 && score >= 2 && matches;

  return (
    <Dialog
      open={open}
      width={520}
      title="Passwort ändern"
      subtitle="Der neue Schlüssel wird sofort aus dem Passwort abgeleitet."
      primaryLabel="Passwort ändern"
      primaryDisabled={!valid || busy}
      onPrimary={() => onSubmit({ currentPassword: current, newPassword: next })}
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="password-current">Aktuelles Passwort</label>
        <input
          id="password-current"
          className="input"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </div>

      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="password-new">Neues Passwort</label>
          <input
            id="password-new"
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password-repeat">Wiederholen</label>
          <input
            id="password-repeat"
            className="input"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="cd-pw-bar"
            style={{ background: index < score ? BAR_COLORS[score] : 'var(--color-neutral-300)' }}
          />
        ))}
        <span className="cd-muted-13" style={{ marginLeft: 8, minWidth: 80 }}>
          {next ? HINTS[score] : ''}
        </span>
      </div>

      {repeat.length > 0 && !matches && (
        <p className="cd-muted-13" style={{ margin: 0, color: 'var(--bad-800)' }}>
          Die Passwörter stimmen nicht überein.
        </p>
      )}

      {error && (
        <div className="cd-notice cd-notice-bad" role="alert">
          <Icon name="warning" />
          <span>{error}</span>
        </div>
      )}

      <p className="cd-muted-13" style={{ margin: 0 }}>
        Der Recovery-Key bleibt gültig. Backups bleiben mit ihrem bisherigen Passwort lesbar.
      </p>
    </Dialog>
  );
};

export default PasswordModal;
