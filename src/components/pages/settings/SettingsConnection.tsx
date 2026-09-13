import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import type { ServerConnection } from '../../../shared/serverConnection';
import { userFacingErrorMessage } from '../../../utils/errorMessage';

type Props = { allowTransfer?: boolean; onChanged?: () => void };
const reload = () => window.location.reload();

export default function SettingsConnection({ allowTransfer = false, onChanged = reload }: Props) {
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

  useEffect(() => {
    api.connection.get().then((value) => {
      setConnection(value);
      setUrl(value.url ?? '');
      setUsername(value.username ?? '');
      setShowForm(value.mode === 'server' && !value.connected);
    }).catch((failure) => setError(userFacingErrorMessage(failure)));
  }, []);

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
      <header className="connection-heading">
        <div>
          <h2 id="connection-heading" className="cd-h2">Datenablage</h2>
          <p className="cd-muted-13">
            {connection?.mode === 'server' ? 'Gemeinsamer Bestand auf deinem ClearDeck-Server.' : 'Standardmäßig bleiben deine Daten auf diesem Gerät.'}
          </p>
        </div>
        <span className="tag">{connection?.mode === 'server' ? 'Server' : 'Lokal'}</span>
      </header>
      {error && <p role="alert" className="connection-error">{error}</p>}
      {connection?.mode === 'server' && (
        <div className="connection-current">
          <strong>{connection.url}</strong>
          <span>{connection.username} · {connection.connected ? (connection.role === 'reader' ? 'Nur lesen' : 'Lesen und bearbeiten') : 'Nicht angemeldet'}</span>
          <p className="cd-muted-13">Der lokale Bestand bleibt getrennt erhalten. Beim Zurückwechseln werden keine Serverdaten auf den lokalen Bestand übertragen.</p>
          <div className="connection-actions">
            {connection.connected && <button className="btn" disabled={busy} onClick={() => void perform(api.connection.refresh)}>Serverbestand neu laden</button>}
            <button className="btn" disabled={busy} onClick={() => void perform(api.connection.local)}>Zum lokalen Bestand wechseln</button>
            {connection.connected && <button className="btn" disabled={busy} onClick={() => setShowForm(!showForm)}>Andere Anmeldung</button>}
          </div>
          {connection.connected && <p className="cd-muted-13">Neu laden schließt offene Eingaben. Bereits gespeicherte Änderungen bleiben erhalten.</p>}
        </div>
      )}
      {connection?.mode === 'local' && !showForm && (
        <button className="btn" onClick={() => setShowForm(true)}>Mit einem Server verbinden</button>
      )}
      {showForm && (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (initialize && !keySaved) { setError('Bitte den Datenschlüssel zuerst sicher ablegen.'); return; }
          void perform(() => api.connection.connect({ url, username, password, dataKey, initialize }));
        }}>
          <fieldset disabled={busy} className="connection-fields">
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
              <input id="server-data-key" className="input" type="password" required autoComplete="off" value={dataKey} onChange={(event) => { setDataKey(event.target.value); setKeySaved(false); }} aria-describedby="server-key-help" />
              <p id="server-key-help" className="cd-muted-13">Alle Geräte benötigen denselben Schlüssel. Er wird nicht an den Server gesendet und muss bei jeder Anmeldung erneut eingegeben werden. Du erhältst ihn von der Person, die den Bestand eingerichtet hat.</p>
            </div>
            {allowTransfer && connection?.mode === 'local' && (
              <div className="connection-transfer">
                <label><input type="checkbox" checked={initialize} onChange={(event) => setInitialize(event.target.checked)} /> Den gesamten lokalen Bestand einschließlich Klientendaten auf einen leeren Server übertragen</label>
                {initialize && <>
                  <p className="cd-muted-13">Der lokale Bestand bleibt erhalten. Verwende seinen Recovery-Key oder erzeuge einen eigenen Datenschlüssel für den Server.</p>
                  <button type="button" className="btn" onClick={generateKey}>Datenschlüssel erzeugen</button>
                  {dataKey && <div className="connection-key"><code>{dataKey}</code></div>}
                  <label><input type="checkbox" checked={keySaved} onChange={(event) => setKeySaved(event.target.checked)} /> Ich habe den Schlüssel sicher abgelegt. Ohne ihn können die Daten nicht wiederhergestellt werden.</label>
                </>}
              </div>
            )}
            <p className="cd-muted-13">Das Serverkonto und der Datenschlüssel gelten für den gesamten Bestand. Eine Internetverbindung ist während der Nutzung erforderlich.</p>
            <div className="connection-actions">
              <button className="btn btn-primary" type="submit">{busy ? 'Verbinde …' : initialize ? 'Übertragen und verbinden' : 'Verbinden'}</button>
              {connection?.mode === 'local' && <button className="btn" type="button" onClick={() => { setShowForm(false); setPassword(''); setDataKey(''); }}>Abbrechen</button>}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
