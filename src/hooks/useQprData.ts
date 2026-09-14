import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { DEFAULT_VISIT_INTERVAL_DAYS } from '../utils/qpr';
import type {
  AuditSectionDefinition,
  AuditWithDetails,
  CareSettings,
  DefinitionUsage,
  PatientVisit,
} from '../shared/types';

export type QprRefreshOptions = {
  /** Prevents a completed read from committing after an editor opens. */
  shouldApply?: () => boolean;
};

/**
 * The QPR-side data that hangs off patients: cadence settings, the visit trend
 * used by the list, and the recorded MD inspections.
 */
const useQprData = ({
  ready,
  handleError,
}: {
  ready: boolean;
  handleError: (err: unknown) => void;
}) => {
  const [careSettings, setCareSettings] = useState<CareSettings>({
    visitIntervalDays: DEFAULT_VISIT_INTERVAL_DAYS,
    instructionReminderDays: 30,
  });
  const [recentVisits, setRecentVisits] = useState<Record<number, PatientVisit[]>>({});
  const [audits, setAudits] = useState<AuditWithDetails[]>([]);
  const [auditSections, setAuditSections] = useState<AuditSectionDefinition[]>([]);
  const [definitionUsage, setDefinitionUsage] = useState<DefinitionUsage>({
    competencies: {},
    instructions: {},
  });

  const refreshRecentVisits = useCallback(async (options: QprRefreshOptions = {}) => {
    try {
      const next = await api.patients.listRecentVisits(4);
      if (options.shouldApply && !options.shouldApply()) return;
      setRecentVisits(next);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const refreshDefinitionUsage = useCallback(async (options: QprRefreshOptions = {}) => {
    try {
      const next = await api.definitions.usage();
      if (options.shouldApply && !options.shouldApply()) return;
      setDefinitionUsage(next);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const refreshAudits = useCallback(async (options: QprRefreshOptions = {}) => {
    try {
      const next = await api.audits.list();
      if (options.shouldApply && !options.shouldApply()) return;
      setAudits(next);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const refreshSettings = useCallback(async (options: QprRefreshOptions = {}) => {
    try {
      const [settings, sections] = await Promise.all([
        api.careSettings.get(),
        api.audits.sections(),
      ]);
      if (options.shouldApply && !options.shouldApply()) return;
      setCareSettings(settings);
      setAuditSections(sections);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const refreshAll = useCallback(async (options: QprRefreshOptions = {}) => {
    await Promise.all([
      refreshSettings(options),
      refreshRecentVisits(options),
      refreshAudits(options),
      refreshDefinitionUsage(options),
    ]);
  }, [refreshAudits, refreshDefinitionUsage, refreshRecentVisits, refreshSettings]);

  const saveCareSettings = useCallback(
    async (next: Partial<CareSettings>) => {
      try {
        setCareSettings(await api.careSettings.set(next));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const [settings, sections] = await Promise.all([
          api.careSettings.get(),
          api.audits.sections(),
        ]);
        setCareSettings(settings);
        setAuditSections(sections);
      } catch (err) {
        handleError(err);
      }
      await Promise.all([refreshRecentVisits(), refreshAudits(), refreshDefinitionUsage()]);
    })();
  }, [ready, handleError, refreshRecentVisits, refreshAudits, refreshDefinitionUsage]);

  const actions = useMemo(
    () => ({
      refreshRecentVisits,
      refreshAudits,
      refreshDefinitionUsage,
      refreshSettings,
      refreshAll,
      saveCareSettings,
      setAudits,
    }),
    [
      refreshRecentVisits,
      refreshAudits,
      refreshDefinitionUsage,
      refreshSettings,
      refreshAll,
      saveCareSettings,
    ],
  );

  return { careSettings, recentVisits, audits, auditSections, definitionUsage, actions };
};

export default useQprData;
