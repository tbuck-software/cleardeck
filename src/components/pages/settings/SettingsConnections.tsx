import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import SettingsRow from '../../ui/SettingsRow';
import ConfirmModal from '../../modals/ConfirmModal';
import ServerConnectModal, { displayServerAddress, type ServerConnectVariant } from '../../modals/ServerConnectModal';
import UpdateSourceModal from '../../modals/UpdateSourceModal';
import type { ConfirmState } from '../../../types/ui';
import type { ServerConnection, ServerRole, SyncStatus } from '../../../shared/serverConnection';
import type { UpdatePreferences } from '../../../shared/updatePreferences';
import { userFacingErrorMessage } from '../../../utils/errorMessage';
import { switchToLocalConfirm, waitingChangesLabel } from '../../../utils/serverConnectionCopy';

const reload = () => window.location.reload();
const POLL_MS = 3000;

type NoticeKind = 'bad' | 'accent' | 'neutral';

const STATUS: Record<SyncStatus, { label: string; tag: string; notice?: NoticeKind }> = {
  synced: { label: 'Synchronisiert', tag: 'tag-accent-2' },
  syncing: { label: 'Synchronisierung läuft', tag: 'tag-accent' },
  pending: { label: 'Ausstehende Änderungen', tag: 'tag-accent' },
  offline: { label: 'Offline', tag: 'tag-neutral', notice: 'neutral' },
  conflict: { label: 'Konflikt', tag: 'tag-bad', notice: 'bad' },
  'auth-required': { label: 'Anmeldung erforderlich', tag: 'tag-bad', notice: 'accent' },
  error: { label: 'Synchronisierungsfehler', tag: 'tag-bad', notice: 'bad' },
};

const ROLE_LABEL: Record<ServerRole, string> = {
  admin: 'Administration',
  editor: 'Lesen und bearbeiten',
  reader: 'Nur lesen',
};

const syncStatusOf = (snapshot: ServerConnection): SyncStatus => {
  if (snapshot.syncStatus && snapshot.syncStatus in STATUS) return snapshot.syncStatus;
  return snapshot.connected ? 'synced' : 'auth-required';
};

const noticeText = (status: SyncStatus, snapshot: ServerConnection, pending: number): string | null => {
  switch (status) {
    case 'offline':
      return 'Der Server ist nicht erreichbar. Änderungen werden auf diesem Gerät gespeichert und später übertragen.';
    case 'conflict':
      return `${pending === 1 ? 'Eine lokale Änderung passt' : `${pending} lokale Änderungen passen`} nicht mehr zum Serverstand. Entscheide, welche Version gilt.`;
    case 'auth-required':
      return pending > 0
        ? `Die Anmeldung ist abgelaufen. ${waitingChangesLabel(pending)} auf Übertragung, bis du dich erneut anmeldest.`
        : 'Die Anmeldung ist abgelaufen. Melde dich erneut an, um weiter zu synchronisieren.';
    case 'error':
      return snapshot.syncError ?? 'Die letzte Synchronisierung ist fehlgeschlagen.';
    default:
      return null;
  }
};

