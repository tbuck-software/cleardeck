import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faCopy } from '@fortawesome/free-solid-svg-icons';
import type { RecoveryInfo } from '../../shared/types';

type RecoveryKeyModalProps = {
  open: boolean;
  info: RecoveryInfo | null;
  source: 'setup' | 'settings';
  onClose: () => void;
  onCopy: (key: string) => void;
};

const RecoveryKeyModal = ({ open, info, source, onClose, onCopy }: RecoveryKeyModalProps) => {
  if (!open || !info) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon">
          <FontAwesomeIcon icon={faKey} />
        </div>
        <h3>Recovery Key sichern</h3>
        <div className="modal-body">
          <p className="modal-text">
            {source === 'setup'
              ? 'Bitte direkt nach der Einrichtung offline speichern. Wer den Key hat, kann die Datenbank entschlüsseln.'
              : 'Aktueller Schlüssel der Datenbank. Nur lokal speichern und nicht weitergeben.'}
          </p>
          <div className="mono-block">{info.recoveryKey}</div>
          <p className="subtitle small long-text">Fingerprint: {info.fingerprint}</p>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>
            Schließen
          </button>
          <button className="primary" onClick={() => onCopy(info.recoveryKey)}>
            <FontAwesomeIcon icon={faCopy} /> Kopieren
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoveryKeyModal;
