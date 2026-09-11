import React, { useState } from 'react';
import { api } from '../../services/api';
import { formatDateDE } from '../../utils/dateFormat';
import { orderPeriods, periodsAdjacent } from '../../utils/employment';
import { userFacingErrorMessage } from '../../utils/errorMessage';
import type {
  ConsolidatePreview,
  EmployeeMergePreview,
  EmploymentIntegrityOverview,
  EmploymentPeriod,
  IntegrityPeriod,
  ReconcilePeriodsPreview,
  RepairRecordSummary,
} from '../../shared/types';

const STALE_PREVIEW = 'Die Vorschau ist veraltet. Bitte die Vorschau erneut erstellen.';

const recordLabels: Record<string, string> = {
  employee_events: 'Ereignisse',
  employment_periods: 'Beschäftigungsabschnitte',
  employment_terms: 'Arbeitszeitstände',
  employment_term_history: 'Arbeitszeit-Historie',
  employee_competencies: 'Qualifikationen',
  competency_history: 'Qualifikationshistorie',
  employee_instructions: 'Einweisungen',
};

const formatDate = (value: string | null | undefined): string =>
  value ? formatDateDE(value) : 'offen';

const periodLabel = (period: IntegrityPeriod): string =>
  [
    `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`,
    period.qualification ?? 'ohne Qualifikation',
    period.weeklyHours != null ? `${period.weeklyHours} Std./Woche` : null,
  ]
    .filter(Boolean)
    .join(' · ');

const recordCounts = (records: RepairRecordSummary[]): string[] =>
  records.map((record) => `${recordLabels[record.table] ?? record.table}: ${record.count}`);

const toEditablePeriod = (period: IntegrityPeriod): EmploymentPeriod => ({
  id: period.id,
  employeeId: period.employeeId,
  startDate: period.startDate,
  endDate: period.endDate,
  qualification: period.qualification ?? '',
  note: period.note,
});

const runBackupIfConfigured = async (folder: string | null): Promise<void> => {
  if (!folder) return;
  const result = await api.backup.run();
  if (!result.saved)
    throw new Error(result.error ?? 'Backup konnte vor der Änderung nicht erstellt werden.');
};

type CardShellProps = {
  title: string;
  explanation: string;
  children: React.ReactNode;
};

const Card = ({ title, explanation, children }: CardShellProps) => (
  <section className="cd-repair-card">
    <h4>{title}</h4>
    <p className="cd-muted-14 cd-repair-explanation">{explanation}</p>
    {children}
  </section>
);

