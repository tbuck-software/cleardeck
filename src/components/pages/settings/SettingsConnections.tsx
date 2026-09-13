import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import SettingsRow from '../../ui/SettingsRow';
import ConfirmModal from '../../modals/ConfirmModal';
import ServerConnectModal, { type ServerConnectVariant } from '../../modals/ServerConnectModal';
import UpdateSourceModal from '../../modals/UpdateSourceModal';
import type { ConfirmState } from '../../../types/ui';
import type { ServerConnection } from '../../../shared/serverConnection';
import type { UpdatePreferences } from '../../../shared/updatePreferences';
import { userFacingErrorMessage } from '../../../utils/errorMessage';

const displayUrl = (value?: string) => (value ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const reload = () => window.location.reload();

type SettingsConnectionsProps = {
  onNotice: (message: string) => void;
  /** Runs after the data source changed; the app has to load the other workspace. */
  onDataSourceChanged?: () => void;
};

const SettingsConnections = ({ onNotice, onDataSourceChanged = reload }: SettingsConnectionsProps) => {
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [updates, setUpdates] = useState<UpdatePreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectVariant, setConnectVariant] = useState<ServerConnectVariant | null>(null);
  const [editingUpdates, setEditingUpdates] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    api.connection.get().then(setConnection).catch((failure) => setError(userFacingErrorMessage(failure)));
    api.updates.getPreferences().then(setUpdates).catch((failure) => setError(userFacingErrorMessage(failure)));
  }, []);

  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDataSourceChanged();
    } catch (failure) {
      setError(userFacingErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const server = connection?.mode === 'server';
  const roleLabel = connection?.role === 'reader' ? 'Nur lesen' : 'Lesen und bearbeiten';

  return (
    <div className="cd-page cd-narrow">
      <header>
        <h1 className="cd-h1" style={{ marginTop: 0 }}>
          Verbindungen
        </h1>
      </header>

      {error && (
        <p role="alert" className="cd-notice cd-notice-bad" style={{ margin: 0 }}>
          {error}
        </p>
      )}

      <section className="connection-section" aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="cd-h3">
          Datenablage
        </h2>
        {!connection && !error && <span role="status" className="cd-muted-14">Lädt …</span>}
        {connection && (
          <div className="connection-status">
            {server ? (
              <span className={`tag ${connection.connected ? 'tag-accent-2' : 'tag-bad'}`}>
                {connection.connected ? 'Server' : 'Nicht verbunden'}
              </span>
            ) : (
              <span className="tag tag-neutral">Lokal</span>
            )}
            <span className="cd-muted-14">
              {server
                ? [displayUrl(connection.url), connection.username, connection.connected && roleLabel]
                    .filter(Boolean)
                    .join(' · ')
                : 'Der Bestand liegt auf diesem Gerät.'}
            </span>
          </div>
        )}

        {connection && !server && (
          <div className="connection-rows">
            <SettingsRow
              title="Serverbestand öffnen…"
              note="Mit einem eingerichteten ClearDeck-Server verbinden"
              onClick={() => setConnectVariant('open')}
            />
            <SettingsRow
              title="Lokalen Bestand auf Server übertragen…"
              note="Nur bei leerem Server · die lokale Kopie bleibt erhalten"
              onClick={() => setConnectVariant('transfer')}
            />
          </div>
        )}

        {server && (
          <div className="connection-rows">
            {connection.connected && (
              <SettingsRow
                title={busy ? 'Lädt neu …' : 'Serverbestand neu laden'}
                note="Schließt offene Eingaben. Gespeicherte Änderungen bleiben erhalten."
                disabled={busy}
                onClick={() => void perform(api.connection.refresh)}
              />
            )}
            <SettingsRow
              title={connection.connected ? 'Anmeldung ändern…' : 'Beim Server anmelden…'}
              note="Anderes Konto oder anderen Server verwenden"
              disabled={busy}
              onClick={() => setConnectVariant('login')}
            />
            <SettingsRow
              title="Zum lokalen Bestand wechseln…"
              note="Öffnet wieder den Bestand auf diesem Gerät"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: 'Zum lokalen Bestand wechseln?',
                  message:
                    'Der lokale Bestand wird wieder geöffnet. Änderungen vom Server werden nicht übernommen.',
                  confirmLabel: 'Lokalen Bestand öffnen',
                  onConfirm: () => void perform(api.connection.local),
                })
              }
            />
          </div>
        )}
      </section>

      <section className="connection-section" aria-labelledby="updates-heading">
        <h2 id="updates-heading" className="cd-h3">
          Updates
        </h2>
        {updates && (
          <div className="connection-status">
            <span className="cd-muted-14">
              {displayUrl(updates.repositoryUrl)}
              {updates.hasToken ? ' · Token gespeichert' : ''}
            </span>
          </div>
        )}
        <div className="connection-rows">
          <SettingsRow
            title="Update-Quelle ändern…"
            note="GitHub-Repository und optionaler Zugriffstoken"
            disabled={!updates}
            onClick={() => setEditingUpdates(true)}
          />
        </div>
      </section>

      <ServerConnectModal
        variant={connectVariant}
        initialUrl={connectVariant === 'login' ? connection?.url : undefined}
        initialUsername={connectVariant === 'login' ? connection?.username : undefined}
        onClose={() => setConnectVariant(null)}
        onConnected={onDataSourceChanged}
      />
      <UpdateSourceModal
        preferences={editingUpdates ? updates : null}
        onClose={() => setEditingUpdates(false)}
        onSaved={(saved, message) => {
          setUpdates(saved);
          setEditingUpdates(false);
          onNotice(message);
        }}
      />
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

export default SettingsConnections;
