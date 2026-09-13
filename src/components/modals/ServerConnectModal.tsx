import React, { useEffect, useRef, useState } from 'react';
import Dialog from '../ui/Dialog';
import api from '../../services/api';
import { userFacingErrorMessage } from '../../utils/errorMessage';

export type ServerConnectVariant = 'open' | 'transfer' | 'login';

const COPY: Record<ServerConnectVariant, { title: string; subtitle: string; primary: string }> = {
  open: {
    title: 'Serverbestand öffnen',
    subtitle: 'Mit deinem ClearDeck-Konto anmelden. Der lokale Bestand bleibt unverändert.',
    primary: 'Verbinden',
  },
  transfer: {
    title: 'Lokalen Bestand übertragen',
    subtitle:
      'Der gesamte lokale Bestand einschließlich Klientendaten wird auf einen leeren Server übertragen. Die lokale Kopie bleibt erhalten. Dafür ist ein Administratorkonto erforderlich.',
    primary: 'Übertragen und verbinden',
  },
  login: {
    title: 'Anmeldung ändern',
    subtitle: '',
    primary: 'Anmelden',
  },
};

type FormOptions = {
  variant: ServerConnectVariant | null;
  initialUrl?: string;
  initialUsername?: string;
  onConnected: () => void;
};

type SubmitOptions = {
  offline?: boolean;
};

export const normalizeServerAddress = (value: string): string => {
  const input = value.trim();
  if (!input) throw new Error('Bitte eine Serveradresse eingeben.');
  let address: URL;
  try {
    address = new URL(input);
  } catch {
    throw new Error('Bitte eine gültige Serveradresse eingeben.');
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

const displayServerAddress = (value: string): string =>
  value.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** One connect attempt; secrets are reset whenever the form (re)opens. */
export const useServerConnectForm = ({ variant, initialUrl = '', initialUsername = '', onConnected }: FormOptions) => {
  const [url, setUrlState] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const transfer = variant === 'transfer';

  useEffect(() => {
    if (!variant) return;
    setUrlState(initialUrl);
    setUsername(initialUsername);
    setPassword('');
    setError(null);
    setAddressOpen(false);
    setAddressDraft(initialUrl);
    setAddressError(null);
  }, [variant, initialUrl, initialUsername]);

  const complete = Boolean(url.trim() && username.trim() && password);

  const openAddressEditor = () => {
    setAddressDraft(url);
    setAddressError(null);
    setAddressOpen(true);
  };

  const cancelAddressEditor = () => {
    setAddressOpen(false);
    setAddressError(null);
  };

  const applyAddressEditor = (): boolean => {
    try {
      const normalized = normalizeServerAddress(addressDraft);
      if (normalized !== url) {
        setPassword('');
        setError(null);
      }
      setUrlState(normalized);
      setAddressOpen(false);
      setAddressError(null);
      return true;
    } catch (failure) {
      setAddressError(failure instanceof Error ? failure.message : 'Die Serveradresse ist ungültig.');
      return false;
    }
  };

  const submit = async ({ offline = false }: SubmitOptions = {}) => {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.connection.connect({
        url: url.trim(),
        username: username.trim(),
        password,
        initialize: transfer,
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

  return {
    transfer,
    url,
    setUrl: setUrlState,
    username,
    setUsername,
    password,
    setPassword,
    busy,
    error,
    complete,
    submit,
    addressOpen,
    addressDraft,
    setAddressDraft,
    addressError,
    openAddressEditor,
    cancelAddressEditor,
    applyAddressEditor,
  };
};

export type ServerConnectForm = ReturnType<typeof useServerConnectForm>;

export const ServerConnectFields = ({ form, rememberedAccount }: { form: ServerConnectForm; rememberedAccount: boolean }) => {
  const passwordRef = useRef<HTMLInputElement>(null);
  // Runs after the dialog's own first-field focus, so a known account lands on the password.
  useEffect(() => {
    if (!rememberedAccount) return;
    const frame = requestAnimationFrame(() => passwordRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [rememberedAccount]);

  return (
    <fieldset disabled={form.busy}>
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
      <div className="connection-status" style={{ justifyContent: 'space-between', gap: 10 }}>
        <span className="cd-muted-14" title={form.url}>
          {form.url ? displayServerAddress(form.url) : 'Noch nicht eingerichtet'}
        </span>
        <button type="button" className="cd-link" onClick={form.openAddressEditor}>
          {form.url ? 'Server ändern…' : 'Server einrichten…'}
        </button>
      </div>
    </fieldset>
  );
};

export const ServerAddressDialog = ({ form }: { form: ServerConnectForm }) => {
  if (!form.addressOpen) return null;
  const hasAddress = Boolean(form.url.trim());
  const title = hasAddress ? 'Serveradresse ändern' : 'Server einrichten';
  return (
    <Dialog
      open
      manageFocus
      width={520}
      title={title}
      primaryLabel="Übernehmen"
      primaryDisabled={!form.addressDraft.trim()}
      onPrimary={() => form.applyAddressEditor()}
      onClose={form.cancelAddressEditor}
    >
      <form
        className="connection-fields"
        onSubmit={(event) => {
          event.preventDefault();
          form.applyAddressEditor();
        }}
      >
        <div className="field">
          <label htmlFor="server-address-draft">Serveradresse</label>
          <input
            id="server-address-draft"
            className="input"
            type="url"
            placeholder="https://cleardeck.meine-firma.de"
            value={form.addressDraft}
            onChange={(event) => form.setAddressDraft(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        {form.addressError && <p role="alert" className="cd-notice cd-notice-bad">{form.addressError}</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
};

type ServerConnectModalProps = FormOptions & { onClose: () => void };

const ServerConnectModal = ({ onClose, ...options }: ServerConnectModalProps) => {
  const form = useServerConnectForm(options);
  if (!options.variant) return null;
  if (form.addressOpen) return <ServerAddressDialog form={form} />;
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
        <ServerConnectFields form={form} rememberedAccount={Boolean(options.initialUrl && options.initialUsername)} />
        {/* Enter submits; the visible action lives in the dialog footer. */}
        <button type="submit" hidden />
      </form>
      {form.error && <p role="alert" className="cd-notice cd-notice-bad">{form.error}</p>}
    </Dialog>
  );
};

export default ServerConnectModal;
