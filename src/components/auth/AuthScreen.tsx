import React, { useState } from 'react';

type AuthScreenProps = {
  mode: 'setup' | 'login';
  onSubmit: (password: string) => Promise<void>;
  busy: boolean;
  message?: string | null;
  onForgotPassword?: () => void;
  globalError?: string | null;
};

const AuthScreen = ({ mode, onSubmit, busy, message, onForgotPassword, globalError }: AuthScreenProps) => {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError(null);
    if (mode === 'setup' && password !== repeat) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    await onSubmit(password);
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
          {mode === 'setup' && (
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
          {displayError && <div className="error">{displayError}</div>}
          {message && <div className="info">{message}</div>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Bitte warten…' : mode === 'setup' ? 'Passwort setzen' : 'Login'}
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
