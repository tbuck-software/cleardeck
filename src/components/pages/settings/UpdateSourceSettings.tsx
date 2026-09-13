import React, { useEffect, useState } from 'react';

import api from '../../../services/api';
import {
  DEFAULT_UPDATE_REPOSITORY_URL,
  type UpdatePreferences,
} from '../../../shared/updatePreferences';
import { userFacingErrorMessage } from '../../../utils/errorMessage';

type Notice = {
  kind: 'success' | 'error';
  text: string;
};

const UPDATE_ERROR_FALLBACK = 'Die Update-Quelle konnte nicht gespeichert werden.';

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
        setNotice({ kind: 'error', text: userFacingErrorMessage(error, UPDATE_ERROR_FALLBACK) });
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
      setNotice({ kind: 'error', text: userFacingErrorMessage(error, UPDATE_ERROR_FALLBACK) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="update-source-heading">
      <details>
        <summary className="cd-item" style={{ listStyle: 'none' }}>
          <span id="update-source-heading" style={{ fontWeight: 600 }}>
            Update-Quelle
          </span>
          <span className="cd-arrow" aria-hidden="true">
            →
          </span>
        </summary>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}
          aria-busy={busy}
        >
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

          <div className="field">
            <label htmlFor="update-repository-token">Persönlicher Zugriffstoken</label>
            <input
              id="update-repository-token"
              className="input"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={
                hasToken ? 'Neuen Token eingeben zum Ersetzen' : 'Optional für private Repositories'
              }
              disabled={!loaded || busy}
            />
            {hasToken && (
              <button
                type="button"
                className="cd-link cd-danger-link"
                onClick={() => void save(true)}
                disabled={busy}
              >
                Gespeicherten Token entfernen
              </button>
            )}
          </div>

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
