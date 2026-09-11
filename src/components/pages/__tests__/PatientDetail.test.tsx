/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import PatientDetail from '../PatientDetail';
import type { PatientVisit, PatientWithLatestVisit } from '../../../shared/types';

const patient: PatientWithLatestVisit = {
  id: 1,
  name: 'Werner Fuchs',
  diagnosis: 'Herzinsuffizienz NYHA III',
  birthDate: '1936-01-25',
  careLevel: 4,
  serviceScope: 'eligible',
  assessmentSource: 'report',
  assessmentDate: '2026-01-01',
  cognitionImpaired: true,
  mobilityImpaired: true,
  hkpCode: '31a',
  intensiveCare: null,
  contact: 'Betreuer Hr. Lange · 0431 998877',
  latestVisitDate: '2026-06-30',
  latestActionNeeded: true,
};

const visits: PatientVisit[] = [
  {
    id: 1,
    patientId: 1,
    visitDate: '2026-06-30',
    actionNeeded: true,
    comment: 'Dekubitus Sakrum Grad 2',
  },
];

const noop = (): void => undefined;

const renderDetail = (
  overrides: Partial<React.ComponentProps<typeof PatientDetail>> = {},
): ReturnType<typeof render> =>
  render(
    <PatientDetail
      patient={patient}
      visits={visits}
      visitIntervalDays={90}
      onEdit={noop}
      onNewVisit={noop}
      onSelectVisit={noop}
      {...overrides}
    />,
  );

describe('PatientDetail', () => {
  it('zeigt Teilgruppe A und D nebeneinander', () => {
    renderDetail();

    expect(screen.getByText('Teilgruppe A')).toBeInTheDocument();
    expect(screen.getByText('Teilgruppe D · HKP 31a')).toBeInTheDocument();
  });

  it('führt die Gutachten-Grundlagen einzeln auf', () => {
    renderDetail();

    expect(screen.getByText('PG 4')).toBeInTheDocument();
    expect(
      screen.getByText('31a Wundversorgung chronische, schwer heilende Wunde'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('eingeschränkt').length).toBe(2);
  });

  it('kennzeichnet fehlende Angaben als Lücke', () => {
    renderDetail({
      patient: { ...patient, careLevel: null, cognitionImpaired: null, mobilityImpaired: null },
    });

    expect(screen.getAllByText('fehlt').length).toBeGreaterThan(0);
    expect(screen.getByText('Teilgruppe offen')).toBeInTheDocument();
  });

  it('unterscheidet unbekannten Pflegegrad und keinen Pflegegrad', () => {
    const { unmount } = renderDetail({ patient: { ...patient, careLevel: 0 } });
    expect(screen.getByText('Kein Pflegegrad')).toBeInTheDocument();
    expect(screen.queryByText('fehlt')).not.toBeInTheDocument();
    unmount();

    // Der unbekannte Pflegegrad wird wie jede andere Lücke rot als „fehlt“ gezeigt.
    renderDetail({ patient: { ...patient, careLevel: null } });
    expect(screen.getByText('fehlt')).toBeInTheDocument();
    expect(screen.queryByText('Pflegegrad unbekannt')).not.toBeInTheDocument();
  });

  it('nennt die nächste Visite als fällig oder überfällig', () => {
    renderDetail({ patient: { ...patient, latestVisitDate: '2026-01-01' } });
    expect(screen.getByText(/Nächste Pflegevisite überfällig seit/)).toBeInTheDocument();

    renderDetail({ patient: { ...patient, latestVisitDate: '2099-01-01' } });
    expect(screen.getByText(/Nächste Pflegevisite fällig am 01\.04\.2099/)).toBeInTheDocument();
  });

  it('listet Visiten mit Handlungsbedarf', () => {
    renderDetail();

    const visitRow = screen.getByText('Dekubitus Sakrum Grad 2').closest('button') as HTMLElement;
    expect(visitRow).toHaveTextContent('30.06.2026');
    expect(visitRow).toHaveTextContent('Handlungsbedarf');
  });

  it('zeigt einen leeren Zustand ohne Visiten', () => {
    renderDetail({ visits: [] });

    expect(screen.getByText('Noch keine Visite dokumentiert.')).toBeInTheDocument();
  });

  it('startet eine neue Visite', () => {
    const onNewVisit = vi.fn();
    renderDetail({ onNewVisit });

    fireEvent.click(screen.getByText('Neue Visite'));
    expect(onNewVisit).toHaveBeenCalledTimes(1);
  });
});
