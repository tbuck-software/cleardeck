import React, { useState } from 'react';
import Icon from '../ui/Icon';
import Segmented from '../ui/Segmented';
import type { StorageMode } from '../../shared/types';
import logoUrl from '../../assets/logo.png';

type AuthScreenProps = {
  mode: 'setup' | 'login' | 'loading' | 'error';
  onSubmit: (payload: { password: string; storageMode: StorageMode }) => Promise<void>;
  busy: boolean;
  message?: string | null;
  onForgotPassword?: () => void;
  onResetApp?: () => void | Promise<void>;
  globalError?: string | null;
  footer?: React.ReactNode;
  /** Storage mode of the existing installation; 'plain' locks without a password. */
  configuredStorageMode?: StorageMode;
};

const AuthScreen = ({
  mode,
  onSubmit,
  busy,
  message,
  onForgotPassword,
  onResetApp,
  globalError,
  footer,
  configuredStorageMode = 'encrypted',
}: AuthScreenProps) => {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [storageMode, setStorageMode] = useState<StorageMode>('encrypted');
  const [error, setError] = useState<string | null>(null);

  const isSetup = mode === 'setup';
  // A plain installation has no password to ask for — the lock is only a cover.
  const screenLockOnly = mode === 'login' && configuredStorageMode === 'plain';
  const needsPassword = !screenLockOnly && (mode === 'login' || storageMode === 'encrypted');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (isSetup && storageMode === 'encrypted') {
      if (!password.trim()) {
        setError('Bitte ein Passwort eingeben.');
        return;
      }
      if (password !== repeat) {
        setError('Passwörter stimmen nicht überein.');
        return;
      }
    }
    await onSubmit({ password, storageMode });
    setPassword('');
    setRepeat('');
  };

  const displayError = error ?? globalError ?? null;

  if (mode === 'loading' || mode === 'error') {
    return (
      <div className="auth-screen">
        <div className="auth-panel">
          <img src={logoUrl} alt="" className="auth-logo" />
          <div>
            <h1 className="auth-title">
              {mode === 'loading' ? 'Lokale Daten werden geprüft' : 'Lokale Daten nicht verfügbar'}
            </h1>
            {mode === 'error' && (
              <p className="cd-muted" style={{ margin: 0 }}>
                Bitte die vorhandenen Dateien sichern und die Konfiguration prüfen lassen.
              </p>
            )}
          </div>
          {mode === 'error' && globalError && (
            <div className="cd-notice cd-notice-bad" role="alert">
              <Icon name="warning" />
              <span>{globalError}</span>
            </div>
          )}
        </div>
        {footer && <div className="auth-corner">{footer}</div>}
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <img src={logoUrl} alt="" className="auth-logo" />
        <div>
          <h1 className="auth-title">
            {isSetup ? 'ClearDeck einrichten' : screenLockOnly ? 'Bildschirm verdeckt' : 'ClearDeck entsperren'}
          </h1>
          <p className="cd-muted" style={{ margin: 0 }}>
            {isSetup
              ? 'Alle Daten bleiben auf diesem Gerät. Passwort setzen, um die Datenbank zu verschlüsseln.'
              : screenLockOnly
                ? 'Weiterarbeiten, wo du aufgehört hast.'
                : 'Alle Daten bleiben auf diesem Gerät. Passwort eingeben, um die verschlüsselte Datenbank zu öffnen.'}
          </p>
        </div>

        {isSetup && (
          <Segmented
            ariaLabel="Speichermodus"
            options={[
              { value: 'encrypted' as StorageMode, label: 'Verschlüsselt' },
              { value: 'plain' as StorageMode, label: 'Ohne Passwort' },
            ]}
            value={storageMode}
            onChange={setStorageMode}
          />
        )}

        {needsPassword && (
          <div className="field" style={{ width: '100%' }}>
            <label htmlFor="auth-password">Passwort</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              style={{ minHeight: 44 }}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete={isSetup ? 'new-password' : 'current-password'}
            />
          </div>
        )}

        {isSetup && storageMode === 'encrypted' && (
          <div className="field" style={{ width: '100%' }}>
            <label htmlFor="auth-repeat">Passwort wiederholen</label>
            <input
              id="auth-repeat"
              className="input"
              type="password"
              style={{ minHeight: 44 }}
              placeholder="••••••••"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        )}

        {isSetup && storageMode === 'plain' && (
          <div className="cd-notice cd-notice-bad" role="note">
            <Icon name="warning" />
            <span>
              <strong>Nicht empfohlen für Patientendaten.</strong> Kein Passwort, kein Recovery-Key.
            </span>
          </div>
        )}

        {displayError && (
          <div className="cd-notice cd-notice-bad" role="alert">
            <Icon name="warning" />
            <span>{displayError}</span>
          </div>
        )}
        {message && <p className="cd-muted-14" style={{ margin: 0 }}>{message}</p>}

        <button type="submit" className="btn btn-primary" style={{ minHeight: 44, paddingInline: 22 }} disabled={busy}>
          {busy
            ? 'Bitte warten…'
            : isSetup
              ? storageMode === 'encrypted'
                ? 'Verschlüsselung aktivieren'
                : 'Ohne Passwort starten'
              : screenLockOnly
                ? 'Weiter'
                : 'Entsperren'}
        </button>

        {!isSetup && !screenLockOnly && (onForgotPassword || onResetApp) && (
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            {onForgotPassword && (
              <button type="button" className="cd-link" onClick={onForgotPassword}>
                Recovery-Key verwenden
              </button>
            )}
            {onResetApp && (
              <button
                type="button"
                className="cd-link cd-muted"
                disabled={busy}
                onClick={() => void onResetApp()}
              >
                Neu einrichten
              </button>
            )}
          </div>
        )}

      </form>
      {footer && <div className="auth-corner">{footer}</div>}
    </div>
  );
};

export default AuthScreen;
