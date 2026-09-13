import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import SettingsRow from '../../ui/SettingsRow';
import ConfirmModal from '../../modals/ConfirmModal';
import ServerConnectModal, { type ServerConnectVariant } from '../../modals/ServerConnectModal';
import UpdateSourceModal from '../../modals/UpdateSourceModal';
import type { ConfirmState } from '../../../types/ui';
import type { ServerConnection, SyncStatus } from '../../../shared/serverConnection';
import type { UpdatePreferences } from '../../../shared/updatePreferences';
import { userFacingErrorMessage } from '../../../utils/errorMessage';

const displayUrl = (value?: string) => (value ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const reload = () => window.location.reload();

type ConflictChoice = 'server' | 'local';

const STATUS_COPY: Record<SyncStatus, { label: string; tagClass: string }> = {
  synced: { label: 'Synchronisiert', tagClass: 'tag-accent-2' },
  pending: { label: 'Ausstehende Änderungen', tagClass: 'tag-accent' },
  offline: { label: 'Offline', tagClass: 'tag-neutral' },
  syncing: { label: 'Synchronisierung läuft', tagClass: 'tag-accent' },
  conflict: { label: 'Konflikt', tagClass: 'tag-bad' },
  'auth-required': { label: 'Anmeldung erforderlich', tagClass: 'tag-neutral' },
  error: { label: 'Synchronisierungsfehler', tagClass: 'tag-bad' },
};

const syncStatusOf = (snapshot: ServerConnection): SyncStatus => {
  if (snapshot.mode !== 'server') return 'synced';
  if (snapshot.syncStatus && snapshot.syncStatus in STATUS_COPY) return snapshot.syncStatus;
  return snapshot.connected ? 'synced' : 'auth-required';
};

const formatLastSyncedAt = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE');
};

const pendingLabel = (count: number) =>
  count === 1 ? '1 ausstehende lokale Änderung' : `${count} ausstehende lokale Änderungen`;

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
    let mounted = true;
    const readConnection = async () => {
      try {
        const snapshot = await api.connection.get();
        if (!mounted) return;
        setConnection(snapshot);
        setError(null);
      } catch (failure) {
        if (mounted) setError(userFacingErrorMessage(failure));
      }
    };

    void readConnection();
    const interval = window.setInterval(() => {
      void readConnection();
    }, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    api.updates.getPreferences().then(setUpdates).catch((failure) => setError(userFacingErrorMessage(failure)));
  }, []);

  const perform = async (action: () => Promise<unknown>, reloadAfter = false) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (!reloadAfter) {
        // refresh/resolveConflict mutate the main-process snapshot but return no state.
        setConnection(await api.connection.get());
      }
      if (reloadAfter) onDataSourceChanged();
    } catch (failure) {
      const message = userFacingErrorMessage(failure);
      setError(message);
      setConnection((current) => {
        if (!current || current.mode !== 'server' || syncStatusOf(current) !== 'syncing') return current;
        return { ...current, syncStatus: 'error', syncError: message };
      });
    } finally {
      setBusy(false);
    }
  };

  const server = connection?.mode === 'server';
  const role = connection?.role;
  const roleLabel = role === 'admin'
    ? 'Administration'
    : role === 'editor'
      ? 'Lesen und bearbeiten'
      : role === 'reader'
        ? 'Nur lesen'
        : null;
  const syncStatus = connection && server ? syncStatusOf(connection) : null;
  const statusCopy = syncStatus ? STATUS_COPY[syncStatus] : null;
  const pendingChanges = connection?.pendingChanges ?? 0;
  const lastSyncedAt = formatLastSyncedAt(connection?.lastSyncedAt);
  const canResolveQueue = Boolean(
    connection &&
      pendingChanges > 0 &&
      (syncStatus === 'conflict' || syncStatus === 'auth-required'),
  );

  const synchronizeNow = () => {
    setConnection((current) => (current ? { ...current, syncStatus: 'syncing' } : current));
    void perform(() => api.connection.refresh());
  };

  const requestConflictResolution = (choice: ConflictChoice) => {
    const serverChoice = choice === 'server';
    setConfirm({
      title: serverChoice ? 'Serverversion übernehmen?' : 'Lokale Änderungen erneut senden?',
      message: serverChoice
        ? 'Diese Aktion betrifft ALLE ausstehenden lokalen Änderungen. ClearDeck erstellt zuerst eine Wiederherstellungssicherung und verwirft danach die ausstehenden Änderungen, bevor der Serverbestand übernommen wird.'
        : 'Diese Aktion betrifft ALLE ausstehenden lokalen Änderungen. ClearDeck reicht sie gegen die neuesten Serverversionen erneut ein. Einzelne Änderungen können weiterhin abgelehnt werden.',
      confirmLabel: serverChoice ? 'Serverversion übernehmen' : 'Lokale Änderungen erneut senden',
      danger: serverChoice,
      onConfirm: () => {
        setConnection((current) => (current ? { ...current, syncStatus: 'syncing' } : current));
        return perform(() => api.connection.resolveConflict(choice));
      },
    });
  };

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
              <>
                <span className="tag tag-neutral">Server</span>
                {statusCopy && <span className={`tag ${statusCopy.tagClass}`}>{statusCopy.label}</span>}
              </>
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
            {server && pendingChanges > 0 && (
              <span className="cd-muted-13">{pendingLabel(pendingChanges)}</span>
            )}
            {server && lastSyncedAt && (
              <span className="cd-muted-13">Zuletzt synchronisiert: {lastSyncedAt}</span>
            )}
          </div>
        )}

        {server && connection?.syncError && (
          <p className="cd-muted-13" style={{ margin: 0 }}>
            {connection.syncError}
          </p>
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
                title={busy ? 'Synchronisiere …' : 'Jetzt synchronisieren'}
                note="Lokale Änderungen senden und neue Änderungen abrufen"
                disabled={busy}
                onClick={synchronizeNow}
              />
            )}
            <SettingsRow
              title={connection.connected ? 'Anmeldung ändern…' : 'Beim Server anmelden…'}
              note="Anderes Konto oder anderen Server verwenden"
              disabled={busy}
              onClick={() => setConnectVariant('login')}
            />
            {canResolveQueue && (
              <>
                <SettingsRow
                  title={syncStatus === 'auth-required' ? 'Serverstand übernehmen…' : 'Konflikt lösen: Serverversion übernehmen…'}
                  note="Erstellt eine Wiederherstellungssicherung und verwirft danach alle ausstehenden lokalen Änderungen."
                  disabled={busy}
                  onClick={() => requestConflictResolution('server')}
                />
                {(role === 'editor' || role === 'admin') && (
                  <SettingsRow
                    title="Konflikt lösen: Lokale Änderungen erneut senden…"
                    note="Reicht alle ausstehenden lokalen Änderungen gegen die neuesten Serverversionen erneut ein."
                    disabled={busy}
                    onClick={() => requestConflictResolution('local')}
                  />
                )}
              </>
            )}
            <SettingsRow
              title="Zum lokalen Bestand wechseln…"
              note="Den bisherigen lokalen Bestand auf diesem Gerät öffnen"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: 'Zum lokalen Bestand wechseln?',
                  message:
                    'Der lokale Bestand dieses Geräts wird geöffnet. Serverarbeitsbereiche und ausstehende Änderungen bleiben dem jeweiligen Konto zugeordnet; Serverdaten werden nicht in den lokalen Bestand übertragen.',
                  confirmLabel: 'Lokalen Bestand öffnen',
                  onConfirm: () => void perform(() => api.connection.local(), true),
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
