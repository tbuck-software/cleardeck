import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faCopy } from '@fortawesome/free-solid-svg-icons';
import type { RecoveryKeyModalState } from '../../types/ui';
import ModalHeader from './ModalHeader';

type RecoveryKeyModalProps = {
  state: RecoveryKeyModalState;
  onClose: () => void;
  onCopy: (key: string) => void;
};

const RecoveryKeyModal = ({ state, onClose, onCopy }: RecoveryKeyModalProps) => {
  if (!state.open || !state.info) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <ModalHeader icon={faKey} title="Recovery Key sichern" onClose={onClose} />
        <div className="modal-body">
          <p className="modal-text">
            {state.source === 'setup'
              ? 'Bitte direkt nach der Einrichtung offline speichern. Wer den Key hat, kann die Datenbank entschlüsseln.'
              : 'Aktueller Schlüssel der Datenbank. Nur lokal speichern und nicht weitergeben.'}
          </p>
          <div className="mono-block">{state.info.recoveryKey}</div>
          <p className="subtitle small long-text">Fingerprint: {state.info.fingerprint}</p>
        </div>
        <div className="modal-actions">
          <div className="modal-actions-left" />
          <div className="modal-actions-right">
            <button className="ghost-button" onClick={onClose}>
              Schließen
            </button>
            <button className="primary" onClick={() => onCopy(state.info.recoveryKey)}>
              <FontAwesomeIcon icon={faCopy} /> Kopieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryKeyModal;
