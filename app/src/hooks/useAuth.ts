import { useCallback, useEffect, useState } from 'react';
import type { AppState, QualificationType } from '../shared/types';
import type { FormState } from '../types/ui';

type UseAuthParams = {
  year: number;
  handleError: (err: unknown) => void;
  setLoading: (val: boolean) => void;
  refreshDataset: (targetYear: number) => Promise<void>;
  openRecoveryKey: (source: 'setup' | 'settings') => Promise<void>;
  setForm: (updater: FormState | ((prev: FormState) => FormState)) => void;
  setQualifications: (list: QualificationType[]) => void;
  setQualificationEdits: (edits: Record<number, string>) => void;
  hydrateBaseHours: (hours?: number | null) => void;
};

const useAuth = ({
  year,
  handleError,
  setLoading,
  refreshDataset,
  openRecoveryKey,
  setForm,
  setQualifications,
  setQualificationEdits,
  hydrateBaseHours,
}: UseAuthParams) => {
  const [appReady, setAppReady] = useState<AppState>({
    configured: false,
    unlocked: false,
  });

  const hydrateQualifications = useCallback(
    (qualis: QualificationType[]) => {
      setQualifications(qualis);
      const edits: Record<number, string> = {};
      qualis.forEach((q) => {
        if (q.id) edits[q.id] = q.name;
      });
      setQualificationEdits(edits);
      setForm((prev) => ({ ...prev, qualification: qualis[0]?.name ?? prev.qualification }));
    },
    [setForm, setQualificationEdits, setQualifications],
  );

  const bootstrap = useCallback(async () => {
    try {
      const state = await window.api.getAppState();
      setAppReady(state);
      if (state.unlocked) {
        try {
          const hours = await window.api.getBaseHours();
          hydrateBaseHours(hours);
        } catch (err) {
          handleError(err);
        }
        const qualis = await window.api.listQualifications();
        hydrateQualifications(qualis);
        await refreshDataset(year);
      }
    } catch (err) {
      handleError(err);
    }
  }, [handleError, hydrateBaseHours, hydrateQualifications, refreshDataset, year]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (appReady.unlocked) {
      refreshDataset(year);
    }
  }, [appReady.unlocked, refreshDataset, year]);

  useEffect(() => {
    if (!appReady.unlocked) return;
    window.api
      .listQualifications()
      .then((list) => {
        hydrateQualifications(list);
      })
      .catch(handleError);
  }, [appReady.unlocked, handleError, hydrateQualifications]);

  const handleLogin = useCallback(
    async (password: string, mode: 'setup' | 'login') => {
      try {
        setLoading(true);
        const state = mode === 'setup' ? await window.api.register(password) : await window.api.login(password);
        setAppReady(state);
        if (state.unlocked) {
          await refreshDataset(year);
          if (mode === 'setup') {
            await openRecoveryKey('setup');
          }
        }
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError, openRecoveryKey, refreshDataset, setLoading, year],
  );

  return { appReady, handleLogin, hydrateQualifications, setAppReady };
};

export default useAuth;
