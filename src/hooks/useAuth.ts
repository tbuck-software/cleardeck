import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type { AppState, QualificationType, Department } from '../shared/types';
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
  setDepartments: (list: Department[]) => void;
  setDepartmentEdits: (edits: Record<number, string>) => void;
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
  setDepartments,
  setDepartmentEdits,
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

  const hydrateDepartments = useCallback(
    (depts: Department[]) => {
      setDepartments(depts);
      const edits: Record<number, string> = {};
      depts.forEach((d) => {
        if (d.id) edits[d.id] = d.name;
      });
      setDepartmentEdits(edits);
    },
    [setDepartmentEdits, setDepartments],
  );

  const bootstrap = useCallback(async () => {
    try {
      const state = await api.auth.getState();
      setAppReady(state);
      if (state.unlocked) {
        try {
          const hours = await api.settings.getBaseHours();
          hydrateBaseHours(hours);
        } catch (err) {
          handleError(err);
        }
        const qualis = await api.qualifications.list();
        hydrateQualifications(qualis);
        const depts = await api.departments.list();
        hydrateDepartments(depts);
        await refreshDataset(year);
      }
    } catch (err) {
      handleError(err);
    }
  }, [handleError, hydrateBaseHours, hydrateDepartments, hydrateQualifications, refreshDataset, year]);

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
    api.qualifications
      .list()
      .then((list) => {
        hydrateQualifications(list);
      })
      .catch(handleError);
    api.departments
      .list()
      .then((list) => {
        hydrateDepartments(list);
      })
      .catch(handleError);
  }, [appReady.unlocked, handleError, hydrateDepartments, hydrateQualifications]);

  const handleLogin = useCallback(
    async (password: string, mode: 'setup' | 'login') => {
      try {
        setLoading(true);
        const state =
          mode === 'setup' ? await api.auth.register(password) : await api.auth.login(password);
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
