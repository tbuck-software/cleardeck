import { useState } from 'react';
import type { RecoveryInfo } from '../shared/types';

type RecoveryState = {
  open: boolean;
  recoveryKey: string;
  newPassword: string;
  repeat: string;
  error?: string | null;
};

const initialRecoveryState: RecoveryState = {
  open: false,
  recoveryKey: '',
  newPassword: '',
  repeat: '',
  error: null,
};

const useRecovery = ({
  onError,
  onToast,
  refreshDataset,
  year,
  setLoading,
}: {
  onError: (err: unknown) => void;
  onToast: (msg: string, timeout?: number) => void;
  refreshDataset: (targetYear: number) => Promise<void>;
  year: number;
  setLoading: (val: boolean) => void;
}) => {
  const [recoveryKeyModal, setRecoveryKeyModal] = useState<{ open: boolean; info: RecoveryInfo | null; source: 'setup' | 'settings' }>({
    open: false,
    info: null,
    source: 'settings',
  });
  const [recoveryReset, setRecoveryReset] = useState<RecoveryState>(initialRecoveryState);

  const openRecoveryKey = async (source: 'setup' | 'settings') => {
    try {
      const info = await window.api.getRecoveryKey();
      setRecoveryKeyModal({ open: true, info, source });
    } catch (err) {
      onError(err);
    }
  };

  const handleCopyRecoveryKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      onToast('Recovery Key kopiert.');
    } catch (err) {
      onError(err);
    }
  };

  const startRecoveryReset = () => {
    setRecoveryReset({ ...initialRecoveryState, open: true });
  };

  const handleRecoveryReset = async () => {
    if (!recoveryReset.recoveryKey.trim()) {
      setRecoveryReset((prev) => ({ ...prev, error: 'Bitte Recovery Key eingeben.' }));
      return;
    }
    if (!recoveryReset.newPassword.trim()) {
      setRecoveryReset((prev) => ({ ...prev, error: 'Bitte neues Passwort eingeben.' }));
      return;
    }
    if (recoveryReset.newPassword !== recoveryReset.repeat) {
      setRecoveryReset((prev) => ({ ...prev, error: 'Passwörter stimmen nicht überein.' }));
      return;
    }
    setRecoveryReset((prev) => ({ ...prev, error: null }));
    setLoading(true);
    try {
      const state = await window.api.recoverWithKey({
        recoveryKey: recoveryReset.recoveryKey,
        newPassword: recoveryReset.newPassword,
      });
      if (state.unlocked) {
        await refreshDataset(year);
      }
      setRecoveryReset(initialRecoveryState);
      onToast('Passwort zurückgesetzt. Recovery Key sicher aufbewahren.', 2200);
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return {
    recoveryKeyModal,
    recoveryReset,
    setRecoveryKeyModal,
    setRecoveryReset,
    openRecoveryKey,
    handleCopyRecoveryKey,
    startRecoveryReset,
    handleRecoveryReset,
  };
};

export default useRecovery;
