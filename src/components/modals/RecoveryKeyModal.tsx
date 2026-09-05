import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import type { RecoveryKeyModalState } from '../../types/ui';

type RecoveryKeyModalProps = {
  state: RecoveryKeyModalState;
  onClose: () => void;
  onCopy: (key: string) => void;
};

const RecoveryKeyModal = ({ state, onClose, onCopy }: RecoveryKeyModalProps) => {
  const [hidden, setHidden] = useState(true);

  // Re-blur whenever the dialog is reopened, so the key is never on screen by default.
  useEffect(() => {
    if (state.open) setHidden(true);
  }, [state.open]);

  if (!state.open || !state.info) return null;

  return (
    <Dialog
      open
      width={520}
      title="Recovery-Key"
      subtitle={
        state.source === 'setup'
          ? 'Direkt nach der Einrichtung offline speichern — ersetzt das Passwort im Notfall.'
          : 'Aktueller Schlüssel der Datenbank. Nur offline aufbewahren, nicht weitergeben.'
      }
      cancelLabel="Schließen"
      onClose={onClose}
    >
      <div
        className="cd-recovery-key"
        style={{ filter: hidden ? 'blur(7px)' : 'none' }}
        onClick={() => setHidden(false)}
      >
        {state.info.recoveryKey}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 13,
          color: 'var(--color-neutral-700)',
        }}
      >
        <span>
          Fingerprint <strong className="cd-mono">{state.info.fingerprint}</strong>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setHidden((value) => !value)}>
            {hidden ? 'Anzeigen' : 'Verbergen'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onCopy(state.info!.recoveryKey)}>
            Kopieren
          </button>
        </div>
      </div>
      <div className="cd-notice cd-notice-accent">
        <span>
          Ausdrucken und getrennt vom Rechner aufbewahren. Wer den Key hat, kann die Datenbank ohne Passwort öffnen.
        </span>
      </div>
    </Dialog>
  );
};

export default RecoveryKeyModal;
