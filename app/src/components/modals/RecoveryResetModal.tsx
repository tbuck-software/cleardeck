import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey } from '@fortawesome/free-solid-svg-icons';

export type RecoveryResetState = {
  open: boolean;
  recoveryKey: string;
  newPassword: string;
  repeat: string;
  error?: string | null;
};

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
        <div className="modal-icon">
          <FontAwesomeIcon icon={faKey} />
        </div>
        <h3>Passwort mit Recovery Key setzen</h3>
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
          <button className="ghost-button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" onClick={onSubmit} disabled={loading}>
            Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoveryResetModal;
