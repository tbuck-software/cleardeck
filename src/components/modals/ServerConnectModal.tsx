import React, { useEffect, useRef, useState } from 'react';
import Dialog from '../ui/Dialog';
import api from '../../services/api';
import { userFacingErrorMessage } from '../../utils/errorMessage';

export type ServerConnectVariant = 'open' | 'transfer' | 'login' | 'relogin';

const COPY: Record<ServerConnectVariant, { title: string; subtitle: string; primary: string }> = {
  open: {
    title: 'Serverbestand öffnen',
    subtitle: 'Mit deinem ClearDeck-Konto anmelden. Der lokale Bestand bleibt unverändert.',
    primary: 'Verbinden',
  },
  transfer: {
    title: 'Lokalen Bestand übertragen',
    subtitle:
      'Der gesamte lokale Bestand einschließlich Klientendaten wird auf einen leeren Server übertragen. Die lokale Kopie bleibt erhalten.',
    primary: 'Übertragen und verbinden',
  },
  login: {
    title: 'Anmeldung ändern',
    subtitle: 'Mit einem anderen Konto oder Server anmelden.',
    primary: 'Anmelden',
  },
  relogin: {
    title: 'Erneut anmelden',
    subtitle: 'Wartende Änderungen bleiben erhalten und werden nach der Anmeldung übertragen.',
    primary: 'Anmelden',
  },
};

export const normalizeServerAddress = (value: string): string => {
  const input = value.trim();
  if (!input) throw new Error('Bitte eine Serveradresse eingeben.');
  let address: URL;
  try {
    address = new URL(input);
  } catch {
    throw new Error('Bitte eine gültige Serveradresse eingeben, zum Beispiel https://cleardeck.meine-firma.de.');
  }
  if (
    address.username ||
    address.password ||
    address.search ||
    address.hash ||
    !['', '/'].includes(address.pathname)
  ) {
    throw new Error('Bitte nur die Serveradresse ohne Pfad, Zugangsdaten oder Parameter eingeben.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname);
  if (address.protocol !== 'https:' && !(address.protocol === 'http:' && loopback)) {
    throw new Error('Der Server benötigt HTTPS. HTTP ist nur auf diesem Gerät erlaubt.');
  }
  return address.origin;
};

export const displayServerAddress = (value?: string): string =>
  (value ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');

type FormOptions = {
  variant: ServerConnectVariant | null;
  initialUrl?: string;
  initialUsername?: string;
  onConnected: () => void;
};

/** One connect attempt; the password is reset whenever the form (re)opens. */
export const useServerConnectForm = ({ variant, initialUrl = '', initialUsername = '', onConnected }: FormOptions) => {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!variant) return;
    setUrl(initialUrl);
    setUsername(initialUsername);
    setPassword('');
    setError(null);
  }, [variant, initialUrl, initialUsername]);

  const complete = Boolean(url.trim() && username.trim() && password);

  const submit = async ({ offline = false } = {}) => {
    if (busy) return;
    if (!complete) {
      setError(offline ? 'Bitte das Passwort deiner letzten Online-Anmeldung eingeben.' : 'Bitte alle Felder ausfüllen.');
      return;
    }
    let address: string;
    try {
      address = normalizeServerAddress(url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Die Serveradresse ist ungültig.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.connection.connect({
        url: address,
        username: username.trim(),
        password,
        initialize: variant === 'transfer',
        ...(offline ? { offline: true } : {}),
      });
      onConnected();
    } catch (failure) {
      setError(userFacingErrorMessage(failure));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return { url, setUrl, username, setUsername, password, setPassword, busy, error, setError, complete, submit };
};

export type ServerConnectForm = ReturnType<typeof useServerConnectForm>;

type ServerConnectFieldsProps = {
  form: ServerConnectForm;
  /** Focus the password when address and account are already known. */
  rememberedAccount: boolean;
  /** The lock screen names the server in its subtitle instead. */
  showAddress?: boolean;
  usernameHint?: string;
};

export const ServerConnectFields = ({ form, rememberedAccount, showAddress = true, usernameHint }: ServerConnectFieldsProps) => {
  const passwordRef = useRef<HTMLInputElement>(null);
  // Runs after the dialog's own first-field focus.
  useEffect(() => {
    if (!rememberedAccount) return;
    const frame = requestAnimationFrame(() => passwordRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [rememberedAccount]);

  return (
    <fieldset disabled={form.busy}>
      {showAddress && (
        <div className="field">
          <label htmlFor="server-url">Serveradresse</label>
          <input
            id="server-url"
            className="input"
            type="url"
            placeholder="https://cleardeck.meine-firma.de"
            value={form.url}
            onChange={(event) => form.setUrl(event.target.value)}
            onBlur={() => {
              try {
                if (form.url.trim()) form.setUrl(normalizeServerAddress(form.url));
              } catch {
                // Reported on submit; keep the typed value editable.
              }
            }}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      )}
      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="server-username">Benutzername</label>
          <input id="server-username" className="input" autoComplete="username" value={form.username} onChange={(event) => form.setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="server-password">Passwort</label>
          <input id="server-password" ref={passwordRef} className="input" type="password" autoComplete="current-password" value={form.password} onChange={(event) => form.setPassword(event.target.value)} />
        </div>
      </div>
      {usernameHint && <p className="cd-muted-13">{usernameHint}</p>}
    </fieldset>
  );
};

type ServerConnectModalProps = FormOptions & { onClose: () => void };

const ServerConnectModal = ({ onClose, ...options }: ServerConnectModalProps) => {
  const form = useServerConnectForm(options);
  if (!options.variant) return null;
  const copy = COPY[options.variant];

  return (
    <Dialog
      open
      manageFocus
      width={520}
      title={copy.title}
      subtitle={copy.subtitle}
      primaryLabel={form.busy ? 'Verbinde …' : copy.primary}
      primaryDisabled={!form.complete || form.busy}
      onPrimary={() => void form.submit()}
      onClose={form.busy ? () => undefined : onClose}
    >
      <form
        className="connection-fields"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <ServerConnectFields
          form={form}
          rememberedAccount={Boolean(options.initialUrl && options.initialUsername)}
          usernameHint={options.variant === 'transfer' ? 'Für die Erstübertragung ist ein Administratorkonto erforderlich.' : undefined}
        />
        {/* Enter submits; the visible action lives in the dialog footer. */}
        <button type="submit" hidden />
      </form>
      {form.error && <p role="alert" className="cd-notice cd-notice-bad">{form.error}</p>}
    </Dialog>
  );
};

export default ServerConnectModal;
