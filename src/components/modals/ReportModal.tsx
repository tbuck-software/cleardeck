import React from 'react';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
import type { YearDataset } from '../../shared/types';

const fte2 = (value: number) => value.toFixed(2).replace('.', ',');

type ReportModalProps = {
  open: boolean;
  loading?: boolean;
  year: number;
  years: number[];
  baseHours: number;
  dataset: YearDataset | null;
  mode?: 'stichtag' | 'year-average' | 'month-end-average';
  onModeChange?: (mode: 'stichtag' | 'year-average' | 'month-end-average') => void;
  onYearChange: (year: number) => void;
  onExport: () => void;
  onFixMissingHours: () => void;
  onClose: () => void;
};

const ReportModal = ({
  open,
  loading = false,
  year,
  years,
  baseHours,
  dataset,
  onYearChange,
  mode = 'month-end-average',
  onModeChange,
  onExport,
  onFixMissingHours,
  onClose,
}: ReportModalProps) => {
  const monthly = mode === 'month-end-average';
  const modeLabel = monthly ? 'Durchschnitt aus 12 Monatsenden'
    : mode === 'stichtag' ? 'Stichtag 31.12.' : 'Taggewichteter Jahresdurchschnitt';
  const employees = dataset?.employees ?? [];
  const categories = dataset?.aggregation.categories ?? [];
  const missingHours = employees.filter((employee) => employee.weeklyHours == null);
  const missingEnd = employees.filter(
    (employee) => employee.status === 'left' && !employee.endDate,
  );

  const checks = [
    {
      id: 'end',
      label: missingEnd.length
        ? `${missingEnd.length} Austritt${missingEnd.length === 1 ? '' : 'e'} ohne Datum`
        : 'Alle Austritte im Jahr haben ein Datum',
      dot: missingEnd.length ? 'var(--bad-800)' : 'var(--ok-800)',
      fix: undefined,
    },
    {
      id: 'hours',
      label: missingHours.length
        ? `${missingHours.length} Person${missingHours.length === 1 ? '' : 'en'} ohne Wochenstunden; Stellenanteil und Beleg prüfen`
        : 'Alle Personen haben Wochenstunden',
      dot: missingHours.length ? 'var(--bad-800)' : 'var(--ok-800)',
      fix: missingHours.length ? onFixMissingHours : undefined,
    },
    {
      id: 'base',
      label: `${modeLabel} · Bezugswert ${dataset?.baseHours ?? baseHours} h`,
      dot: 'var(--ok-800)',
      fix: undefined,
    },
  ];

  return (
    <Dialog
      open={open}
      width={600}
      title="Jahresnachweis"
      help={[
        {
          title: 'Berechnung und Verwendung',
          body: `${
            monthly
              ? `Jahresdurchschnitt ${year}: Summe der gültigen Stellenanteile an allen zwölf Monatsenden / 12. Monate ohne Beschäftigte zählen mit null. Es werden die erfassten Stellenanteile verwendet, ohne gesonderte SGB-XI-Aufteilung.`
              : mode === 'stichtag'
              ? `Bestand zum 31.12.${year}.`
              : `Jahresdurchschnitt ${year}: Stellenanteil × inklusive Beschäftigungstage / Kalendertage des Jahres.`
          } Ob dieser Nachweis dem benötigten Vertragsformular entspricht, ist betrieblich zu prüfen.`,
        },
        {
          title: 'Wie werden Wechsel berücksichtigt?',
          body: `${monthly ? 'Es zählen nur Personen und Qualifikationen, die an mindestens einem Monatsende vertreten sind. Die Personenzahl ist kein Monatsdurchschnitt. ' : ''}Stunden- und Qualifikationswechsel teilen den Zeitraum. Personen zählen je Qualifikation einmal; bei einem Wechsel kann dieselbe Person in mehreren Kategorien vorkommen. Die Gesamtzahl zählt jede Person einmal.`,
        },
      ]}
      primaryLabel="Als Excel exportieren"
      onPrimary={onExport}
      primaryDisabled={loading || !dataset}
      onClose={onClose}
    >
      {(dataset?.unverifiedHoursCount ?? 0) > 0 && (
        <p role="alert">
          Vorläufig: {dataset?.unverifiedHoursCount} Stellenanteile noch ungeprüft.
        </p>
      )}
      {loading && <p>Berichtsjahr wird geladen …</p>}
      {onModeChange && (
        <Segmented
          ariaLabel="Auswertungsart"
          wrap
          options={[
            { value: 'month-end-average' as const, label: 'Durchschnitt aus 12 Monatsenden' },
            { value: 'year-average' as const, label: 'Taggewichteter Jahresdurchschnitt' },
            { value: 'stichtag' as const, label: 'Stichtag 31.12.' },
          ]}
          value={mode}
          onChange={onModeChange}
        />
      )}
      {employees.some((e) => e.hoursMissing) && (
        <p role="alert">
          Stellenanteile fehlen. Diese Zeitabschnitte sind in der Summe nicht enthalten.
        </p>
      )}
      <Segmented
        ariaLabel="Jahr"
        style={{ alignSelf: 'flex-start' }}
        options={years.map((value) => ({ value, label: String(value) }))}
        value={year}
        onChange={onYearChange}
      />

      {monthly && <p className="cd-muted-13">
        VZÄ: Summe der zwölf Monatsendwerte geteilt durch 12. Personen zählen je Qualifikation
        einmal, wenn sie an mindestens einem Monatsende beschäftigt waren.
        Die Stellenanteile werden nicht gesondert auf SGB XI begrenzt.
      </p>}
      <table className="ds-table">
        <thead>
          <tr>
            <th>Qualifikation</th>
            <th style={{ textAlign: 'right' }}>{monthly ? 'Personen an Monatsenden' : 'Personen'}</th>
            <th style={{ textAlign: 'right' }}>VZÄ</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.qualification}>
              <td>{category.qualification}</td>
              <td style={{ textAlign: 'right' }}>{category.headcount}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fte2(category.fte)}</td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={3} className="cd-muted-13">
                {monthly ? `Keine Beschäftigten an den Monatsenden ${year}.` : `Keine Beschäftigten im Jahr ${year}.`}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ fontWeight: 700, padding: '10px 8px' }}>Gesamt {year}</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>
              {dataset?.aggregation.totalHeadcount ?? 0}
            </td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>
              {fte2(dataset?.aggregation.totalFte ?? 0)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '0 -8px' }}>
        {checks.map((check) =>
          check.fix ? (
            <button
              key={check.id}
              type="button"
              className="cd-item"
              style={{ padding: '8px 10px', fontSize: 14 }}
              onClick={check.fix}
            >
              <span className="cd-dot-lg" style={{ background: check.dot }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{check.label}</span>
              <span style={{ fontSize: 13, color: 'var(--color-accent-700)', fontWeight: 600 }}>
                Beheben →
              </span>
            </button>
          ) : (
            <div
              key={check.id}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                padding: '8px 10px',
                fontSize: 14,
              }}
            >
              <span className="cd-dot-lg" style={{ background: check.dot }} />
              <span style={{ flex: 1 }}>{check.label}</span>
            </div>
          ),
        )}
      </div>
    </Dialog>
  );
};

export default ReportModal;
