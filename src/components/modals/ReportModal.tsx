import React from 'react';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
import type { YearDataset } from '../../shared/types';

const fte2 = (value: number) => value.toFixed(2).replace('.', ',');

type ReportModalProps = {
  open: boolean;
  year: number;
  years: number[];
  baseHours: number;
  dataset: YearDataset | null;
  onYearChange: (year: number) => void;
  onExport: () => void;
  onFixMissingHours: () => void;
  onClose: () => void;
};

const ReportModal = ({
  open,
  year,
  years,
  baseHours,
  dataset,
  onYearChange,
  onExport,
  onFixMissingHours,
  onClose,
}: ReportModalProps) => {
  const employees = dataset?.employees ?? [];
  const categories = dataset?.aggregation.categories ?? [];
  const missingHours = employees.filter((employee) => employee.weeklyHours == null);
  const missingEnd = employees.filter((employee) => employee.status === 'left' && !employee.endDate);

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
        ? `${missingHours.length} Person${missingHours.length === 1 ? '' : 'en'} ohne Wochenstunden — fehlt in der VZÄ-Summe`
        : 'Alle Personen haben Wochenstunden',
      dot: missingHours.length ? 'var(--bad-800)' : 'var(--ok-800)',
      fix: missingHours.length ? onFixMissingHours : undefined,
    },
    {
      id: 'base',
      label: `Stichtag 31.12. · Basis ${baseHours} h`,
      dot: 'var(--ok-800)',
      fix: undefined,
    },
  ];

  return (
    <Dialog
      open={open}
      width={600}
      title="Jahresnachweis"
      subtitle="Nachweis für den Krankenkassenverband — Personen und VZÄ je Qualifikation."
      primaryLabel="Als Excel exportieren"
      onPrimary={onExport}
      onClose={onClose}
    >
      <Segmented
        ariaLabel="Jahr"
        style={{ alignSelf: 'flex-start' }}
        options={years.map((value) => ({ value, label: String(value) }))}
        value={year}
        onChange={onYearChange}
      />

      <table className="ds-table">
        <thead>
          <tr>
            <th>Qualifikation</th>
            <th style={{ textAlign: 'right' }}>Personen</th>
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
                Keine Beschäftigten im Jahr {year}.
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
              <span style={{ fontSize: 13, color: 'var(--color-accent-700)', fontWeight: 600 }}>Beheben →</span>
            </button>
          ) : (
            <div
              key={check.id}
              style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '8px 10px', fontSize: 14 }}
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
