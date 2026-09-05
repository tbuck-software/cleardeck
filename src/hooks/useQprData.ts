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

  const refreshRecentVisits = useCallback(async () => {
    try {
      setRecentVisits(await api.patients.listRecentVisits(4));
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const refreshDefinitionUsage = useCallback(async () => {
    try {
      setDefinitionUsage(await api.definitions.usage());
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const refreshAudits = useCallback(async () => {
    try {
      setAudits(await api.audits.list());
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

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
    () => ({ refreshRecentVisits, refreshAudits, refreshDefinitionUsage, saveCareSettings, setAudits }),
    [refreshRecentVisits, refreshAudits, refreshDefinitionUsage, saveCareSettings],
  );

  return { careSettings, recentVisits, audits, auditSections, definitionUsage, actions };
};

export default useQprData;
