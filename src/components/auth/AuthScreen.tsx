import React, { useState } from 'react';
import type { StorageMode } from '../../shared/types';

type AuthScreenProps = {
  mode: 'setup' | 'login' | 'loading' | 'error';
  onSubmit: (payload: { password: string; storageMode: StorageMode }) => Promise<void>;
  busy: boolean;
  message?: string | null;
  onForgotPassword?: () => void;
  onResetApp?: () => void | Promise<void>;
  globalError?: string | null;
  footer?: React.ReactNode;
};

const AuthScreen = ({ mode, onSubmit, busy, message, onForgotPassword, onResetApp, globalError, footer }: AuthScreenProps) => {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [storageMode, setStorageMode] = useState<StorageMode>('encrypted');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError(null);
    if (mode === 'setup' && storageMode === 'encrypted' && password !== repeat) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (mode === 'setup' && storageMode === 'encrypted' && !password.trim()) {
      setError('Bitte ein Passwort eingeben.');
      return;
    }
    await onSubmit({ password, storageMode });
    setPassword('');
    setRepeat('');
  };

  const displayError = error ?? globalError ?? null;
  const isSetup = mode === 'setup';
  const isEncrypted = mode === 'login' || storageMode === 'encrypted';

  if (mode === 'loading' || mode === 'error') {
    return (
      <div className="auth-screen">
        <div className="auth-panel auth-panel-startup">
          <div className="auth-intro">
            <h1>{mode === 'loading' ? 'Lokale Daten werden geprüft' : 'Lokale Daten nicht verfügbar'}</h1>
            {mode === 'error' && <p className="auth-summary">Bitte die vorhandenen Dateien sichern und die Konfiguration prüfen lassen.</p>}
          </div>
          {mode === 'error' && <div className="error" role="alert">{globalError}</div>}
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className={`auth-screen auth-screen-${mode}`}>
      <div className="auth-panel">
        <div className="auth-intro">
          <h1>{isSetup ? 'Ersteinrichtung' : 'Anmeldung'}</h1>
          <p className="auth-summary">
            {isSetup ? 'Alles bleibt auf diesem Gerät.' : 'Mit deinem lokalen Passwort entsperren.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form auth-form-panel">
          {isSetup && (
            <div className="auth-mode-switch" role="radiogroup" aria-label="Speichermodus">
              <button
                type="button"
                role="radio"
                aria-checked={storageMode === 'encrypted'}
                className={`auth-mode-option ${storageMode === 'encrypted' ? 'active' : ''}`}
                onClick={() => setStorageMode('encrypted')}
              >
                <span className="auth-mode-title">Verschlüsselt</span>
                <span className="auth-mode-meta">Mit Passwort</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={storageMode === 'plain'}
                className={`auth-mode-option ${storageMode === 'plain' ? 'active' : ''}`}
                onClick={() => setStorageMode('plain')}
              >
                <span className="auth-mode-title">Ohne Passwort</span>
                <span className="auth-mode-meta">Direkt lokal</span>
              </button>
            </div>
          )}
          {isEncrypted && (
            <div className="auth-field-grid">
              <label>
                Passwort
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                />
              </label>
              {isSetup && storageMode === 'encrypted' && (
                <label>
                  Passwort wiederholen
                  <input
                    type="password"
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>
              )}
            </div>
          )}
          {isSetup && storageMode === 'plain' && (
            <div className="auth-mode-note auth-mode-warning" role="note" aria-live="polite">
              <strong>Nicht empfohlen für Patientendaten.</strong>
              <span>Kein Passwort. Kein Recovery Key.</span>
            </div>
          )}
          {displayError && <div className="error">{displayError}</div>}
          {message && <div className="info">{message}</div>}
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? 'Bitte warten…'
              : isSetup
                ? storageMode === 'encrypted'
                  ? 'Verschlüsselung aktivieren'
                  : 'Ohne Passwort starten'
                : 'Entsperren'}
          </button>
          {!isSetup && (onForgotPassword || onResetApp) && (
            <div className="auth-actions">
              {onForgotPassword && (
                <button className="ghost-button" type="button" onClick={onForgotPassword}>
                  Recovery Key nutzen
                </button>
              )}
              {onResetApp && (
                <button className="ghost-button danger" type="button" onClick={() => void onResetApp()} disabled={busy}>
                  Neu anlegen
                </button>
              )}
            </div>
          )}
        </form>
        {footer}
      </div>
    </div>
  );
};

export default AuthScreen;
