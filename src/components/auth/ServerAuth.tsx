import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import ConfirmModal from '../modals/ConfirmModal';
import ServerConnectModal, {
  ServerConnectFields,
  displayServerAddress,
  useServerConnectForm,
} from '../modals/ServerConnectModal';
import Icon from '../ui/Icon';
import type { ConfirmState } from '../../types/ui';
import type { ServerConnection } from '../../shared/serverConnection';
import { userFacingErrorMessage } from '../../utils/errorMessage';
import { switchToLocalConfirm, waitingChangesLabel } from '../../utils/serverConnectionCopy';
import logoUrl from '../../assets/logo.png';

const reload = () => window.location.reload();

/** Start screen while the configured server still needs a sign-in. */
export const ServerSignIn = () => {
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [otherServer, setOtherServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useServerConnectForm({
    variant: 'login',
    initialUrl: connection?.url,
    initialUsername: connection?.username,
    onConnected: reload,
  });

  useEffect(() => {
    api.connection.get().then(setConnection).catch((failure) => setError(userFacingErrorMessage(failure)));
  }, []);

  // The offline copy belongs to the remembered account only.
  const offlineAvailable = Boolean(connection?.hasOfflineCopy && form.username.trim() === connection.username);
  const pendingChanges = connection?.pendingChanges ?? 0;

  const switchToLocal = async () => {
    try {
      await api.connection.local();
      reload();
    } catch (failure) {
      setError(userFacingErrorMessage(failure));
    }
  };

  const shownError = form.error ?? error;

  return (
    <div className="auth-screen">
      <form
        className="auth-panel connection-fields"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <img src={logoUrl} alt="" className="auth-logo" />
        <div>
          <h1 className="auth-title">Bei ClearDeck anmelden</h1>
          <p className="cd-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
            {connection?.url ? `Serverbestand auf ${displayServerAddress(connection.url)}` : 'Serverbestand'}
            {pendingChanges > 0 && ` · ${waitingChangesLabel(pendingChanges)} auf Übertragung`}
          </p>
        </div>
        <ServerConnectFields
          form={form}
          address="hidden"
          rememberedAccount={Boolean(connection?.url && connection.username)}
        />
        {shownError && (
          <div className="cd-notice cd-notice-bad" role="alert">
            <Icon name="warning" />
            <span>{shownError}</span>
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ minHeight: 44, paddingInline: 22 }}
          disabled={!form.complete || form.busy}
        >
          {form.busy ? 'Verbinde …' : 'Anmelden'}
        </button>
        <div className="connection-auth-links">
          {offlineAvailable && (
            <button
              type="button"
              className="cd-link"
              title="Mit dem Passwort deiner letzten Online-Anmeldung, ohne Serverkontakt"
              disabled={form.busy}
              onClick={() => void form.submit({ offline: true })}
            >
              Offline öffnen
            </button>
          )}
          <button type="button" className="cd-link cd-muted" disabled={form.busy} onClick={() => setOtherServer(true)}>
            Anderer Server…
          </button>
          <button
            type="button"
            className="cd-link cd-muted"
            disabled={form.busy}
            onClick={() => setConfirm(switchToLocalConfirm(pendingChanges, () => void switchToLocal()))}
          >
            Zum lokalen Bestand wechseln
          </button>
        </div>
      </form>
      <ServerConnectModal variant={otherServer ? 'open' : null} onClose={() => setOtherServer(false)} onConnected={reload} />
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

/** Lock-screen entry for opening an existing server workspace instead of local data. */
export const ServerConnectLink = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="cd-link connection-auth-option" onClick={() => setOpen(true)}>
        Vorhandenen Server verwenden
      </button>
      <ServerConnectModal variant={open ? 'open' : null} onClose={() => setOpen(false)} onConnected={reload} />
    </>
  );
};
