import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type {
  AppState,
  CompetencyDefinition,
  InstructionDefinition,
  QualificationType,
  StorageMode,
} from '../shared/types';
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
  setCompetencyDefinitions: (list: CompetencyDefinition[]) => void;
  setCompetencyEdits: (edits: Record<number, string>) => void;
  setInstructionDefinitions: (list: InstructionDefinition[]) => void;
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
  setCompetencyDefinitions,
  setCompetencyEdits,
  setInstructionDefinitions,
  hydrateBaseHours,
}: UseAuthParams) => {
  const [authLoading, setAuthLoading] = useState(true);
  const [appReady, setAppReady] = useState<AppState>({
    configured: false,
    unlocked: false,
    storageMode: 'encrypted',
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
    let state: AppState;
    try {
      state = await api.auth.getState();
    } catch (err) {
      setAppReady({
        configured: false,
        unlocked: false,
        storageMode: 'encrypted',
        startupError: err instanceof Error ? err.message : 'Der lokale Datenstatus kann nicht gelesen werden.',
      });
      setAuthLoading(false);
      return;
    }
    setAppReady(state);
    setAuthLoading(false);
    try {
      if (state.unlocked) {
        try {
          const hours = await api.settings.getBaseHours();
          hydrateBaseHours(hours);
        } catch (err) {
          handleError(err);
        }
        const qualis = await api.qualifications.list();
        hydrateQualifications(qualis);
        const competencies = await api.competencies.listDefinitions();
        setCompetencyDefinitions(competencies);
        const competencyMap: Record<number, string> = {};
        competencies.forEach((item) => {
          if (item.id) competencyMap[item.id] = item.name;
        });
        setCompetencyEdits(competencyMap);
        const instructions = await api.instructions.listDefinitions();
        setInstructionDefinitions(instructions);
        await refreshDataset(year);
      }
    } catch (err) {
      handleError(err);
    }
  }, [
    handleError,
    hydrateBaseHours,
    hydrateQualifications,
    refreshDataset,
    setCompetencyDefinitions,
    setCompetencyEdits,
    setInstructionDefinitions,
    year,
  ]);

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
  }, [appReady.unlocked, handleError, hydrateQualifications]);

  useEffect(() => {
    if (!appReady.unlocked) return;
    api.competencies
      .listDefinitions()
      .then((list) => {
        setCompetencyDefinitions(list);
        const edits: Record<number, string> = {};
        list.forEach((item) => {
          if (item.id) edits[item.id] = item.name;
        });
        setCompetencyEdits(edits);
      })
      .catch(handleError);
  }, [appReady.unlocked, handleError, setCompetencyDefinitions, setCompetencyEdits]);

  useEffect(() => {
    if (!appReady.unlocked) return;
    api.instructions
      .listDefinitions()
      .then((list) => {
        setInstructionDefinitions(list);
      })
      .catch(handleError);
  }, [appReady.unlocked, handleError, setInstructionDefinitions]);

  const handleLogin = useCallback(
    async (payload: { password: string; storageMode: StorageMode }, mode: 'setup' | 'login') => {
      try {
        setLoading(true);
        const state =
          mode === 'setup'
            ? payload.storageMode === 'plain'
              ? await api.auth.registerPlain()
              : await api.auth.register(payload.password)
            : await api.auth.login(payload.password);
        setAppReady(state);
        if (state.unlocked) {
          await refreshDataset(year);
          if (mode === 'setup' && state.storageMode === 'encrypted') {
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

  const handleLock = useCallback(async () => {
    try {
      setAppReady(await api.auth.lock());
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  return { appReady, authLoading, handleLogin, handleLock, hydrateQualifications, setAppReady };
};

export default useAuth;
