import React from 'react';
import { faKey } from '@fortawesome/free-solid-svg-icons';
import type { RecoveryResetState } from '../../types/ui';
import ModalHeader from './ModalHeader';

type RecoveryResetModalProps = {
  state: RecoveryResetState;
  loading: boolean;
  onChange: (next: Partial<RecoveryResetState>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const RecoveryResetModal = ({ state, loading, onChange, onClose, onSubmit }: RecoveryResetModalProps) => {
  if (!state.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <ModalHeader icon={faKey} title="Passwort mit Recovery Key setzen" onClose={onClose} />
        <div className="modal-body">
          <p className="modal-text">
            Setzt ein neues Passwort. Der Recovery Key bleibt derselbe und sollte sicher aufbewahrt sein.
          </p>
          <label className="full-width">
            Recovery Key
            <textarea
              value={state.recoveryKey}
              onChange={(e) => onChange({ recoveryKey: e.target.value })}
              rows={3}
              placeholder="Base64 oder Hex"
              className="long-text"
            />
          </label>
          <label className="full-width">
            Neues Passwort
            <input
              type="password"
              value={state.newPassword}
              onChange={(e) => onChange({ newPassword: e.target.value })}
              placeholder="Neues Passwort"
            />
          </label>
          <label className="full-width">
            Wiederholen
            <input
              type="password"
              value={state.repeat}
              onChange={(e) => onChange({ repeat: e.target.value })}
              placeholder="Wiederholen"
            />
          </label>
          {state.error && <div className="error">{state.error}</div>}
        </div>
        <div className="modal-actions">
          <div className="modal-actions-left" />
          <div className="modal-actions-right">
            <button className="ghost-button" onClick={onClose}>
              Abbrechen
            </button>
            <button className="primary" onClick={onSubmit} disabled={loading}>
              Zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryResetModal;