const Messages = ({ tone, items }: { tone: 'bad' | 'accent'; items: string[] }) =>
  items.length === 0 ? null : (
    <div role="status" className={`cd-notice cd-notice-${tone}`}>
      <ul className="cd-repair-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );

const BackupNote = ({
  folder,
  onOpenBackupSettings,
}: {
  folder: string | null;
  onOpenBackupSettings: () => void;
}) =>
  folder ? (
    <p className="cd-muted-13">Vor dem Speichern wird ein Backup erstellt.</p>
  ) : (
    <p className="cd-muted-13">
      Kein Backup-Ordner eingerichtet. Diese Änderung lässt sich dann nicht aus einem Backup
      zurücknehmen.{' '}
      <button type="button" className="cd-link" onClick={onOpenBackupSettings}>
        Backup-Ordner einrichten
      </button>
    </p>
  );

type SharedProps = {
  backupFolder: string | null;
  onOpenBackupSettings: () => void;
  onApplied: (message: string) => void | Promise<void>;
};

/** Two sections cover the same days; one of them is the duplicate to resolve. */
const ReconcileCard = ({
  periods,
  backupFolder,
  onOpenBackupSettings,
  onApplied,
}: SharedProps & { periods: [IntegrityPeriod, IntegrityPeriod] }) => {
  const [retainedId, setRetainedId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ startDate: '', endDate: '' });
  const [preview, setPreview] = useState<ReconcilePeriodsPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const chooseRetained = (period: IntegrityPeriod) => {
    setRetainedId(period.id);
    setDraft({ startDate: period.startDate, endDate: period.endDate ?? '' });
    setPreview(null);
    setErrors([]);
  };

  const validate = (): string[] => {
    const problems: string[] = [];
    if (!draft.startDate) problems.push('Bitte einen Beginn eintragen.');
    if (draft.endDate && draft.startDate && draft.endDate < draft.startDate)
      problems.push('Das Ende liegt vor dem Beginn.');
    return problems;
  };

  const runPreview = async () => {
    const problems = validate();
    if (problems.length) {
      setErrors(problems);
      setPreview(null);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      setPreview(
        await api.employment.previewReconcile({
          periodIds: [periods[0].id, periods[1].id],
          retainedPeriodId: retainedId!,
          startDate: draft.startDate,
          endDate: draft.endDate || null,
        }),
      );
    } catch (error) {
      setErrors([userFacingErrorMessage(error)]);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview || preview.conflicts.length) return;
    setBusy(true);
    setErrors([]);
    try {
      await runBackupIfConfigured(backupFolder);
      await api.employment.applyReconcile({
        periodIds: [preview.retained.id, preview.removed.id],
        retainedPeriodId: preview.retained.id,
        startDate: preview.retained.after.startDate,
        endDate: preview.retained.after.endDate,
        previewToken: preview.token,
      });
      setRetainedId(null);
      setDraft({ startDate: '', endDate: '' });
      setPreview(null);
      await onApplied('Doppelter Abschnitt aufgelöst.');
    } catch (error) {
      const text = userFacingErrorMessage(error);
      if (text.includes('veraltet')) {
        setPreview(null);
        setErrors([STALE_PREVIEW]);
      } else {
        setErrors([text]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Doppelte Abschnitte auflösen"
      explanation="Bitte den Abschnitt auswählen, der erhalten bleibt, und die belegten Daten eintragen. Gleiche Arbeitszeitstände werden als Historie übernommen; widersprüchliche Stände blockieren das Speichern."
    >
      {periods.map((period, index) => (
        <label className="cd-repair-row" key={period.id}>
          <input
            type="radio"
            name={`reconcile-${periods[0].id}-${periods[1].id}`}
            checked={retainedId === period.id}
            disabled={busy}
            onChange={() => chooseRetained(period)}
          />
          <span>
            <strong>Abschnitt {index + 1}</strong>
            <span className="cd-muted-13"> · {periodLabel(period)}</span>
          </span>
          <span className="cd-muted-13">Behalten</span>
        </label>
      ))}
      {retainedId != null && (
        <div className="cd-repair-dates">
          <label className="field">
            <span>Belegter Beginn</span>
            <input
              className="input"
              type="date"
              value={draft.startDate}
              disabled={busy}
              onChange={(event) => {
                setDraft((current) => ({ ...current, startDate: event.target.value }));
                setPreview(null);
              }}
            />
          </label>
          <label className="field">
            <span>Belegtes Ende</span>
            <input
              className="input"
              type="date"
              value={draft.endDate}
              disabled={busy}
              onChange={(event) => {
                setDraft((current) => ({ ...current, endDate: event.target.value }));
                setPreview(null);
              }}
            />
          </label>
        </div>
      )}
      <Messages tone="bad" items={errors} />
      {preview && (
        <Messages
          tone={preview.conflicts.length ? 'bad' : 'accent'}
          items={
            preview.conflicts.length
              ? preview.conflicts
              : [
                  `Bleibt erhalten: ${formatDate(preview.retained.before.startDate)} – ${formatDate(preview.retained.before.endDate)} wird zu ${formatDate(preview.retained.after.startDate)} – ${formatDate(preview.retained.after.endDate)}`,
                  `Wird aufgelöst: ${formatDate(preview.removed.startDate)} – ${formatDate(preview.removed.endDate)}`,
                  ...recordCounts(preview.affectedRecords),
                ]
          }
        />
      )}
      <BackupNote folder={backupFolder} onOpenBackupSettings={onOpenBackupSettings} />
      <div className="cd-repair-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || retainedId == null}
          onClick={() => void runPreview()}
        >
          Vorschau
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || preview == null || preview.conflicts.length > 0}
          onClick={() => void apply()}
        >
          Auflösung speichern
        </button>
      </div>
    </Card>
  );
};

/** Two sections follow each other without a gap and carry the same qualification. */
const ConsolidateCard = ({
  periods,
  backupFolder,
  onOpenBackupSettings,
  onApplied,
}: SharedProps & { periods: [IntegrityPeriod, IntegrityPeriod] }) => {
  const [preview, setPreview] = useState<ConsolidatePreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const runPreview = async () => {
    setBusy(true);
    setErrors([]);
    try {
      setPreview(
        await api.employment.previewConsolidate({ periodIds: [periods[0].id, periods[1].id] }),
      );
    } catch (error) {
      setErrors([userFacingErrorMessage(error)]);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview || preview.conflicts.length) return;
    setBusy(true);
    setErrors([]);
    try {
      await runBackupIfConfigured(backupFolder);
      await api.employment.applyConsolidate({
        periodIds: [preview.before[0].id, preview.before[1].id],
        previewToken: preview.token,
      });
      setPreview(null);
      await onApplied('Abschnitte zusammengelegt.');
    } catch (error) {
      const text = userFacingErrorMessage(error);
      if (text.includes('veraltet')) {
        setPreview(null);
        setErrors([STALE_PREVIEW]);
      } else {
        setErrors([text]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Angrenzende Abschnitte zusammenlegen"
      explanation="Beide Abschnitte haben dieselbe Qualifikation und grenzen unmittelbar aneinander. Arbeitszeitstände und Nachweise bleiben erhalten."
    >
      {periods.map((period, index) => (
        <div className="cd-repair-row" key={period.id}>
          <span>
            <strong>Abschnitt {index + 1}</strong>
            <span className="cd-muted-13"> · {periodLabel(period)}</span>
          </span>
        </div>
      ))}
      <Messages tone="bad" items={errors} />
      {preview && (
        <Messages
          tone={preview.conflicts.length ? 'bad' : 'accent'}
          items={
            preview.conflicts.length
              ? preview.conflicts
              : [
                  `Ergibt einen Abschnitt: ${formatDate(preview.after.startDate)} – ${formatDate(preview.after.endDate)}`,
                  ...recordCounts(preview.affectedRecords),
                ]
          }
        />
      )}
      <BackupNote folder={backupFolder} onOpenBackupSettings={onOpenBackupSettings} />
      <div className="cd-repair-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void runPreview()}
        >
          Vorschau
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || preview == null || preview.conflicts.length > 0}
          onClick={() => void apply()}
        >
          Zusammenlegen
        </button>
      </div>
    </Card>
  );
};

/** The person whose page this is stays; the other one is merged into them. */
const MergeCard = ({
  targetId,
  sourceId,
  sourceName,
  backupFolder,
  onOpenBackupSettings,
  onApplied,
}: SharedProps & { targetId: number; sourceId: number; sourceName: string }) => {
  const [preview, setPreview] = useState<EmployeeMergePreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const runPreview = async () => {
    setBusy(true);
    setErrors([]);
    try {
      setPreview(
        await api.employment.previewMerge({
          targetEmployeeId: targetId,
          sourceEmployeeId: sourceId,
        }),
      );
    } catch (error) {
      setErrors([userFacingErrorMessage(error)]);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview || preview.conflicts.length) return;
    setBusy(true);
    setErrors([]);
    try {
      await runBackupIfConfigured(backupFolder);
      await api.employment.applyMerge({
        targetEmployeeId: preview.target.id,
        sourceEmployeeId: preview.source.id,
        previewToken: preview.token,
      });
      setPreview(null);
      await onApplied('Personen zusammengeführt.');
    } catch (error) {
      const text = userFacingErrorMessage(error);
      if (text.includes('veraltet')) {
        setPreview(null);
        setErrors([STALE_PREVIEW]);
      } else {
        setErrors([text]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={`Mit ${sourceName} zusammenführen`}
      explanation="Gleicher Name ist kein Nachweis derselben Person. Diese Person bleibt erhalten, alle Nachweise der anderen werden übernommen. Die Zusammenführung lässt sich nicht rückgängig machen."
    >
      <Messages tone="bad" items={errors} />
      {preview && (
        <Messages
          tone={preview.conflicts.length ? 'bad' : 'accent'}
          items={
            preview.conflicts.length
              ? preview.conflicts
              : [
                  `${preview.target.name} bleibt erhalten.`,
                  ...(recordCounts(preview.linkedRecords).length
                    ? recordCounts(preview.linkedRecords).map((entry) => `Wird übernommen – ${entry}`)
                    : ['Keine verknüpften Nachweise vorhanden.']),
                ]
          }
        />
      )}
      <BackupNote folder={backupFolder} onOpenBackupSettings={onOpenBackupSettings} />
      <div className="cd-repair-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void runPreview()}
        >
          Vorschau
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || preview == null || preview.conflicts.length > 0}
          onClick={() => void apply()}
        >
          Zusammenführen
        </button>
      </div>
    </Card>
  );
};

type EmploymentRepairPanelProps = SharedProps & {
  employeeId: number;
  overview: EmploymentIntegrityOverview;
  onOpenPeriod: (period: EmploymentPeriod) => void;
};

const EmploymentRepairPanel = ({
  employeeId,
  overview,
  backupFolder,
  onOpenBackupSettings,
  onOpenPeriod,
  onApplied,
}: EmploymentRepairPanelProps) => {
  const issues = overview.issues.filter((issue) => issue.employeeId === employeeId);
  if (issues.length === 0) return null;

  const periods = overview.periods.filter((period) => period.employeeId === employeeId);
  const periodById = (id: number) => periods.find((period) => period.id === id);
  const pair = (ids: number[]): [IntegrityPeriod, IntegrityPeriod] | null => {
    const [left, right] = ids.map(periodById);
    return left && right ? [left, right] : null;
  };
  const shared = { backupFolder, onOpenBackupSettings, onApplied };

  const brokenDates = issues.filter(
    (issue) => issue.kind === 'reversed-period' || issue.kind === 'overlapping-periods',
  );
  const editablePeriodIds = [...new Set(brokenDates.flatMap((issue) => issue.periodIds))];
  const duplicates = issues
    .filter((issue) => issue.kind === 'overlapping-periods')
    .map((issue) => pair(issue.periodIds))
    .filter((entry): entry is [IntegrityPeriod, IntegrityPeriod] => entry != null)
    .filter(([left, right]) => left.qualification === right.qualification);
  const migrated = issues.filter((issue) => issue.kind === 'suspicious-period');
  const sameName = issues.filter((issue) => issue.kind === 'same-name');

  // Adjacent same-qualification sections are legal, so they are no finding of
  // their own; the offer only appears while the panel is open anyway.
  const adjacent: [IntegrityPeriod, IntegrityPeriod][] = [];
  for (let index = 0; index < periods.length; index += 1)
    for (let other = index + 1; other < periods.length; other += 1)
      if (
        periods[index].qualification === periods[other].qualification &&
        periodsAdjacent(periods[index], periods[other])
      )
        adjacent.push(orderPeriods(periods[index], periods[other]));

  const worst = issues.some((issue) => issue.severity === 'error') ? 'bad' : 'accent';

  return (
    <div className="cd-repair">
      <div role="status" className={`cd-notice cd-notice-${worst}`}>
        <div className="cd-repair-message">
          <strong>Beschäftigungsdaten prüfen</strong>
          <span>
            {issues.length === 1
              ? 'Ein Hinweis zu dieser Person ist offen.'
              : `${issues.length} Hinweise zu dieser Person sind offen.`}{' '}
            Nichts wird automatisch geändert.
          </span>
        </div>
      </div>

      {editablePeriodIds.length > 0 && (
        <Card
          title="Zeiträume prüfen"
          explanation={
            brokenDates.some((issue) => issue.kind === 'reversed-period')
              ? 'Beginn liegt nach dem Ende, beziehungsweise zwei Abschnitte decken dieselben Tage ab. Bitte die Daten im Zeitraum-Editor anhand des Belegs korrigieren.'
              : 'Zwei Abschnitte decken dieselben Tage ab. Bitte die Daten im Zeitraum-Editor anhand des Belegs korrigieren.'
          }
        >
          {editablePeriodIds.map((periodId) => {
            const period = periodById(periodId);
            if (!period) return null;
            return (
              <div className="cd-repair-row" key={periodId}>
                <span>{periodLabel(period)}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onOpenPeriod(toEditablePeriod(period))}
                >
                  Zeitraum bearbeiten
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {duplicates.map((entry) => (
        <ReconcileCard key={`reconcile-${entry[0].id}-${entry[1].id}`} periods={entry} {...shared} />
      ))}

      {adjacent.map((entry) => (
        <ConsolidateCard
          key={`consolidate-${entry[0].id}-${entry[1].id}`}
          periods={entry}
          {...shared}
        />
      ))}

      {migrated.map((issue) => {
        const period = periodById(issue.periodIds[0]);
        if (!period) return null;
        return (
          <Card
            key={`migrated-${period.id}`}
            title="Abschnitt vermutlich aus einer Übernahme"
            explanation="Die Notiz stammt aus der Datenübernahme. Bitte Datum, Qualifikation und Arbeitszeit anhand des Belegs prüfen und die Notiz danach anpassen; damit verschwindet der Hinweis."
          >
            <div className="cd-repair-row">
              <span>{periodLabel(period)}</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onOpenPeriod(toEditablePeriod(period))}
              >
                Zeitraum bearbeiten
              </button>
            </div>
          </Card>
        );
      })}

      {sameName.map((issue) => {
        const other = overview.employees.find(
          (employee) => employee.id === issue.relatedEmployeeId,
        );
        if (!other) return null;
        return (
          <MergeCard
            key={`merge-${other.id}`}
            targetId={employeeId}
            sourceId={other.id}
            sourceName={other.birthDate ? `${other.name} (geb. ${formatDate(other.birthDate)})` : other.name}
            {...shared}
          />
        );
      })}
    </div>
  );
};

export default EmploymentRepairPanel;
