import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type { AppInfo, AppState, UpdateStatus } from '../shared/types';
import type { ConfirmActionOptions } from '../types/ui';

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
};

const useSettingsDb = ({
  year,
  refreshDataset,
  onError,
  onToast,
  confirmAction,
  onAfterDrop,
  onAfterReset,
}: UseSettingsDbParams) => {
  const [baseHours, setBaseHours] = useState<number>(36);
  const [baseHoursInput, setBaseHoursInput] = useState<string>('36');
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [lastUpdateCheckAt, setLastUpdateCheckAt] = useState<string | null>(null);
  const [snoozeUpdates, setSnoozeUpdates] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

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
    (mode: 'encrypted' | 'plain') => {
      confirmAction(
        'Import ersetzt die aktuelle Datenbank. Es wird vorher ein Backup erstellt. Fortfahren?',
        async () => {
          try {
            const result = await api.db.import(mode);
            if (result.imported) {
              await refreshDataset(year);
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
      'Datenbank endgültig löschen? Dies entfernt alle Einträge, behält aber das Passwort.',
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
      { confirmLabel: 'Löschen', danger: true },
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
      { confirmLabel: 'Zurücksetzen', danger: true },
    );
  }, [confirmAction, onAfterReset, onError, onToast]);

  const handleCheckUpdates = useCallback(async () => {
    try {
      await api.updates.check();
    } catch (err) {
      onError(err);
    }
  }, [onError]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      await api.updates.install();
    } catch (err) {
      onError(err);
    }
  }, [onError]);

  const handleSnoozeUpdate = useCallback(() => {
    setSnoozeUpdates(true);
    setUpdateStatus((prev) => (prev.state === 'downloaded' ? prev : { state: 'idle' }));
  }, []);

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
      if (snoozeUpdates) return;
      api.updates.check().catch(() => {
        setUpdateStatus((prev) => prev);
      });
    };

    runCheck();
    const interval = window.setInterval(() => {
      runCheck();
    }, 60 * 60 * 1000);

    const handleFocus = () => runCheck();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (unsubscribe) unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [snoozeUpdates]);

  const hydrateFromApi = useCallback(async () => {
    try {
      const hours = await api.settings.getBaseHours();
      hydrateBaseHours(hours);
    } catch (err) {
      onError(err);
    }
  }, [hydrateBaseHours, onError]);

  useEffect(() => {
    api.app.getInfo().then(setAppInfo).catch(() => {
      // Ignore errors loading app info
    });
  }, []);

  return {
    state: {
      baseHours,
      baseHoursInput,
      dbMessage,
      updateStatus,
      lastUpdateCheckAt,
      snoozeUpdates,
      appInfo,
    },
    setters: {
      setBaseHoursInput,
      setDbMessage,
      setBaseHours,
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
      handleInstallUpdate,
      handleSnoozeUpdate,
    },
  };
};

export default useSettingsDb;
