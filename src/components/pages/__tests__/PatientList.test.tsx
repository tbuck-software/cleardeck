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
    serviceScope: 'eligible',
    assessmentSource: 'report',
    assessmentDate: '2026-01-01',
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
    serviceScope: 'eligible',
    assessmentSource: 'report',
    assessmentDate: '2026-01-01',
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
    serviceScope: 'eligible',
    assessmentSource: 'report',
    assessmentDate: '2026-01-01',
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

const renderList = (
  overrides: Partial<React.ComponentProps<typeof PatientList>> = {},
): ReturnType<typeof render> =>
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
  const namesInOrder = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td > div')?.firstChild?.textContent);

  it('sortiert deutsche Namen in beide Richtungen ohne die Eingabeliste zu ändern', () => {
    const input = [
      { ...patients[0], name: 'Zoe Ziegler' },
      { ...patients[1], name: 'Änne Müller' },
      { ...patients[2], name: 'Berta Braun' },
    ];
    renderList({ patients: input });
    expect(namesInOrder()).toEqual(['Änne Müller', 'Berta Braun', 'Zoe Ziegler']);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(namesInOrder()).toEqual(['Zoe Ziegler', 'Berta Braun', 'Änne Müller']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(input.map((p) => p.name)).toEqual(['Zoe Ziegler', 'Änne Müller', 'Berta Braun']);
  });

  it('sortiert Diagnosen und lässt fehlende Angaben in beiden Richtungen am Ende', () => {
    renderList({ patients: [patients[0], { ...patients[1], diagnosis: ' ' }, patients[2]] });
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose' }));
    expect(namesInOrder()).toEqual(['Kurt Ziegler', 'Erika Mustermann', 'Werner Fuchs']);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose' }));
    expect(namesInOrder()).toEqual(['Erika Mustermann', 'Kurt Ziegler', 'Werner Fuchs']);
  });

  it('sortiert Visiten numerisch und Datumswerte chronologisch statt nach Anzeigetext', () => {
    renderList({
      patients: [
        { ...patients[0], visitCount: 10 },
        { ...patients[1], visitCount: 2 },
        { ...patients[2], visitCount: 0 },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Visiten' }));
    expect(namesInOrder()).toEqual(['Kurt Ziegler', 'Werner Fuchs', 'Erika Mustermann']);
    fireEvent.click(screen.getByRole('button', { name: 'Letzte Visite' }));
    expect(namesInOrder()).toEqual(['Werner Fuchs', 'Erika Mustermann', 'Kurt Ziegler']);
    fireEvent.click(screen.getByRole('button', { name: 'Letzte Visite' }));
    expect(namesInOrder()).toEqual(['Erika Mustermann', 'Werner Fuchs', 'Kurt Ziegler']);
  });

  it('sortiert Fälligkeiten einschließlich Erstvisiten und hält unbekannte Termine am Ende', () => {
    renderList({
      patients: [
        patients[0],
        { ...patients[1], latestVisitDate: null, admissionDate: null },
        patients[2],
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nächste fällig' }));
    expect(namesInOrder()).toEqual(['Kurt Ziegler', 'Erika Mustermann', 'Werner Fuchs']);
    fireEvent.click(screen.getByRole('button', { name: 'Nächste fällig' }));
    expect(namesInOrder()).toEqual(['Erika Mustermann', 'Kurt Ziegler', 'Werner Fuchs']);
  });

  it('erhält die gefilterte Archivliste, Gruppenauswahl und Datensatzauswahl beim Sortieren', () => {
    const onSelect = vi.fn(),
      onGroupChange = vi.fn();
    renderList({
      patients: [patients[0], patients[2]],
      groupFilter: 'archived',
      onSelect,
      onGroupChange,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Teilgruppe' }));
    expect(namesInOrder()).toEqual(['Erika Mustermann', 'Kurt Ziegler']);
    expect(screen.getByRole('radio', { name: 'Archiv' })).toBeChecked();
    fireEvent.click(screen.getByText('Kurt Ziegler'));
    expect(onSelect).toHaveBeenCalledWith(patients[2]);
    fireEvent.click(screen.getByRole('radio', { name: 'A' }));
    expect(onGroupChange).toHaveBeenCalledWith('A');
  });

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
    expect(screen.getAllByText(/Pflegegrad unbekannt/).length).toBeGreaterThan(0);
  });

  it('zeigt einen expliziten fehlenden Pflegegrad getrennt vom unbekannten Wert', () => {
    renderList({ patients: [{ ...patients[0], careLevel: 0 }] });

    expect(screen.getByText(/Kein Pflegegrad/)).toBeInTheDocument();
  });

  it('markiert Handlungsbedarf aus der letzten Visite', () => {
    renderList();

    expect(screen.getByText('Handlungsbedarf')).toBeInTheDocument();
  });

  it('nennt das eingestellte Intervall in der Hilfe', () => {
    renderList({ visitIntervalDays: 30 });

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe' }));

    expect(screen.getByText(/Visitenintervall beträgt 30 Tage/)).toBeInTheDocument();
  });

  it('öffnet eine Zeile', () => {
    const onSelect = vi.fn();
    renderList({ onSelect });

    fireEvent.click(screen.getByText('Erika Mustermann'));
    expect(onSelect).toHaveBeenCalledWith(patients[0]);
  });

  it('fällt in schmalen Fenstern auf eine Liste zurück', () => {
    renderList({
      wideTable: false,
      patients: [{ ...patients[0], careLevel: 0 }, patients[2]],
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Erika Mustermann')).toBeInTheDocument();
    expect(screen.getByText(/Kein Pflegegrad/)).toBeInTheDocument();
    expect(screen.getByText(/Pflegegrad unbekannt/)).toBeInTheDocument();
  });
});
