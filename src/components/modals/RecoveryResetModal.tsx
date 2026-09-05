import React from 'react';
import Icon from '../ui/Icon';
import Dialog from '../ui/Dialog';
import type { RecoveryResetState } from '../../types/ui';

type RecoveryResetModalProps = {
  state: RecoveryResetState;
  loading: boolean;
  onChange: (next: Partial<RecoveryResetState>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const RecoveryResetModal = ({ state, loading, onChange, onClose, onSubmit }: RecoveryResetModalProps) => (
  <Dialog
    open={state.open}
    width={520}
    title="Passwort mit Recovery-Key setzen"
    subtitle="Setzt ein neues Passwort. Der Recovery-Key bleibt derselbe und sollte sicher aufbewahrt sein."
    primaryLabel="Zurücksetzen"
    primaryDisabled={loading || !state.recoveryKey.trim() || state.newPassword !== state.repeat}
    onPrimary={onSubmit}
    onClose={onClose}
  >
    <div className="field">
      <label htmlFor="recovery-key">Recovery-Key</label>
      <textarea
        id="recovery-key"
        className="input cd-mono"
        style={{ minHeight: 70 }}
        placeholder="Base64 oder Hex"
        value={state.recoveryKey}
        onChange={(event) => onChange({ recoveryKey: event.target.value })}
      />
    </div>
    <div className="cd-field-grid">
      <div className="field">
        <label htmlFor="recovery-new">Neues Passwort</label>
        <input
          id="recovery-new"
          className="input"
          type="password"
          value={state.newPassword}
          onChange={(event) => onChange({ newPassword: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="recovery-repeat">Wiederholen</label>
        <input
          id="recovery-repeat"
          className="input"
          type="password"
          value={state.repeat}
          onChange={(event) => onChange({ repeat: event.target.value })}
        />
      </div>
    </div>
    {state.error && (
      <div className="cd-notice cd-notice-bad" role="alert">
        <Icon name="warning" />
        <span>{state.error}</span>
      </div>
    )}
  </Dialog>
);

export default RecoveryResetModal;
