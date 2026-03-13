import React, { useState } from 'react';
import type { StorageMode } from '../../shared/types';

type AuthScreenProps = {
  mode: 'setup' | 'login';
  onSubmit: (payload: { password: string; storageMode: StorageMode }) => Promise<void>;
  busy: boolean;
  message?: string | null;
  onForgotPassword?: () => void;
  globalError?: string | null;
};

const AuthScreen = ({ mode, onSubmit, busy, message, onForgotPassword, globalError }: AuthScreenProps) => {
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

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-title">
          <h1>{mode === 'setup' ? 'Ersteinrichtung' : 'Anmeldung'}</h1>
          <p>
            Lokale Datenbank (SQLite) mit Dateiverschlüsselung und Passwortschutz. Halte das Passwort sicher bereit; es
            wird nicht synchronisiert.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'setup' && (
            <label className="full-width">
              Speichermodus
              <select
                value={storageMode}
                onChange={(e) => setStorageMode(e.target.value as StorageMode)}
              >
                <option value="encrypted">Verschlüsselt (mit Passwort)</option>
                <option value="plain">Unverschlüsselt (ohne Passwort)</option>
              </select>
            </label>
          )}
          {(mode === 'login' || storageMode === 'encrypted') && (
            <label>
              Passwort
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </label>
          )}
          {mode === 'setup' && storageMode === 'encrypted' && (
            <label>
              Passwort wiederholen
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
                placeholder="••••••••"
              />
            </label>
          )}
          {mode === 'setup' && storageMode === 'plain' && (
            <div className="info">
              Es wird kein Passwort und kein Recovery Key eingerichtet. Die Datenbank bleibt lokal unverschlüsselt.
            </div>
          )}
          {displayError && <div className="error">{displayError}</div>}
          {message && <div className="info">{message}</div>}
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? 'Bitte warten…'
              : mode === 'setup'
                ? storageMode === 'encrypted'
                  ? 'Passwort setzen'
                  : 'Ohne Verschlüsselung starten'
                : 'Login'}
          </button>
          {mode === 'login' && onForgotPassword && (
            <button className="ghost-button" type="button" onClick={onForgotPassword}>
              Passwort vergessen? Recovery Key nutzen
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
