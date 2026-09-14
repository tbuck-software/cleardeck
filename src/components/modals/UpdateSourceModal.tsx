import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import api from '../../services/api';
import {
  DEFAULT_UPDATE_REPOSITORY_URL,
  type UpdatePreferences,
} from '../../shared/updatePreferences';
import { userFacingErrorMessage } from '../../utils/errorMessage';

const UPDATE_ERROR_FALLBACK = 'Die Update-Quelle konnte nicht gespeichert werden.';

type UpdateSourceModalProps = {
  preferences: UpdatePreferences | null;
  onClose: () => void;
  onSaved: (preferences: UpdatePreferences, message: string) => void;
};

/** Opens while `preferences` is set; the stored token itself never reaches the renderer. */
const UpdateSourceModal = ({ preferences, onClose, onSaved }: UpdateSourceModalProps) => {
  const [repositoryUrl, setRepositoryUrl] = useState(DEFAULT_UPDATE_REPOSITORY_URL);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preferences) return;
    setRepositoryUrl(preferences.repositoryUrl);
    setToken('');
    setError(null);
  }, [preferences]);

  if (!preferences) return null;

  const save = async (removeToken = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const enteredToken = token.trim();
      const input = removeToken
        ? { repositoryUrl, token: '' }
        : enteredToken
          ? { repositoryUrl, token: enteredToken }
          : { repositoryUrl };
      const saved = await api.updates.savePreferences(input);
      onSaved(saved, removeToken ? 'Gespeicherten Token entfernt.' : 'Update-Quelle gespeichert.');
    } catch (failure) {
      setError(userFacingErrorMessage(failure, UPDATE_ERROR_FALLBACK));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      manageFocus
      width={520}
      title="Update-Quelle"
      subtitle="GitHub-Repository, aus dem ClearDeck neue Versionen lädt."
      primaryLabel={busy ? 'Speichert …' : 'Speichern'}
      primaryDisabled={!repositoryUrl.trim() || busy}
      onPrimary={() => void save()}
      deleteLabel={preferences.hasToken ? 'Token entfernen' : undefined}
      onDelete={preferences.hasToken ? () => void save(true) : undefined}
      onClose={onClose}
    >
      <form
        className="connection-fields"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
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
              placeholder={preferences.hasToken ? 'Gespeichert · neuen Token eingeben zum Ersetzen' : 'Optional'}
              aria-describedby="update-token-help"
            />
            <p id="update-token-help" className="cd-muted-13">
              Nur für private Repositories nötig. Der Token wird geschützt auf diesem Gerät gespeichert.
            </p>
          </div>
          <button type="submit" hidden />
        </fieldset>
      </form>
      {error && <p role="alert" className="cd-notice cd-notice-bad">{error}</p>}
    </Dialog>
  );
};

export default UpdateSourceModal;
