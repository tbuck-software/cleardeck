import { useState, useCallback } from 'react';
import type { ConfirmState } from '../components/modals/ConfirmModal';

const useConfirmations = () => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const confirmAction = useCallback(
    (message: string, action: () => Promise<void> | void, opts?: { confirmLabel?: string; danger?: boolean }) => {
      setConfirmState({ message, onConfirm: action, confirmLabel: opts?.confirmLabel, danger: opts?.danger });
    },
    [],
  );

  return { confirmState, setConfirmState, confirmAction };
};

export default useConfirmations;
