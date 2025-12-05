import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { ConfirmState } from '../../types/ui';

type ConfirmModalProps = {
  state: ConfirmState;
  onClose: () => void;
};

const ConfirmModal = ({ state, onClose }: ConfirmModalProps) => {
  if (!state) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon danger">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>
        <h3>Bist du sicher?</h3>
        <p className="modal-text">{state.message}</p>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className={`ghost-button ${state.danger ? 'danger' : ''}`}
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
          >
            {state.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
