import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import type { ConfirmState } from '../../types/ui';

type ConfirmModalProps = {
  state: ConfirmState;
  onClose: () => void;
};

const ConfirmModal = ({ state, onClose }: ConfirmModalProps) => {
  const [typed, setTyped] = useState('');
  const phrase = state?.confirmPhrase;

  useEffect(() => {
    setTyped('');
  }, [state?.message]);

  if (!state) return null;

  const armed = !phrase || typed.trim().toUpperCase() === phrase.toUpperCase();

  return (
    <Dialog
      open
      width={460}
      title={state.title ?? 'Bist du sicher?'}
      subtitle={state.message}
      primaryLabel={state.confirmLabel ?? 'OK'}
      primaryDanger={state.danger}
      primaryDisabled={!armed}
      onPrimary={() => {
        state.onConfirm();
        onClose();
      }}
      onClose={onClose}
    >
      {phrase && (
        <div className="field">
          <label htmlFor="confirm-phrase">Zur Bestätigung „{phrase}“ eingeben</label>
          <input
            id="confirm-phrase"
            className="input"
            placeholder={phrase}
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      )}
    </Dialog>
  );
};

export default ConfirmModal;
