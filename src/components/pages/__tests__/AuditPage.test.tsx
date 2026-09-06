/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AuditPage from '../AuditPage';
import type { AuditWithDetails, PatientWithLatestVisit } from '../../../shared/types';

const patients: PatientWithLatestVisit[] = [
  {
    id: 1,
    name: 'Erika Mustermann',
    serviceScope: 'eligible',
    assessmentSource: 'report',
    assessmentDate: '2026-01-01',
    cognitionImpaired: true,
    mobilityImpaired: false,
    contact: 'Tochter · 0171',
    latestVisitDate: '2026-08-20',
  },
  {
    id: 2,
    name: 'Kurt Ziegler',
    serviceScope: 'eligible',
    assessmentSource: 'report',
    assessmentDate: '2026-01-01',
    cognitionImpaired: null,
    mobilityImpaired: null,
    contact: null,
    latestVisitDate: null,
    admissionDate: '2026-01-01',
  },
];

const audits: AuditWithDetails[] = [
  {
    id: 1,
    auditDate: '2025-11-12',
    confirmed: true,
    reportRef: 'Testbericht.pdf',
    inspector: 'MD Nord · Fr. Kessler',
    kind: 'regel',
    results: [
      { sectionKey: 'qb1', result: 'A' },
      { sectionKey: 'qb2', result: 'C' },
      { sectionKey: 'qb5', result: 'no' },
    ],
    clientIds: [1],
  },
];

const noop = (): void => undefined;

const renderPage = (
  overrides: Partial<React.ComponentProps<typeof AuditPage>> = {},
): ReturnType<typeof render> =>
  render(
    <AuditPage
      patients={patients}
      audits={audits}
      visitIntervalDays={90}
      onCreateAudit={noop}
      onOpenAudit={noop}
      onExportPersonList={noop}
      onGoPatients={noop}
      onOpenPatient={noop}
      {...overrides}
    />,
  );

describe('AuditPage', () => {
  it('nennt fehlende Gutachten-Daten mit Namen', () => {
    renderPage();

    const check = screen
      .getByText('1 Klient:in ohne Gutachten-Daten')
      .closest('button') as HTMLElement;
    expect(check).toHaveTextContent('Kurt Ziegler');
  });

  it('zählt die Stichprobe gegen die Sollzahlen', () => {
    renderPage();

    expect(screen.getByText(/A 0\/2 · B 0\/2 · C 1\/2 · D \(HKP\) 0\/3/)).toBeInTheDocument();
  });

  it('meldet überfällige Visiten', () => {
    renderPage();

    expect(screen.getByText('1 Pflegevisite überfällig')).toBeInTheDocument();
  });

  it('meldet fehlende Bevollmächtigte', () => {
    renderPage();

    expect(screen.getByText('1 Person ohne Bevollmächtigte/Betreuung')).toBeInTheDocument();
  });

  it('kürzt lange Namenslisten', () => {
    const many = Array.from(
      { length: 11 },
      (_, index): PatientWithLatestVisit => ({
        id: 100 + index,
        name: `Person ${String(index + 1).padStart(2, '0')}`,
        serviceScope: 'eligible',
        assessmentSource: 'report',
        assessmentDate: '2026-01-01',
        cognitionImpaired: null,
        mobilityImpaired: null,
        contact: 'Angehörige · 0171',
        latestVisitDate: '2026-08-20',
      }),
    );
    renderPage({ patients: many });

    const check = screen
      .getByText('11 Klient:innen ohne Gutachten-Daten')
      .closest('button') as HTMLElement;
    expect(check).toHaveTextContent('Person 01, Person 02, Person 03, Person 04 und 7 weitere');
    expect(check).not.toHaveTextContent('Person 05');
  });

  it('listet wenige Namen vollständig auf', () => {
    renderPage();

    const check = screen
      .getByText('1 Klient:in ohne Gutachten-Daten')
      .closest('button') as HTMLElement;
    expect(check).toHaveTextContent('Kurt Ziegler');
    expect(check).not.toHaveTextContent('weitere');
  });

  it('zeigt das schwächste QB-1–3-Ergebnis als ausdrücklich interne Zusammenfassung', () => {
    renderPage();

    expect(screen.getByText('12.11.2025')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Interne Zusammenfassung, höchste erfasste Defizitstufe C · 1 Kriterium nicht erfüllt · 1 Klient:innen/,
      ),
    ).toBeInTheDocument();
  });

  it('exportiert die Personenliste', () => {
    const onExportPersonList = vi.fn();
    renderPage({ onExportPersonList });

    fireEvent.click(screen.getByText('Personenliste (Anlage 7) exportieren'));
    expect(onExportPersonList).toHaveBeenCalledTimes(1);
  });

  it('zeigt einen leeren Zustand ohne Prüfungen', () => {
    renderPage({ audits: [] });

    expect(screen.getByText(/Noch keine Prüfung erfasst/)).toBeInTheDocument();
    expect(screen.getByText(/noch keine bestätigte Prüfung/)).toBeInTheDocument();
  });
});
