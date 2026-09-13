import React, { useEffect, useState } from 'react';

import api from '../../../services/api';
import {
  DEFAULT_UPDATE_REPOSITORY_URL,
  type UpdatePreferences,
} from '../../../shared/updatePreferences';

type Notice = {
  kind: 'success' | 'error';
  text: string;
};

const errorText = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : 'Die Update-Quelle konnte nicht gespeichert werden.';

const UpdateSourceSettings = () => {
  const [repositoryUrl, setRepositoryUrl] = useState(DEFAULT_UPDATE_REPOSITORY_URL);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    api.updates
      .getPreferences()
      .then((preferences: UpdatePreferences) => {
        if (!active) return;
        setRepositoryUrl(preferences.repositoryUrl);
        setHasToken(preferences.hasToken);
      })
      .catch((error) => {
        if (!active) return;
        setNotice({ kind: 'error', text: errorText(error) });
      })
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const save = async (removeToken = false) => {
    setBusy(true);
    setNotice(null);
    try {
      const enteredToken = token.trim();
      const input = removeToken
        ? { repositoryUrl, token: '' }
        : enteredToken
          ? { repositoryUrl, token: enteredToken }
          : { repositoryUrl };
      const preferences = await api.updates.savePreferences(input);
      setRepositoryUrl(preferences.repositoryUrl);
      setHasToken(preferences.hasToken);
      setToken('');
      setNotice({
        kind: 'success',
        text: removeToken ? 'Gespeicherten Token entfernt.' : 'Update-Quelle gespeichert.',
      });
    } catch (error) {
      setNotice({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="update-source-heading"
      style={{
        borderTop: '1px solid var(--color-divider)',
        paddingTop: 22,
      }}
    >
      <details>
        <summary
          style={{
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span id="update-source-heading" className="cd-h3" style={{ fontSize: 22 }}>
              Update-Quelle
            </span>
            <span className="cd-muted-13">
              {!loaded ? 'Lädt …' : hasToken ? 'Token gespeichert' : 'Ohne Token'}
            </span>
          </span>
        </summary>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 18 }}
          aria-busy={busy}
        >
          <p className="cd-muted-14" style={{ margin: 0, maxWidth: 650 }}>
            Updates kommen aus diesem GitHub-Repository. Für ein privates Repository kannst du
            unten einen persönlichen Zugriffstoken mit Leserechten hinterlegen. Für ein
            öffentliches Repository bleibt das Feld leer.
          </p>

          <div className="field">
            <label htmlFor="update-repository-url">GitHub-Repository</label>
            <input
              id="update-repository-url"
              className="input"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder={DEFAULT_UPDATE_REPOSITORY_URL}
              disabled={!loaded || busy}
              required
            />
          </div>

          <fieldset
            style={{
              border: 0,
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <legend style={{ fontSize: 12, color: 'var(--color-neutral-700)', padding: 0 }}>
              Zugriff auf privates Repository
            </legend>
            <input
              id="update-repository-token"
              className="input"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={hasToken ? 'Neuen Token eingeben zum Ersetzen' : 'Optionaler Zugriffstoken'}
              disabled={!loaded || busy}
              aria-label="Persönlicher Zugriffstoken"
            />
            <p className="cd-muted-13" style={{ margin: 0 }}>
              Der Token wird nur auf diesem Gerät verschlüsselt gespeichert und nie angezeigt.
            </p>
            {hasToken && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost cd-danger-link"
                  onClick={() => void save(true)}
                  disabled={busy}
                >
                  Gespeicherten Token entfernen
                </button>
              </div>
            )}
          </fieldset>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={!loaded || busy}>
              {busy ? 'Speichert …' : 'Update-Quelle speichern'}
            </button>
            {notice && (
              <span
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className={notice.kind === 'error' ? 'cd-danger-link' : 'cd-muted-14'}
              >
                {notice.text}
              </span>
            )}
          </div>
        </form>
      </details>
    </section>
  );
};

export default UpdateSourceSettings;
