/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import PatientList from '../PatientList';
import type { PatientVisit, PatientWithLatestVisit } from '../../../shared/types';

const patients: PatientWithLatestVisit[] = [
  {
    id: 1,
    name: 'Erika Mustermann',
    diagnosis: 'Demenz',
    birthDate: '1941-03-02',
    careLevel: 3,
    cognitionImpaired: true,
    mobilityImpaired: false,
    hkpCode: null,
    latestVisitDate: '2026-08-20',
    latestActionNeeded: true,
  },
  {
    id: 2,
    name: 'Werner Fuchs',
    diagnosis: 'Herzinsuffizienz',
    cognitionImpaired: true,
    mobilityImpaired: true,
    hkpCode: '31a',
    latestVisitDate: '2026-06-30',
    latestActionNeeded: false,
  },
  {
    id: 3,
    name: 'Kurt Ziegler',
    diagnosis: 'COPD',
    cognitionImpaired: null,
    mobilityImpaired: null,
    hkpCode: null,
    latestVisitDate: null,
    admissionDate: '2026-08-28',
  },
];

const visitTrends: Record<number, PatientVisit[]> = {
  1: [
    { id: 1, patientId: 1, visitDate: '2026-02-10', actionNeeded: false },
    { id: 2, patientId: 1, visitDate: '2026-08-20', actionNeeded: true },
  ],
};

const noop = (): void => undefined;

const renderList = (overrides: Partial<React.ComponentProps<typeof PatientList>> = {}): ReturnType<typeof render> =>
  render(
    <PatientList
      search=""
      groupFilter="all"
      patients={patients}
      visitTrends={visitTrends}
      visitIntervalDays={90}
      wideTable
      onSearchChange={noop}
      onGroupChange={noop}
      onCreate={noop}
      onSelect={noop}
      {...overrides}
    />,
  );

describe('PatientList', () => {
  it('zählt die Teilgruppen im Untertitel', () => {
    renderList();

    // C aus Kognition allein, A aus beidem, D über die HKP-Ziffer.
    expect(screen.getByText(/Gruppen A 1 · B 0 · C 1 · D 1/)).toBeInTheDocument();
  });

  it('zeigt Teilgruppe und HKP getrennt an', () => {
    renderList();

    expect(screen.getByText('HKP 31a')).toBeInTheDocument();
    expect(screen.getAllByText('mobil + kognitiv beeinträchtigt').length).toBe(1);
  });

  it('kennzeichnet fehlende Gutachten-Daten statt zu raten', () => {
    renderList();

    expect(screen.getByText('Gutachten-Daten fehlen')).toBeInTheDocument();
  });

  it('markiert Handlungsbedarf aus der letzten Visite', () => {
    renderList();

    expect(screen.getByText('Handlungsbedarf')).toBeInTheDocument();
  });

  it('nennt das eingestellte Intervall in der Erläuterung', () => {
    renderList({ visitIntervalDays: 30 });

    expect(screen.getByText(/Intervall 30 Tage/)).toBeInTheDocument();
  });

  it('öffnet eine Zeile', () => {
    const onSelect = vi.fn();
    renderList({ onSelect });

    fireEvent.click(screen.getByText('Erika Mustermann'));
    expect(onSelect).toHaveBeenCalledWith(patients[0]);
  });

  it('fällt in schmalen Fenstern auf eine Liste zurück', () => {
    renderList({ wideTable: false });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Erika Mustermann')).toBeInTheDocument();
  });
});
