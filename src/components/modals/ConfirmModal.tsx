import React from 'react';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { ConfirmState } from '../../types/ui';
import ModalHeader from './ModalHeader';

type ConfirmModalProps = {
  state: ConfirmState;
  onClose: () => void;
};

const ConfirmModal = ({ state, onClose }: ConfirmModalProps) => {
  if (!state) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <ModalHeader icon={faTriangleExclamation} title="Bist du sicher?" onClose={onClose} danger />
        <p className="modal-text">{state.message}</p>
        <div className="modal-actions">
          <div className="modal-actions-left" />
          <div className="modal-actions-right">
            <button className="ghost-button" onClick={onClose}>
              Abbrechen
            </button>
            <button
              className={state.danger ? 'ghost-button danger' : 'primary'}
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
    </div>
  );
};

export default ConfirmModal;
