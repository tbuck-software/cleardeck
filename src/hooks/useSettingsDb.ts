import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { userFacingErrorMessage } from '../utils/errorMessage';
import type { AppInfo, AppState, StorageMode, UpdateStatus } from '../shared/types';
import type { ConfirmActionOptions, EncryptionSetupState } from '../types/ui';

type UseSettingsDbParams = {
  year: number;
  refreshDataset: (targetYear: number) => Promise<void>;
  onError: (err: unknown) => void;
  onToast: (msg: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    opts?: ConfirmActionOptions,
  ) => void;
  onAfterDrop: () => void;
  onAfterReset: (state: AppState) => void;
  onAuthStateChange: (state: AppState) => void;
  onOpenRecoveryKey: () => Promise<void>;
};

const useSettingsDb = ({
  year,
  refreshDataset,
  onError,
  onToast,
  confirmAction,
  onAfterDrop,
  onAfterReset,
  onAuthStateChange,
  onOpenRecoveryKey,
}: UseSettingsDbParams) => {
  const [baseHours, setBaseHours] = useState<number>(36);
  const [baseHoursInput, setBaseHoursInput] = useState<string>('36');
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [lastUpdateCheckAt, setLastUpdateCheckAt] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>('encrypted');
  const [encryptionSetup, setEncryptionSetup] = useState<EncryptionSetupState>({
    open: false,
    password: '',
    repeat: '',
    error: null,
    nextMode: 'encrypted',
  });

  const hydrateBaseHours = useCallback((hours?: number | null) => {
    setBaseHours(hours || 36);
    setBaseHoursInput(String(hours || 36));
  }, []);

  const handleSaveBaseHoursValue = useCallback(async () => {
    const val = Number(baseHoursInput);
    if (Number.isNaN(val) || val <= 0) {
      onError(new Error('Bitte eine gültige Zahl > 0 eingeben.'));
      return;
    }
    try {
      const saved = await api.settings.setBaseHours(val);
      hydrateBaseHours(saved);
      onToast(`Basis-Stunden gesetzt auf ${saved}.`);
      setTimeout(() => onToast(null), 2000);
    } catch (err) {
      onError(err);
    }
  }, [baseHoursInput, hydrateBaseHours, onError, onToast]);

  const handleDbExport = useCallback(
    async (mode: 'encrypted' | 'plain') => {
      setDbMessage(null);
      try {
        const result = await api.db.export(mode);
        if (result.saved) {
          setDbMessage(`Export gespeichert unter: ${result.filePath}`);
        } else if (result.error) {
          setDbMessage(`Export fehlgeschlagen: ${result.error}`);
        }
      } catch (err) {
        onError(err);
      }
    },
    [onError],
  );

  const handleDbImport = useCallback(
    (mode: 'encrypted' | 'plain', recoveryKey?: string) => {
      confirmAction(
        'Import ersetzt die aktuelle Datenbank. Es wird vorher ein Backup erstellt. Fortfahren?',
        async () => {
          try {
            const result = await api.db.import(mode, recoveryKey);
            if (result.imported) {
              window.location.reload();
              const info = result.backupPath
                ? `Import erfolgreich. Backup unter: ${result.backupPath}`
                : 'Import erfolgreich.';
              onToast(info, 2500);
            } else if (result.error) {
              onError(new Error(result.error));
            }
          } catch (err) {
            onError(err);
          }
        },
        { confirmLabel: 'Importieren', danger: true },
      );
    },
    [confirmAction, onError, onToast, refreshDataset, year],
  );

  const handleDropDatabase = useCallback(() => {
    confirmAction(
      'Alle lokalen Daten werden unwiderruflich entfernt. Das Passwort bleibt erhalten.',
      async () => {
        try {
          await api.db.delete();
          onAfterDrop();
          onToast('Datenbank gelöscht. Bitte neu importieren oder neu anlegen.');
        } catch (err) {
          onError(err);
        } finally {
          setTimeout(() => onToast(null), 3000);
        }
      },
      {
        title: 'Datenbank löschen?',
        confirmLabel: 'Endgültig löschen',
        danger: true,
        confirmPhrase: 'LÖSCHEN',
      },
    );
  }, [confirmAction, onAfterDrop, onError, onToast]);

  const handleFullReset = useCallback(() => {
    confirmAction(
      'App komplett zurücksetzen? Datenbank und Konfiguration werden entfernt. Die App startet wie neu.',
      async () => {
        try {
          const state = await api.db.reset();
          onAfterReset(state);
          onToast('App zurückgesetzt. Bitte neu einrichten.');
        } catch (err) {
          onError(err);
        } finally {
          setTimeout(() => onToast(null), 3000);
        }
      },
      {
        title: 'App zurücksetzen?',
        confirmLabel: 'Endgültig zurücksetzen',
        danger: true,
        confirmPhrase: 'ZURÜCKSETZEN',
      },
    );
  }, [confirmAction, onAfterReset, onError, onToast]);

  const openEnableEncryption = useCallback(() => {
    setEncryptionSetup({
      open: true,
      password: '',
      repeat: '',
      error: null,
      nextMode: 'encrypted',
    });
  }, []);

  const closeEnableEncryption = useCallback(() => {
    setEncryptionSetup((prev) => ({
      ...prev,
      open: false,
      password: '',
      repeat: '',
      error: null,
    }));
  }, []);

  const handleEnableEncryption = useCallback(async () => {
    if (!encryptionSetup.password.trim()) {
      setEncryptionSetup((prev) => ({ ...prev, error: 'Bitte ein Passwort eingeben.' }));
      return;
    }
    if (encryptionSetup.password !== encryptionSetup.repeat) {
      setEncryptionSetup((prev) => ({ ...prev, error: 'Passwörter stimmen nicht überein.' }));
      return;
    }
    try {
      const state = await api.auth.enableEncryption(encryptionSetup.password);
      setStorageMode(state.storageMode);
      onAuthStateChange(state);
      closeEnableEncryption();
      await onOpenRecoveryKey();
      onToast('Verschlüsselung aktiviert. Recovery Key sicher ablegen.', 2600);
    } catch (err) {
      onError(err);
    }
  }, [
    closeEnableEncryption,
    encryptionSetup.password,
    encryptionSetup.repeat,
    onAuthStateChange,
    onError,
    onOpenRecoveryKey,
    onToast,
  ]);

  const handleDisableEncryption = useCallback(() => {
    confirmAction(
      'Verschlüsselung deaktivieren? Die lokale Datenbank liegt danach unverschlüsselt auf diesem Gerät.',
      async () => {
        try {
          const state = await api.auth.disableEncryption();
          setStorageMode(state.storageMode);
          onAuthStateChange(state);
          onToast('Verschlüsselung deaktiviert.', 2400);
        } catch (err) {
          onError(err);
        }
      },
      { confirmLabel: 'Deaktivieren', danger: true },
    );
  }, [confirmAction, onAuthStateChange, onError, onToast]);

  const showUpdateError = useCallback((error: unknown, retry: 'check' | 'download' | 'install') => {
    setUpdateStatus((previous) => ({
      version: previous.version,
      releaseNotes: previous.releaseNotes,
      state: 'error',
      retry,
      message: userFacingErrorMessage(error),
    }));
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    try {
      await api.updates.check(true);
    } catch (error) {
      showUpdateError(error, 'check');
    }
  }, [showUpdateError]);

  const handleDownloadUpdate = useCallback(async () => {
    try {
      await api.updates.download();
    } catch (error) {
      showUpdateError(error, 'download');
    }
  }, [showUpdateError]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      await api.updates.install();
    } catch (error) {
      showUpdateError(error, 'install');
    }
  }, [showUpdateError]);

  useEffect(() => {
    const unsubscribe = api.updates.onStatus((status) => {
      setUpdateStatus(status);
      if (
        status.state === 'available' ||
        status.state === 'not-available' ||
        status.state === 'downloaded' ||
        status.state === 'error'
      ) {
        setLastUpdateCheckAt(new Date().toISOString());
      }
    });

    const runCheck = () => {
      api.updates.check().catch((error) => showUpdateError(error, 'check'));
    };

    runCheck();
    const interval = window.setInterval(
      () => {
        runCheck();
      },
      60 * 60 * 1000,
    );

    const handleFocus = () => runCheck();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (unsubscribe) unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [showUpdateError]);

  const hydrateFromApi = useCallback(async () => {
    try {
      const hours = await api.settings.getBaseHours();
      hydrateBaseHours(hours);
    } catch (err) {
      onError(err);
    }
  }, [hydrateBaseHours, onError]);

  useEffect(() => {
    api.app
      .getInfo()
      .then(setAppInfo)
      .catch(() => {
        // Ignore errors loading app info
      });
    api.auth
      .getState()
      .then((state) => {
        setStorageMode(state.storageMode);
      })
      .catch(() => {
        // Ignore errors loading storage mode
      });
  }, []);

  return {
    state: {
      baseHours,
      baseHoursInput,
      dbMessage,
      updateStatus,
      lastUpdateCheckAt,
      appInfo,
      storageMode,
      encryptionSetup,
    },
    setters: {
      setBaseHoursInput,
      setDbMessage,
      setBaseHours,
      setEncryptionSetup,
    },
    actions: {
      hydrateBaseHours,
      hydrateFromApi,
      handleSaveBaseHoursValue,
      handleDbExport,
      handleDbImport,
      handleDropDatabase,
      handleFullReset,
      handleCheckUpdates,
      handleDownloadUpdate,
      handleInstallUpdate,
      openEnableEncryption,
      closeEnableEncryption,
      handleEnableEncryption,
      handleDisableEncryption,
    },
  };
};

export default useSettingsDb;
