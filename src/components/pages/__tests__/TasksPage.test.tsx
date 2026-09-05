/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, within } from '@testing-library/react';
import TasksPage from '../TasksPage';
import type { DashboardTask } from '../../../utils/dashboardTasks';

const task = (overrides: Partial<DashboardTask> & { id: string }): DashboardTask => ({
  title: `Aufgabe ${overrides.id}`,
  sub: 'Untertitel',
  tag: 'Visite',
  tagClass: 'tag-bad',
  weight: 0,
  target: { kind: 'patient', id: 1 },
  ...overrides,
});

const tasks: DashboardTask[] = [
  task({ id: 'a', title: 'Erika — Handlungsbedarf', tag: 'Visite' }),
  task({ id: 'b', title: 'Anna — Einweisung überfällig', tag: 'Einweisung' }),
  task({ id: 'c', title: 'Kurt — Gutachten-Daten fehlen', tag: 'Stammdaten' }),
  task({ id: 'd', title: 'Werner — Handlungsbedarf', tag: 'Visite' }),
];

const noop = (): void => undefined;

const renderPage = (
  overrides: Partial<React.ComponentProps<typeof TasksPage>> = {},
): ReturnType<typeof render> =>
  render(
    <TasksPage
      tasks={tasks}
      doneTaskIds={[]}
      onToggleTask={noop}
      onOpenTarget={noop}
      {...overrides}
    />,
  );

describe('TasksPage', () => {
  it('zeigt alle offenen Aufgaben ohne Kürzung', () => {
    renderPage();

    tasks.forEach((entry) => expect(screen.getByText(entry.title)).toBeInTheDocument());
    expect(screen.getByText(/4 offen/)).toBeInTheDocument();
  });

  it('filtert nach Art der Aufgabe', () => {
    renderPage();

    const filters = screen.getByRole('radiogroup', { name: 'Art der Aufgabe' });
    fireEvent.click(within(filters).getByText('Einweisung'));

    expect(screen.getByText('Anna — Einweisung überfällig')).toBeInTheDocument();
    expect(screen.queryByText('Erika — Handlungsbedarf')).not.toBeInTheDocument();
  });

  it('leitet die Kategorien mit Anzahl aus den Aufgaben ab', () => {
    renderPage();

    // Visite kommt zweimal vor und steht daher vor den einmaligen Kategorien.
    const labels = screen.getAllByRole('radio').map((input) => input.closest('label')?.textContent);
    expect(labels[0]).toContain('Alle');
    expect(labels[1]).toContain('Visite');
    expect(labels[1]).toContain('2');
  });

  it('blendet erledigte Aufgaben aus, bis man sie anfordert', () => {
    renderPage({ doneTaskIds: ['a'] });

    expect(screen.queryByText('Erika — Handlungsbedarf')).not.toBeInTheDocument();
    expect(screen.getByText(/3 offen/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('1 erledigte anzeigen'));
    expect(screen.getByText('Erika — Handlungsbedarf')).toBeInTheDocument();
  });

  it('öffnet den Datensatz hinter einer Aufgabe', () => {
    const onOpenTarget = vi.fn();
    renderPage({ onOpenTarget });

    fireEvent.click(screen.getByText('Kurt — Gutachten-Daten fehlen'));

    expect(onOpenTarget).toHaveBeenCalledWith({ kind: 'patient', id: 1 });
  });

  it('verzichtet auf einen Zurück-Knopf — dafür gibt es die Seitenleiste', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /Übersicht/ })).not.toBeInTheDocument();
  });

  it('zeigt einen leeren Zustand, wenn nichts offen ist', () => {
    renderPage({ tasks: [] });

    expect(
      screen.getByText('Nichts offen — alle Fristen und Stammdaten sind aktuell.'),
    ).toBeInTheDocument();
  });
});
