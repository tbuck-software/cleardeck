/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard';
import type { UnifiedEvent, YearDataset } from '../../../shared/types';
import type { DashboardTask, DataQualityCheck } from '../../../utils/dashboardTasks';

const sampleDataset: YearDataset = {
  employees: [],
  aggregation: {
    totalHeadcount: 3,
    totalFte: 7.5,
    categories: [
      { qualification: 'Pflegekraft', headcount: 2, fte: 4.5 },
      { qualification: 'Admin', headcount: 1, fte: 3 },
    ],
  },
  baseHours: 36,
};

const tasks: DashboardTask[] = [
  {
    id: 'patient-action-1',
    title: 'Erika Mustermann — Handlungsbedarf aus Visite',
    sub: 'Folgevisite dokumentieren',
    tag: 'Visite',
    tagClass: 'tag-bad',
    weight: 0,
    target: { kind: 'patient', id: 1 },
  },
];

const quality: DataQualityCheck[] = [
  { id: 'hours', label: '1 Person ohne Wochenstunden', dot: 'var(--bad-800)', target: { kind: 'employee', id: 9 } },
];

const upcoming: UnifiedEvent[] = [
  {
    id: 'event-1',
    employeeId: 1,
    date: new Date().toISOString().slice(0, 10),
    type: 'care-visit',
    title: 'Pflegevisite',
    employeeName: 'Max Mustermann',
  },
];

const noop = (): void => undefined;

const renderDashboard = (overrides: Partial<React.ComponentProps<typeof Dashboard>> = {}): ReturnType<typeof render> =>
  render(
    <Dashboard
      year={2026}
      years={[2024, 2025, 2026]}
      dataset={sampleDataset}
      baseHours={36}
      totalFte={7.5}
      totalHeadcount={3}
      actionNeededCount={1}
      tasks={tasks}
      doneTaskIds={[]}
      quality={quality}
      upcoming={upcoming}
      onYearChange={noop}
      onToggleTask={noop}
      onOpenTarget={noop}
      onOpenEvent={noop}
      onOpenReport={noop}
      onGoCalendar={noop}
      onOpenTasks={noop}
      {...overrides}
    />,
  );

describe('Dashboard', () => {
  it('zeigt Kennzahlen und VZÄ je Qualifikation', () => {
    renderDashboard();

    expect(screen.getByText('VZÄ gesamt')).toBeInTheDocument();
    expect(screen.getAllByText('7,50').length).toBeGreaterThan(0);
    expect(screen.getByText('Ø VZÄ je Person')).toBeInTheDocument();
    expect(screen.getByText('Pflegekraft')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('listet offene Aufgaben mit Zähler', () => {
    renderDashboard();

    expect(screen.getByText('Heute zu tun')).toBeInTheDocument();
    expect(screen.getByText(/1 offen/)).toBeInTheDocument();
    expect(screen.getByText('Erika Mustermann — Handlungsbedarf aus Visite')).toBeInTheDocument();
  });

  it('zählt abgehakte Aufgaben nicht mehr als offen und blendet sie aus', () => {
    renderDashboard({ doneTaskIds: ['patient-action-1'] });

    expect(screen.getByText(/0 offen/)).toBeInTheDocument();
    expect(screen.queryByText('Erika Mustermann — Handlungsbedarf aus Visite')).not.toBeInTheDocument();
    expect(
      screen.getByText('Nichts offen — alle Fristen und Stammdaten sind aktuell.'),
    ).toBeInTheDocument();
  });

  it('zeigt höchstens fünf Aufgaben und verlinkt den Rest', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...tasks[0],
      id: `task-${index}`,
      title: `Aufgabe ${index}`,
    }));
    const onOpenTasks = vi.fn();
    renderDashboard({ tasks: many, onOpenTasks });

    expect(screen.getByText('Aufgabe 4')).toBeInTheDocument();
    expect(screen.queryByText('Aufgabe 5')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Alle 12 Aufgaben anzeigen/ }));
    expect(onOpenTasks).toHaveBeenCalledTimes(1);
  });

  it('blendet den Weitere-Link aus, wenn alles in die Vorschau passt', () => {
    renderDashboard();

    expect(screen.queryByRole('button', { name: /Aufgaben anzeigen/ })).not.toBeInTheDocument();
  });

  it('öffnet den Datensatz hinter einer Aufgabe', () => {
    const onOpenTarget = vi.fn();
    renderDashboard({ onOpenTarget });

    fireEvent.click(screen.getByText('Erika Mustermann — Handlungsbedarf aus Visite'));

    expect(onOpenTarget).toHaveBeenCalledWith({ kind: 'patient', id: 1 });
  });

  it('hakt eine Aufgabe ab, ohne sie zu öffnen', () => {
    const onToggleTask = vi.fn();
    const onOpenTarget = vi.fn();
    renderDashboard({ onToggleTask, onOpenTarget });

    fireEvent.click(screen.getByRole('button', { name: 'Erledigt' }));

    expect(onToggleTask).toHaveBeenCalledWith('patient-action-1');
    expect(onOpenTarget).not.toHaveBeenCalled();
  });

  it('zeigt leeren Zustand ohne Qualifikationen und Termine', () => {
    renderDashboard({
      dataset: { employees: [], aggregation: { totalHeadcount: 0, totalFte: 0, categories: [] } },
      totalFte: 0,
      totalHeadcount: 0,
      tasks: [],
      upcoming: [],
    });

    expect(screen.getByText('Keine Beschäftigten im Jahr 2026.')).toBeInTheDocument();
    expect(screen.getByText('Keine Termine in den nächsten 30 Tagen.')).toBeInTheDocument();
    expect(
      screen.getByText('Nichts offen — alle Fristen und Stammdaten sind aktuell.'),
    ).toBeInTheDocument();
  });

  it('zeigt Datenqualität mit Sprung zum Datensatz', () => {
    const onOpenTarget = vi.fn();
    renderDashboard({ onOpenTarget });

    fireEvent.click(screen.getByRole('button', { name: /1 Person ohne Wochenstunden/ }));

    expect(onOpenTarget).toHaveBeenCalledWith({ kind: 'employee', id: 9 });
  });
});
