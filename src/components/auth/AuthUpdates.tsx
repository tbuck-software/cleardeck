import type { UpdateStatus } from '../../shared/types';
import UpdateErrorDetails from '../ui/UpdateErrorDetails';

type AuthUpdatesProps = {
  status: UpdateStatus;
  version?: string;
  onCheck: () => Promise<void>;
  onInstall: () => Promise<void>;
};

const AuthUpdates = ({ status, version, onCheck, onInstall }: AuthUpdatesProps) => {
  const messages: Record<UpdateStatus['state'], string> = {
    idle: 'Updates können auch vor der Anmeldung geprüft werden.',
    checking: 'Suche nach Updates …',
    available: 'Ein Update ist verfügbar.',
    'not-available': 'Kein neueres Update gefunden.',
    downloading: 'Update wird heruntergeladen …',
    downloaded: 'Update bereit zur Installation.',
    error: 'Das Update konnte nicht abgeschlossen werden.',
  };
  const busy = status.state === 'checking' || status.state === 'available' || status.state === 'downloading';

  return (
    <div className="auth-updates">
      {version && <p>ClearDeck {version}</p>}
      <p role="status">{messages[status.state]}</p>
      {status.state === 'error' && <UpdateErrorDetails key={status.message} message={status.message} />}
      <div className="auth-actions">
        {status.state === 'downloaded' ? (
          <button type="button" className="primary" onClick={() => void onInstall()}>Update installieren und neu starten</button>
        ) : (
          <button type="button" className="ghost-button" onClick={() => void onCheck()} disabled={busy}>Updates prüfen</button>
        )}
      </div>
    </div>
  );
};

export default AuthUpdates;