const formatDateTime = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
};

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
    }, POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    api.updates.getPreferences().then(setUpdates).catch((failure) => setError(userFacingErrorMessage(failure)));
  }, []);

  /** Sync actions update the snapshot in place; switching the data source reloads the app. */
  const perform = async (action: () => Promise<unknown>, { reloadAfter = false, optimistic = false } = {}) => {
    setBusy(true);
    setError(null);
    if (optimistic) setConnection((current) => (current ? { ...current, syncStatus: 'syncing' } : current));
    try {
      await action();
      if (reloadAfter) onDataSourceChanged();
      else setConnection(await api.connection.get());
    } catch (failure) {
      const message = userFacingErrorMessage(failure);
      setError(message);
      if (optimistic) {
        setConnection((current) => (current ? { ...current, syncStatus: 'error', syncError: message } : current));
      }
    } finally {
      setBusy(false);
    }
  };

  const server = connection?.mode === 'server' ? connection : null;
  const status = server ? syncStatusOf(server) : null;
  const pending = server?.pendingChanges ?? 0;
  const canWrite = server?.role === 'editor' || server?.role === 'admin';
  const needsSignIn = Boolean(server && (!server.connected || status === 'auth-required'));
  const notice = server && status ? noticeText(status, server, pending) : null;

  const requestConflictResolution = (choice: 'server' | 'local') => {
    const serverChoice = choice === 'server';
    const scope = pending === 1 ? 'die ausstehende lokale Änderung' : `ALLE ${pending} ausstehenden lokalen Änderungen`;
    setConfirm({
      title: serverChoice ? 'Serverversion übernehmen?' : 'Lokale Änderungen erneut senden?',
      message: serverChoice
        ? `Das betrifft ${scope}. ClearDeck legt zuerst eine Wiederherstellungssicherung an, verwirft sie dann und übernimmt den Serverstand.`
        : `Das betrifft ${scope}. ClearDeck legt zuerst eine Wiederherstellungssicherung an und reicht sie gegen die neuesten Serverversionen erneut ein. Einzelne Änderungen können weiterhin abgelehnt werden.`,
      confirmLabel: serverChoice ? 'Serverversion übernehmen' : 'Lokale Änderungen erneut senden',
      danger: serverChoice,
      onConfirm: () => perform(() => api.connection.resolveConflict(choice), { optimistic: true }),
    });
  };

  const discardRow = (
    <SettingsRow
      title="Serverversion übernehmen…"
      note={`Sichert und verwirft ${pending === 1 ? 'die ausstehende Änderung' : `${pending} ausstehende Änderungen`}`}
      disabled={busy}
      onClick={() => requestConflictResolution('server')}
    />
  );

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

        {connection && !server && (
          <>
            <div className="connection-status">
              <span className="tag tag-neutral">Lokal</span>
              <span className="cd-muted-14">Der Bestand liegt auf diesem Gerät.</span>
            </div>
            <div className="connection-rows">
              <SettingsRow
                title="Serverbestand öffnen…"
                note="Mit deinem Konto bei einem eingerichteten ClearDeck-Server anmelden"
                onClick={() => setConnectVariant('open')}
              />
              <SettingsRow
                title="Lokalen Bestand auf Server übertragen…"
                note="Nur auf einen leeren Server, mit Administratorkonto · die lokale Kopie bleibt erhalten"
                onClick={() => setConnectVariant('transfer')}
              />
            </div>
          </>
        )}

        {server && status && (
          <>
            <div className="connection-status-block">
              <div className="connection-status">
                <span className={`tag ${STATUS[status].tag}`}>{STATUS[status].label}</span>
                <span className="cd-muted-14">
                  {[displayServerAddress(server.url), server.username, server.role && ROLE_LABEL[server.role]]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {(server.lastSyncedAt || (pending > 0 && status !== 'conflict' && status !== 'auth-required')) && (
                <span className="cd-muted-13">
                  {[
                    server.lastSyncedAt && `Zuletzt synchronisiert ${formatDateTime(server.lastSyncedAt)}`,
                    pending > 0 && status !== 'conflict' && status !== 'auth-required' && waitingChangesLabel(pending),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>

            {notice && STATUS[status].notice && (
              <p role={STATUS[status].notice === 'neutral' ? 'status' : 'alert'} className={`cd-notice cd-notice-${STATUS[status].notice}`} style={{ margin: 0 }}>
                {notice}
              </p>
            )}

            <div className="connection-rows">
              {status === 'conflict' && pending > 0 && (
                <>
                  {discardRow}
                  {canWrite && (
                    <SettingsRow
                      title="Lokale Änderungen erneut senden…"
                      note="Gegen den aktuellen Serverstand; einzelne Änderungen können abgelehnt werden"
                      disabled={busy}
                      onClick={() => requestConflictResolution('local')}
                    />
                  )}
                </>
              )}

              {needsSignIn ? (
                <>
                  <SettingsRow
                    title="Erneut anmelden…"
                    note={`Mit deinem Konto bei ${displayServerAddress(server.url)}`}
                    disabled={busy}
                    onClick={() => setConnectVariant('relogin')}
                  />
                  {status === 'auth-required' && pending > 0 && discardRow}
                </>
              ) : (
                <>
                  {status !== 'conflict' && (
                    <SettingsRow
                      title={busy ? 'Synchronisiere …' : status === 'offline' || status === 'error' ? 'Erneut versuchen' : 'Jetzt synchronisieren'}
                      note={canWrite ? 'Wartende Änderungen senden und neue abrufen' : 'Neue Änderungen vom Server abrufen'}
                      disabled={busy}
                      onClick={() => void perform(() => api.connection.refresh(), { optimistic: true })}
                    />
                  )}
                  <SettingsRow
                    title="Anmeldung ändern…"
                    note="Anderes Konto oder anderen Server verwenden"
                    disabled={busy}
                    onClick={() => setConnectVariant('login')}
                  />
                </>
              )}

              <SettingsRow
                title="Zum lokalen Bestand wechseln…"
                note="Den bisherigen Bestand auf diesem Gerät öffnen"
                disabled={busy}
                onClick={() =>
                  setConfirm(
                    switchToLocalConfirm(pending, () => void perform(() => api.connection.local(), { reloadAfter: true })),
                  )
                }
              />
            </div>
          </>
        )}
      </section>

      <section className="connection-section" aria-labelledby="updates-heading">
        <h2 id="updates-heading" className="cd-h3">
          Updates
        </h2>
        {updates && (
          <div className="connection-status">
            <span className="cd-muted-14">
              {displayServerAddress(updates.repositoryUrl)}
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
        initialUrl={connectVariant === 'login' || connectVariant === 'relogin' ? server?.url : undefined}
        initialUsername={connectVariant === 'login' || connectVariant === 'relogin' ? server?.username : undefined}
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
