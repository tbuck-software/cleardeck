import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import Segmented from '../../ui/Segmented';
import type { ServerConnection } from '../../../shared/serverConnection';
import { userFacingErrorMessage } from '../../../utils/errorMessage';

type Props = { allowTransfer?: boolean; initiallyOpen?: boolean; onChanged?: () => void };
const reload = () => window.location.reload();

export default function SettingsConnection({ allowTransfer = false, initiallyOpen = false, onChanged = reload }: Props) {
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dataKey, setDataKey] = useState('');
  const [initialize, setInitialize] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmLocal, setConfirmLocal] = useState(false);

  const closeForm = () => {
    setShowForm(false);
    setPassword('');
    setDataKey('');
    setInitialize(false);
    setKeySaved(false);
    setError(null);
  };

  useEffect(() => {
    api.connection.get().then((value) => {
      setConnection(value);
      setUrl(value.url ?? '');
      setUsername(value.username ?? '');
      setShowForm(initiallyOpen || (value.mode === 'server' && !value.connected));
    }).catch((failure) => setError(userFacingErrorMessage(failure)));
  }, [initiallyOpen]);

  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await action(); onChanged(); }
    catch (failure) { setError(userFacingErrorMessage(failure)); }
    finally { setBusy(false); setPassword(''); }
  };

  const generateKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setDataKey(btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join('')));
    setKeySaved(false);
  };

  return (
    <section className="connection-settings" aria-labelledby="connection-heading">
      <div id="connection-heading" className="connection-label">Datenablage</div>
      {error && <p role="alert" className="connection-error">{error}</p>}
      {!connection && !error && <span role="status">Lädt …</span>}
      {connection?.mode === 'local' && !showForm && (
        <div className="connection-summary">
          <span>Auf diesem Gerät</span>
          <button className="cd-link" onClick={() => setShowForm(true)}>Mit einem Server verbinden</button>
        </div>
      )}
      {connection?.mode === 'server' && !showForm && !confirmLocal && (
        <div className="connection-current">
          <span>{connection.url}</span>
          <span className="cd-muted-13">{connection.username} · {connection.role === 'reader' ? 'Nur lesen' : 'Lesen und bearbeiten'}</span>
          <div className="connection-actions">
            <button className="cd-link" disabled={busy} onClick={() => void perform(api.connection.refresh)} title="Schließt offene Eingaben. Gespeicherte Änderungen bleiben erhalten.">Serverbestand neu laden</button>
            <button className="cd-link" disabled={busy} onClick={() => setShowForm(true)}>Anmeldung ändern</button>
            <button className="cd-link" disabled={busy} onClick={() => setConfirmLocal(true)}>Zum lokalen Bestand wechseln</button>
          </div>
        </div>
      )}
      {confirmLocal && (
        <div className="connection-current">
          <p>Der lokale Bestand wird wieder geöffnet. Änderungen vom Server werden nicht übernommen.</p>
          <div className="connection-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => void perform(api.connection.local)}>Lokalen Bestand öffnen</button>
            <button className="btn" disabled={busy} onClick={() => setConfirmLocal(false)}>Abbrechen</button>
          </div>
        </div>
      )}
      {showForm && !confirmLocal && (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (initialize && !keySaved) { setError('Bitte den Datenschlüssel zuerst sicher ablegen.'); return; }
          void perform(() => api.connection.connect({ url, username, password, dataKey, initialize }));
        }}>
          <fieldset disabled={busy} className="connection-fields">
            {allowTransfer && connection?.mode === 'local' && (
              <div className="field">
                <Segmented
                  ariaLabel="Serverbestand"
                  options={[{ value: 'existing', label: 'Vorhandenen Bestand öffnen' }, { value: 'transfer', label: 'Lokalen Bestand übertragen' }]}
                  value={initialize ? 'transfer' : 'existing'}
                  onChange={(value) => { setInitialize(value === 'transfer'); setKeySaved(false); setError(null); }}
                  wrap
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="server-url">Serveradresse</label>
              <input id="server-url" className="input" type="url" required placeholder="https://cleardeck.meine-firma.de" value={url} onChange={(event) => setUrl(event.target.value)} autoCapitalize="none" spellCheck={false} />
            </div>
            <div className="field">
              <label htmlFor="server-username">Benutzername</label>
              <input id="server-username" className="input" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} />
            </div>
            <div className="field">
              <label htmlFor="server-password">Serverpasswort</label>
              <input id="server-password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="server-data-key">Datenschlüssel</label>
              <input id="server-data-key" className="input" type="password" required autoComplete="off" value={dataKey} onChange={(event) => { setDataKey(event.target.value); setKeySaved(false); }} aria-describedby={initialize ? undefined : 'server-key-help'} />
              {!initialize && <p id="server-key-help" className="cd-muted-13">Den Schlüssel erhältst du von der Person, die den Serverbestand eingerichtet hat.</p>}
            </div>
            {initialize && (
              <div className="connection-transfer">
                <button type="button" className="cd-link" onClick={generateKey}>Datenschlüssel erzeugen</button>
                {dataKey && <div className="connection-key"><code>{dataKey}</code></div>}
                <label><input type="checkbox" checked={keySaved} onChange={(event) => setKeySaved(event.target.checked)} /> Ich habe den Schlüssel sicher abgelegt. Ohne ihn können die Daten nicht wiederhergestellt werden.</label>
                <p className="cd-muted-13">Der gesamte lokale Bestand einschließlich Klientendaten wird auf einen leeren Server kopiert. Die lokale Kopie bleibt erhalten.</p>
              </div>
            )}
            <div className="connection-actions">
              <button className="btn btn-primary" type="submit">{busy ? 'Verbinde …' : initialize ? 'Übertragen und verbinden' : 'Verbinden'}</button>
              {(connection?.mode === 'local' || connection?.connected) && <button className="btn" type="button" onClick={closeForm}>Abbrechen</button>}
              {connection?.mode === 'server' && !connection.connected && <button className="btn" type="button" onClick={() => setConfirmLocal(true)}>Zum lokalen Bestand wechseln</button>}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
