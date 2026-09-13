import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import ConfirmModal from '../modals/ConfirmModal';
import ServerConnectModal, { ServerConnectFields, useServerConnectForm } from '../modals/ServerConnectModal';
import Icon from '../ui/Icon';
import type { ConfirmState } from '../../types/ui';
import type { ServerConnection } from '../../shared/serverConnection';
import { userFacingErrorMessage } from '../../utils/errorMessage';
import logoUrl from '../../assets/logo.png';

const reload = () => window.location.reload();

/** Start screen while the configured server still needs a sign-in. */
export const ServerSignIn = () => {
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
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
          <h1 className="auth-title">Beim Server anmelden</h1>
          <p className="cd-muted" style={{ margin: 0 }}>
            Passwort und Datenschlüssel werden bei jeder Anmeldung abgefragt.
          </p>
        </div>
        <ServerConnectFields form={form} rememberedAccount={Boolean(connection?.url && connection.username)} />
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
        <button
          type="button"
          className="cd-link"
          style={{ fontSize: 13 }}
          onClick={() =>
            setConfirm({
              title: 'Zum lokalen Bestand wechseln?',
              message: 'Der lokale Bestand wird wieder geöffnet. Änderungen vom Server werden nicht übernommen.',
              confirmLabel: 'Lokalen Bestand öffnen',
              onConfirm: () => void switchToLocal(),
            })
          }
        >
          Zum lokalen Bestand wechseln
        </button>
      </form>
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
