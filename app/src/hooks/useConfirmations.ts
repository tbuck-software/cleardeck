import { useState, useCallback } from 'react';
import type { ConfirmActionOptions, ConfirmState } from '../types/ui';

const useConfirmations = () => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const confirmAction = useCallback(
    (message: string, action: () => Promise<void> | void, opts?: ConfirmActionOptions) => {
      setConfirmState({ message, onConfirm: action, confirmLabel: opts?.confirmLabel, danger: opts?.danger });
    },
    [],
  );

  return { confirmState, setConfirmState, confirmAction };
};

export default useConfirmations;
