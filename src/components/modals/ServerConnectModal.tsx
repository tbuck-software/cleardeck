import React, { useEffect, useRef, useState } from 'react';
import Dialog from '../ui/Dialog';
import Checkbox from '../ui/Checkbox';
import api from '../../services/api';
import { userFacingErrorMessage } from '../../utils/errorMessage';

export type ServerConnectVariant = 'open' | 'transfer' | 'login';

const COPY: Record<ServerConnectVariant, { title: string; subtitle: string; primary: string }> = {
  open: {
    title: 'Serverbestand öffnen',
    subtitle: 'Mit einem eingerichteten ClearDeck-Server verbinden. Der lokale Bestand bleibt unverändert.',
    primary: 'Verbinden',
  },
  transfer: {
    title: 'Lokalen Bestand übertragen',
    subtitle:
      'Der gesamte lokale Bestand einschließlich Klientendaten wird auf einen leeren Server kopiert. Die lokale Kopie bleibt erhalten.',
    primary: 'Übertragen und verbinden',
  },
  login: {
    title: 'Anmeldung ändern',
    subtitle: 'Passwort und Datenschlüssel werden nicht gespeichert und bei jeder Anmeldung abgefragt.',
    primary: 'Anmelden',
  },
};

const generateKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join(''));
};

type FormOptions = {
  variant: ServerConnectVariant | null;
  initialUrl?: string;
  initialUsername?: string;
  onConnected: () => void;
};

/** One connect attempt; secrets are reset whenever the form (re)opens. */
export const useServerConnectForm = ({ variant, initialUrl = '', initialUsername = '', onConnected }: FormOptions) => {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dataKey, setDataKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transfer = variant === 'transfer';

  useEffect(() => {
    if (!variant) return;
    setUrl(initialUrl);
    setUsername(initialUsername);
    setPassword('');
    setDataKey(variant === 'transfer' ? generateKey() : '');
    setKeySaved(false);
    setCopied(false);
    setError(null);
  }, [variant, initialUrl, initialUsername]);

  const complete = Boolean(url.trim() && username.trim() && password && dataKey && (!transfer || keySaved));

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.connection.connect({ url: url.trim(), username: username.trim(), password, dataKey, initialize: transfer });
      onConnected();
    } catch (failure) {
      setError(userFacingErrorMessage(failure));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(dataKey);
      setCopied(true);
    } catch {
      setError('Kopieren nicht möglich. Bitte den Schlüssel markieren und manuell kopieren.');
    }
  };

  const regenerateKey = () => {
    setDataKey(generateKey());
    setKeySaved(false);
    setCopied(false);
  };

  return {
    transfer, url, setUrl, username, setUsername, password, setPassword, dataKey, setDataKey,
    keySaved, setKeySaved, copied, busy, error, complete, submit, copyKey, regenerateKey,
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
      <div className="field">
        <label htmlFor="server-url">Serveradresse</label>
        <input id="server-url" className="input" type="url" placeholder="https://cleardeck.meine-firma.de" value={form.url} onChange={(event) => form.setUrl(event.target.value)} autoCapitalize="none" spellCheck={false} />
      </div>
      <div className="cd-field-grid">
        <div className="field">
          <label htmlFor="server-username">Benutzername</label>
          <input id="server-username" className="input" autoComplete="username" value={form.username} onChange={(event) => form.setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="server-password">Serverpasswort</label>
          <input id="server-password" ref={passwordRef} className="input" type="password" autoComplete="current-password" value={form.password} onChange={(event) => form.setPassword(event.target.value)} />
        </div>
      </div>

      {form.transfer ? (
        <>
          <div className="field">
            <div id="server-data-key-label" className="connection-label">Neuer Datenschlüssel</div>
            <div className="connection-key" aria-labelledby="server-data-key-label" aria-live="polite">{form.dataKey}</div>
            <div className="connection-key-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void form.copyKey()}>
                {form.copied ? 'Kopiert' : 'Kopieren'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={form.regenerateKey}>
                Neu erzeugen
              </button>
            </div>
          </div>
          <Checkbox className="connection-consent" checked={form.keySaved} onChange={(event) => form.setKeySaved(event.target.checked)}>
            Ich habe den Schlüssel sicher abgelegt. Ohne ihn können die Daten nicht wiederhergestellt werden.
          </Checkbox>
        </>
      ) : (
        <div className="field">
          <label htmlFor="server-data-key">Datenschlüssel</label>
          <input id="server-data-key" className="input" type="password" autoComplete="off" value={form.dataKey} onChange={(event) => form.setDataKey(event.target.value)} aria-describedby="server-key-help" />
          <p id="server-key-help" className="cd-muted-13">Den Schlüssel erhältst du von der Person, die den Serverbestand eingerichtet hat.</p>
        </div>
      )}
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
        <ServerConnectFields form={form} rememberedAccount={Boolean(options.initialUrl && options.initialUsername)} />
        {/* Enter submits; the visible action lives in the dialog footer. */}
        <button type="submit" hidden />
      </form>
      {form.error && <p role="alert" className="cd-notice cd-notice-bad">{form.error}</p>}
    </Dialog>
  );
};

export default ServerConnectModal;
