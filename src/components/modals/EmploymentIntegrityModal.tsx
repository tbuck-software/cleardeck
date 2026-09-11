import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import { api } from '../../services/api';
import { formatDateDE } from '../../utils/dateFormat';
import { shiftDays } from '../../utils/calendarDate';
import type {
  ConsolidatePreview,
  EmployeeMergePreview,
  EmployeeWithPeriod,
  EmploymentIntegrityOverview,
  EmploymentRepairEmployee,
  EmploymentPeriod,
  PeriodDatePreview,
  ReconcilePeriodsPreview,
  RepairRecordSummary,
} from '../../shared/types';

type EmploymentIntegrityModalProps = {
  open: boolean;
  employees: EmployeeWithPeriod[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onError: (error: unknown) => void;
};

const formatDate = (value: string | null | undefined) => (value ? formatDateDE(value) : 'offen');

type EmployeeLabelInput = Pick<EmploymentRepairEmployee, 'name' | 'birthDate' | 'startDate' | 'endDate' | 'qualification'> & {
  periodCount?: number;
};

const EmploymentIntegrityModal = ({
  open,
  employees,
  onClose,
  onChanged,
  onError,
}: EmploymentIntegrityModalProps) => {
  const [overview, setOverview] = useState<EmploymentIntegrityOverview | null>(null);
  const [periods, setPeriods] = useState<Array<EmploymentPeriod & { employeeId: number; employeeName: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<(EmploymentPeriod & { employeeId: number; employeeName: string }) | null>(null);
  const [periodDraft, setPeriodDraft] = useState({ startDate: '', endDate: '' });
  const [periodPreview, setPeriodPreview] = useState<PeriodDatePreview | null>(null);
  const [targetId, setTargetId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [mergePreview, setMergePreview] = useState<EmployeeMergePreview | null>(null);
  const [firstPeriodId, setFirstPeriodId] = useState('');
  const [secondPeriodId, setSecondPeriodId] = useState('');
  const [consolidatePreview, setConsolidatePreview] = useState<ConsolidatePreview | null>(null);
  const [reconcileFirstId, setReconcileFirstId] = useState('');
  const [reconcileSecondId, setReconcileSecondId] = useState('');
  const [reconcileRetainedId, setReconcileRetainedId] = useState('');
  const [reconcileDraft, setReconcileDraft] = useState({ startDate: '', endDate: '' });
  const [reconcilePreview, setReconcilePreview] = useState<ReconcilePeriodsPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const nextOverview = await api.employment.integrityOverview();
      const loaded = await Promise.all(
        employees.filter((employee) => employee.id != null).map(async (employee) =>
          (await api.employees.listPeriods(employee.id!)).map((period) => ({
            ...period,
            employeeId: employee.id!,
            employeeName: employee.name,
          })),
        ),
      );
      setOverview(nextOverview);
      setPeriods(loaded.flat());
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setOverview(null);
    setSelectedPeriod(null);
    setPeriodPreview(null);
    setMergePreview(null);
    setConsolidatePreview(null);
    setReconcilePreview(null);
    void load();
  }, [open, employees]);

  const mergeReady = mergePreview != null && mergePreview.conflicts.length === 0;
  const consolidateReady = consolidatePreview != null && consolidatePreview.conflicts.length === 0;
  const reconcileReady = reconcilePreview != null && reconcilePreview.conflicts.length === 0;
  const periodOptions = useMemo(() => periods.filter((period) => period.id != null), [periods]);
  const selectedFirstPeriod = periodOptions.find((period) => String(period.id) === firstPeriodId);
  const selectedReconcileFirst = periodOptions.find((period) => String(period.id) === reconcileFirstId);
  const isAdjacent = (left: typeof periodOptions[number], right: typeof periodOptions[number]): boolean => {
    const first = left.startDate <= right.startDate ? left : right;
    const second = first === left ? right : left;
    return Boolean(first.endDate && first.startDate <= first.endDate && shiftDays(first.endDate, 1) === second.startDate);
  };
  const consolidationSecondOptions = selectedFirstPeriod
    ? periodOptions.filter((period) =>
        period.id !== selectedFirstPeriod.id &&
        period.employeeId === selectedFirstPeriod.employeeId &&
        period.qualification === selectedFirstPeriod.qualification &&
        isAdjacent(selectedFirstPeriod, period),
      )
    : periodOptions;
  const reconciliationSecondOptions = selectedReconcileFirst
    ? periodOptions.filter((period) =>
        period.id !== selectedReconcileFirst.id &&
        period.employeeId === selectedReconcileFirst.employeeId &&
        period.qualification === selectedReconcileFirst.qualification,
      )
    : periodOptions;
  const repairEmployees = overview?.repairEmployees ?? [];
  const employeeLabel = (employee: EmployeeLabelInput): string => [
    employee.name,
    employee.birthDate ? `geb. ${formatDate(employee.birthDate)}` : null,
    employee.qualification ?? 'keine Qualifikation',
    employee.periodCount === 0
      ? 'keine Beschäftigungsdaten'
      : `${formatDate(employee.startDate)} – ${formatDate(employee.endDate)}`,
  ].filter(Boolean).join(' · ');
  const employeeLabelById = (id: number, fallbackName: string): string => {
    const employee = repairEmployees.find((entry) => entry.id === id);
    return employee ? employeeLabel(employee) : fallbackName;
  };
  const linkedRecordSummary = (records: EmployeeMergePreview['linkedRecords']): string => {
    const labels: Array<[string, string]> = [
      ['employee_events', 'Ereignisse'],
      ['employment_periods', 'Beschäftigungsabschnitte'],
      ['employment_terms', 'Arbeitszeitstände'],
      ['employment_term_history', 'Arbeitszeit-Historie'],
      ['employee_competencies', 'Qualifikationen'],
      ['competency_history', 'Qualifikationshistorie'],
      ['employee_instructions', 'Einweisungen'],
    ];
    const counts = new Map<string, number>();
    records.forEach((record) => {
      const label = labels.find(([table]) => table === record.table)?.[1] ?? 'Weitere Nachweise';
      counts.set(label, (counts.get(label) ?? 0) + record.count);
    });
    return Array.from(counts, ([label, count]) => `${label}: ${count}`).join(' · ') || 'Keine verknüpften Nachweise';
  };
  const affectedRecordSummary = (records: RepairRecordSummary[]): string => {
    const counts = new Map<string, number>();
    records.forEach((record) => {
      const label = record.table === 'employment_terms'
        ? 'Arbeitszeitstände'
        : record.table === 'employment_term_history'
          ? 'Arbeitszeit-Historie'
          : 'Weitere Nachweise';
      counts.set(label, (counts.get(label) ?? 0) + record.count);
    });
    return Array.from(counts, ([label, count]) => `${label}: ${count}`).join(' · ') || 'Keine verknüpften Arbeitszeitstände';
  };

  const choosePeriod = (periodId: number) => {
    const period = periods.find((entry) => entry.id === periodId);
    if (!period) return;
    setSelectedPeriod(period);
    setPeriodDraft({ startDate: period.startDate, endDate: period.endDate ?? '' });
    setPeriodPreview(null);
  };

  const previewDates = async () => {
    if (!selectedPeriod?.id) return;
    setBusy(true);
    try {
      setPeriodPreview(
        await api.employment.previewPeriodDate({
          periodId: selectedPeriod.id,
          startDate: periodDraft.startDate,
          endDate: periodDraft.endDate || null,
        }),
      );
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const applyDates = async () => {
    if (!periodPreview) return;
    setBusy(true);
    try {
      await api.employment.applyPeriodDate({
        periodId: periodPreview.period.id,
        startDate: periodPreview.period.after.startDate,
        endDate: periodPreview.period.after.endDate,
        previewToken: periodPreview.token,
      });
      setPeriodPreview(null);
      await load();
      await onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const previewMerge = async () => {
    if (!targetId || !sourceId || targetId === sourceId) return;
    setBusy(true);
    try {
      setMergePreview(
        await api.employment.previewMerge({
          targetEmployeeId: Number(targetId),
          sourceEmployeeId: Number(sourceId),
        }),
      );
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const applyMerge = async () => {
    if (!mergePreview || !mergeReady) return;
    setBusy(true);
    try {
      const backup = await api.backup.get();
      if (backup.folder) {
        const result = await api.backup.run();
        if (!result.saved) throw new Error(result.error ?? 'Backup konnte vor der Zusammenführung nicht erstellt werden.');
      }
      await api.employment.applyMerge({
        targetEmployeeId: mergePreview.target.id,
        sourceEmployeeId: mergePreview.source.id,
        previewToken: mergePreview.token,
      });
      setMergePreview(null);
      await load();
      await onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const previewConsolidation = async () => {
    if (!firstPeriodId || !secondPeriodId || firstPeriodId === secondPeriodId) return;
    setBusy(true);
    try {
      setConsolidatePreview(
        await api.employment.previewConsolidate({
          periodIds: [Number(firstPeriodId), Number(secondPeriodId)],
        }),
      );
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const applyConsolidation = async () => {
    if (!consolidatePreview || !consolidateReady) return;
    setBusy(true);
    try {
      const backup = await api.backup.get();
      if (backup.folder) {
        const result = await api.backup.run();
        if (!result.saved) throw new Error(result.error ?? 'Backup konnte vor der Zusammenlegung nicht erstellt werden.');
      }
      await api.employment.applyConsolidate({
        periodIds: [Number(firstPeriodId), Number(secondPeriodId)],
        previewToken: consolidatePreview.token,
      });
      setConsolidatePreview(null);
      await load();
      await onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const previewReconciliation = async () => {
    if (!reconcileFirstId || !reconcileSecondId || !reconcileRetainedId || reconcileFirstId === reconcileSecondId) return;
    setBusy(true);
    try {
      setReconcilePreview(await api.employment.previewReconcile({
        periodIds: [Number(reconcileFirstId), Number(reconcileSecondId)],
        retainedPeriodId: Number(reconcileRetainedId),
        startDate: reconcileDraft.startDate,
        endDate: reconcileDraft.endDate || null,
      }));
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const applyReconciliation = async () => {
    if (!reconcilePreview || !reconcileReady) return;
    setBusy(true);
    try {
      const backup = await api.backup.get();
      if (backup.folder) {
        const result = await api.backup.run();
        if (!result.saved) throw new Error(result.error ?? 'Backup konnte vor der Abschnittsauflösung nicht erstellt werden.');
      }
      await api.employment.applyReconcile({
        periodIds: [Number(reconcileFirstId), Number(reconcileSecondId)],
        retainedPeriodId: reconcilePreview.retained.id,
        startDate: reconcilePreview.retained.after.startDate,
        endDate: reconcilePreview.retained.after.endDate,
        previewToken: reconcilePreview.token,
      });
      setReconcilePreview(null);
      await load();
      await onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      manageFocus
      width={720}
      title="Daten prüfen"
      subtitle="Auffälligkeiten prüfen und Änderungen erst nach einer Vorschau speichern. Fehlende Angaben werden nicht ergänzt."
      onClose={onClose}
    >
      <div style={{ display: 'grid', gap: 22, maxHeight: '65vh', overflowY: 'auto', padding: '0 2px' }}>
        <section>
          <div className="cd-section-head">
            <div>
              <h3 className="cd-h3">Überblick</h3>
              <p className="cd-muted-14" style={{ margin: '4px 0 0' }}>
                {overview
                  ? `${overview.issues.length} Auffälligkeit${overview.issues.length === 1 ? '' : 'en'} gefunden.`
                  : 'Prüfung läuft …'}
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={busy}>
              Neu prüfen
            </button>
          </div>
          <div className="cd-panel">
            {!overview?.issues.length && overview && <div className="cd-empty">Keine Auffälligkeit gefunden.</div>}
            {overview?.issues.map((issue, index) => (
              <div className="cd-item" key={`${issue.kind}-${issue.periodIds.join('-')}-${index}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{issue.title}</div>
                  <div className="cd-muted-13">{issue.detail}</div>
                </div>
                {(issue.kind === 'reversed-period' || issue.kind === 'overlapping-periods') && issue.periodIds[0] && (
                  <button type="button" className="btn btn-secondary" onClick={() => choosePeriod(issue.periodIds[0])}>
                    Daten korrigieren
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="cd-h3">Zeitraum korrigieren</h3>
          <p className="cd-muted-14">Beginn und Ende stammen aus dem Beleg. Arbeitszeiten und Qualifikationen bleiben unverändert.</p>
          {selectedPeriod ? (
            <div className="cd-panel" style={{ display: 'grid', gap: 10, padding: 14 }}>
              <strong>{selectedPeriod.employeeName}</strong>
              <div className="cd-muted-13">Bisher: {formatDate(selectedPeriod.startDate)} – {formatDate(selectedPeriod.endDate)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="field"><span>Beginn</span><input className="input" type="date" value={periodDraft.startDate} onChange={(event) => { setPeriodDraft((current) => ({ ...current, startDate: event.target.value })); setPeriodPreview(null); }} /></label>
                <label className="field"><span>Ende</span><input className="input" type="date" value={periodDraft.endDate} onChange={(event) => { setPeriodDraft((current) => ({ ...current, endDate: event.target.value })); setPeriodPreview(null); }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => void previewDates()} disabled={busy}>Vorschau</button>
                {periodPreview && periodPreview.conflicts.length === 0 && <button type="button" className="btn btn-primary" onClick={() => void applyDates()} disabled={busy}>Korrektur speichern</button>}
              </div>
              {periodPreview && (
                <div role="status" className={periodPreview.conflicts.length ? 'cd-callout cd-callout-error' : 'cd-callout'}>
                  <div><strong>Vorher:</strong> {formatDate(periodPreview.period.before.startDate)} – {formatDate(periodPreview.period.before.endDate)}</div>
                  <div><strong>Nachher:</strong> {formatDate(periodPreview.period.after.startDate)} – {formatDate(periodPreview.period.after.endDate)}</div>
                  <div>Betroffene Nachweise: {affectedRecordSummary(periodPreview.affectedRecords)}</div>
                  {periodPreview.conflicts.map((conflict) => <div key={conflict}>{conflict}</div>)}
                </div>
              )}
            </div>
          ) : <div className="cd-muted-14">Eine Auffälligkeit mit „Daten korrigieren“ auswählen.</div>}
        </section>

        <details className="cd-disclosure">
          <summary>Doppelte oder übernommene Abschnitte auflösen</summary>
          <div className="cd-disclosure-body">
          <p className="cd-muted-14">Einen Abschnitt behalten und die nachweislich richtigen Daten eingeben. Gleiche Arbeitszeitstände werden als Historie erhalten; widersprüchliche Stände blockieren die Aktion.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <select aria-label="Erster Abschnitt für Auflösung" className="input" value={reconcileFirstId} onChange={(event) => { setReconcileFirstId(event.target.value); setReconcileSecondId(''); setReconcileRetainedId(''); setReconcileDraft({ startDate: '', endDate: '' }); setReconcilePreview(null); }}>
              <option value="">Ersten Abschnitt auswählen</option>
              {periodOptions.map((period) => <option value={period.id} key={`reconcile-first-${period.id}`}>{period.employeeName} · {formatDate(period.startDate)} – {formatDate(period.endDate)}</option>)}
            </select>
            <select aria-label="Zweiter Abschnitt für Auflösung" className="input" value={reconcileSecondId} onChange={(event) => { setReconcileSecondId(event.target.value); setReconcileRetainedId(''); setReconcileDraft({ startDate: '', endDate: '' }); setReconcilePreview(null); }}>
              <option value="">Zweiten Abschnitt auswählen</option>
              {reconciliationSecondOptions.map((period) => <option value={period.id} key={`reconcile-second-${period.id}`}>{period.employeeName} · {formatDate(period.startDate)} – {formatDate(period.endDate)}</option>)}
            </select>
            <select aria-label="Beibehaltenen Abschnitt auswählen" className="input" value={reconcileRetainedId} onChange={(event) => { const value = event.target.value; setReconcileRetainedId(value); const period = periodOptions.find((entry) => String(entry.id) === value); setReconcileDraft({ startDate: period?.startDate ?? '', endDate: period?.endDate ?? '' }); setReconcilePreview(null); }}>
              <option value="">Beibehaltenen Abschnitt auswählen</option>
              {periodOptions.filter((period) => String(period.id) === reconcileFirstId || String(period.id) === reconcileSecondId).map((period) => <option value={period.id} key={`reconcile-retained-${period.id}`}>{period.employeeName} · {formatDate(period.startDate)} – {formatDate(period.endDate)}</option>)}
            </select>
            {reconcileRetainedId && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field"><span>Richtiger Beginn</span><input className="input" type="date" value={reconcileDraft.startDate} onChange={(event) => { setReconcileDraft((current) => ({ ...current, startDate: event.target.value })); setReconcilePreview(null); }} /></label>
              <label className="field"><span>Richtiges Ende</span><input className="input" type="date" value={reconcileDraft.endDate} onChange={(event) => { setReconcileDraft((current) => ({ ...current, endDate: event.target.value })); setReconcilePreview(null); }} /></label>
            </div>}
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={() => void previewReconciliation()} disabled={busy || !reconcileFirstId || !reconcileSecondId || !reconcileRetainedId}>Vorschau</button>{reconcileReady && <button type="button" className="btn btn-primary" onClick={() => void applyReconciliation()} disabled={busy}>Auflösung speichern</button>}</div>
            {reconcilePreview && <div role="status" className={reconcilePreview.conflicts.length ? 'cd-callout cd-callout-error' : 'cd-callout'}><div><strong>Beibehalten:</strong> {formatDate(reconcilePreview.retained.before.startDate)} – {formatDate(reconcilePreview.retained.before.endDate)} → {formatDate(reconcilePreview.retained.after.startDate)} – {formatDate(reconcilePreview.retained.after.endDate)}</div><div><strong>Zusammengeführt:</strong> {formatDate(reconcilePreview.removed.startDate)} – {formatDate(reconcilePreview.removed.endDate)}</div><div>Betroffene Nachweise: {affectedRecordSummary(reconcilePreview.affectedRecords)}</div>{reconcilePreview.conflicts.map((conflict) => <div key={conflict}>{conflict}</div>)}</div>}
          </div>
          </div>
        </details>

        <details className="cd-disclosure">
          <summary>Angrenzende Abschnitte zusammenlegen</summary>
          <div className="cd-disclosure-body">
          <p className="cd-muted-14">Wählen Sie zwei gleiche Qualifikationen derselben Person mit unmittelbar angrenzenden Zeiträumen. Kollisionen blockieren das Speichern.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <select aria-label="Erster Beschäftigungsabschnitt" className="input" value={firstPeriodId} onChange={(event) => { setFirstPeriodId(event.target.value); setSecondPeriodId(''); setConsolidatePreview(null); }}>
              <option value="">Ersten Abschnitt auswählen</option>
              {periodOptions.map((period) => <option value={period.id} key={`first-${period.id}`}>{period.employeeName} · {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.qualification}</option>)}
            </select>
            <select aria-label="Zweiter Beschäftigungsabschnitt" className="input" value={secondPeriodId} onChange={(event) => { setSecondPeriodId(event.target.value); setConsolidatePreview(null); }}>
              <option value="">Zweiten Abschnitt auswählen</option>
              {consolidationSecondOptions.map((period) => <option value={period.id} key={`second-${period.id}`}>{period.employeeName} · {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.qualification}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={() => void previewConsolidation()} disabled={busy}>Vorschau</button>{consolidateReady && <button type="button" className="btn btn-primary" onClick={() => void applyConsolidation()} disabled={busy}>Zusammenlegung speichern</button>}</div>
            {consolidatePreview && <div role="status" className={consolidatePreview.conflicts.length ? 'cd-callout cd-callout-error' : 'cd-callout'}><div><strong>Vorher:</strong> {consolidatePreview.before.map((period) => `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`).join(' · ')}</div><div><strong>Nachher:</strong> {formatDate(consolidatePreview.after.startDate)} – {formatDate(consolidatePreview.after.endDate)}</div><div>Betroffene Nachweise: {affectedRecordSummary(consolidatePreview.affectedRecords)}</div>{consolidatePreview.conflicts.map((conflict) => <div key={conflict}>{conflict}</div>)}</div>}
          </div>
          </div>
        </details>

        <details className="cd-disclosure">
          <summary>Doppelte Person zusammenführen</summary>
          <div className="cd-disclosure-body">
          <p className="cd-muted-14">Gleiche Namen sind nur ein Hinweis. Ziel und Quelle ausdrücklich auswählen; alle verknüpften Nachweise werden geprüft.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <select aria-label="Zielperson" className="input" value={targetId} onChange={(event) => { setTargetId(event.target.value); setMergePreview(null); }}><option value="">Zielperson auswählen</option>{repairEmployees.map((employee) => <option value={employee.id} key={`target-${employee.id}`}>{employeeLabel(employee)}</option>)}</select>
            <select aria-label="Quellperson" className="input" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setMergePreview(null); }}><option value="">Quellperson auswählen</option>{repairEmployees.map((employee) => <option value={employee.id} key={`source-${employee.id}`}>{employeeLabel(employee)}</option>)}</select>
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={() => void previewMerge()} disabled={busy || !targetId || !sourceId || targetId === sourceId}>Vorschau</button>{mergeReady && <button type="button" className="btn btn-primary" onClick={() => void applyMerge()} disabled={busy}>Zusammenführen</button>}</div>
            {mergePreview && <div role="status" className={mergePreview.conflicts.length ? 'cd-callout cd-callout-error' : 'cd-callout'}><div><strong>Vorschau:</strong> {employeeLabelById(mergePreview.target.id, mergePreview.target.name)} bleibt erhalten; Nachweise von {employeeLabelById(mergePreview.source.id, mergePreview.source.name)} werden verknüpft.</div><div>Geprüft: {linkedRecordSummary(mergePreview.linkedRecords)}. Diese Zusammenführung kann nicht automatisch rückgängig gemacht werden; vorher bei Bedarf ein Backup erstellen.</div>{mergePreview.conflicts.map((conflict) => <div key={conflict}>{conflict}</div>)}{mergeReady && <div>Bitte „Zusammenführen“ nur mit geprüfter Zielperson ausführen.</div>}</div>}
          </div>
          </div>
        </details>
      </div>
    </Dialog>
  );
};

export default EmploymentIntegrityModal;
