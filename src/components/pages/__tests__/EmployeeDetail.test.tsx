/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeDetail from '../EmployeeDetail';
import type {
  EmployeeCompetency,
  EmployeeInstruction,
  EmployeeWithPeriod,
} from '../../../shared/types';

const employee: EmployeeWithPeriod = {
  id: 1,
  name: 'Anna Beispiel',
  qualification: 'Pflegefachkraft',
  startDate: '2024-01-01',
  endDate: '',
  fte: 0.8,
  weeklyHours: 30,
  status: 'active',
  note: 'Station A',
  birthDate: '1985-06-12',
};

const competencies: EmployeeCompetency[] = [
  {
    id: 10,
    competencyDefinitionId: 1,
    competencyCode: 'K01',
    competencyName: 'Subkutane Injektion',
    category: 'Behandlungspflege',
    level: 5,
    approvedAt: '2024-03-12',
  },
  {
    id: 11,
    competencyDefinitionId: 2,
    competencyName: 'Portversorgung',
    category: 'Spezial',
    level: null,
  },
];

const instructions: EmployeeInstruction[] = [
  {
    id: 20,
    instructionDefinitionId: 1,
    instructionName: 'Brandschutz',
    legalBasis: 'ArbSchG §12',
    dueDate: '2020-01-01',
    completedAt: null,
  },
];

const noop = (): void => undefined;

const renderDetail = (
  overrides: Partial<React.ComponentProps<typeof EmployeeDetail>> = {},
): ReturnType<typeof render> =>
  render(
    <EmployeeDetail
      employee={employee}
      baseHours={36}
      tab="comp"
      competencies={competencies}
      instructions={instructions}
      timelineItems={[]}
      employmentIntegrity={{ issues: [], employees: [], periods: [] }}
      backupFolder={null}
      suggestedCompetencyCount={2}
      availableCompetencyCount={3}
      availableInstructionCount={3}
      onTabChange={noop}
      onEdit={noop}
      onCompetenciesSaved={vi.fn()} onWorkingTimeSaved={async () => undefined}
      onAddCompetency={noop}
      onAddInstruction={noop}
      onOpenSuggestedCompetencies={noop}
      onSelectCompetency={noop}
      onSelectInstruction={noop}
      onStartNewPeriod={noop}
      onSelectTimelineItem={noop}
      onEditPeriod={noop}
      onOpenBackupSettings={noop}
      onEmploymentRepairApplied={noop}
      {...overrides}
    />,
  );

describe('EmployeeDetail', () => {
  it('zeigt Stammdaten und offene Pflichten', () => {
    renderDetail();

    expect(screen.getByRole('heading', { name: 'Anna Beispiel' })).toBeInTheDocument();
    expect(screen.getByText('30 h')).toBeInTheDocument();
    expect(screen.getByText('0,80')).toBeInTheDocument();
    // Zwei noch nicht abgeschlossene Kompetenzen plus eine offene Einweisung.
    const openLabel = screen.getByText('offene Pflichten');
    expect(openLabel.previousElementSibling).toHaveTextContent('3');
  });

  it('zeigt die Kompetenzmatrix mit Stufe', () => {
    renderDetail();

    expect(screen.getByText('Subkutane Injektion')).toBeInTheDocument();
    expect(screen.getByText('Stufe 5')).toBeInTheDocument();
    expect(screen.getByText('Offen')).toBeInTheDocument();
  });

  it('bietet Vorschläge und Hinzufügen an', () => {
    const onAddCompetency = vi.fn();
    const onOpenSuggestedCompetencies = vi.fn();
    renderDetail({ onAddCompetency, onOpenSuggestedCompetencies });

    fireEvent.click(screen.getByText('Kompetenz hinzufügen'));
    expect(onAddCompetency).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('2 Vorschläge aus Qualifikation'));
    expect(onOpenSuggestedCompetencies).toHaveBeenCalledTimes(1);
  });

  it('markiert überfällige Einweisungen', () => {
    renderDetail({ tab: 'instr' });

    expect(screen.getByText('Brandschutz')).toBeInTheDocument();
    expect(screen.getByText('überfällig')).toBeInTheDocument();
  });

  it('zeigt leere Historie', () => {
    renderDetail({ tab: 'hist' });

    expect(screen.getByText('Keine Einträge.')).toBeInTheDocument();
    expect(screen.queryByText('Beschäftigungsdaten prüfen')).not.toBeInTheDocument();
  });

  it('zeigt den Hinweisbereich nur bei Befunden zu dieser Person', () => {
    renderDetail({
      tab: 'hist',
      employmentIntegrity: {
        issues: [
          {
            kind: 'reversed-period',
            severity: 'error',
            employeeId: 1,
            relatedEmployeeId: null,
            periodIds: [5],
          },
        ],
        employees: [{ id: 1, name: 'Anna Beispiel', birthDate: '1985-06-12' }],
        periods: [
          {
            id: 5,
            employeeId: 1,
            startDate: '2024-05-01',
            endDate: '2024-01-31',
            qualification: 'Pflegefachkraft',
            note: null,
            weeklyHours: 30,
            fte: 0.8,
          },
        ],
      },
    });

    expect(screen.getByText('Beschäftigungsdaten prüfen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zeiträume prüfen' })).toBeInTheDocument();
  });

  it('erklärt, warum "Kompetenz hinzufügen" gesperrt ist', () => {
    renderDetail({ availableCompetencyCount: 0 });
    expect(screen.getByText('Kompetenz hinzufügen').closest('button')).toBeDisabled();
    expect(screen.getByText('Alle Kompetenzen des Katalogs sind zugeordnet.')).toBeInTheDocument();
  });
});

it('shows effective working-time sections in the existing timeline, without recording snapshots or a second table', () => {
  renderDetail({
    tab: 'hist',
    employee: {
      ...employee,
      workingTimes: [
        { id: 2, periodId: 1, effectiveFrom: '2025-01-01', effectiveUntil: null, weeklyHours: 36, fte: 1 },
        { id: 1, periodId: 1, effectiveFrom: '2024-09-01', effectiveUntil: '2024-12-31', weeklyHours: 18, fte: 0.5 },
      ],
      hoursHistory: [
        { id: 3, effectiveFrom: '2025-01-01', weeklyHours: 27, fte: 0.75, verified: 1, sourceRef: null, changedAt: '2026-09-06 13:00:00' },
      ],
    },
    timelineItems: [
      { kind: 'event', date: '2025-01-01', record: { id: 1, eventDate: '2025-01-01', type: 'weekly-hours-change', title: 'Wochenstundenänderung' } },
      { kind: 'event', date: '2024-12-01', record: { id: 2, eventDate: '2024-12-01', type: 'custom', title: 'Probezeit beendet' } },
    ],
  });
  const section = screen.getByRole('heading', { name: 'Historie' }).closest('section')!;
  expect(section).toHaveTextContent('36 Std./Woche · 1,00 VZÄ');
  expect(section).toHaveTextContent('18 Std./Woche · 0,50 VZÄ · bis 31.12.2024');
  expect(section).toHaveTextContent('Probezeit beendet');
  expect(section).not.toHaveTextContent('Wochenstundenänderung');
  expect(section).not.toHaveTextContent('Arbeitszeit erfasst');
  expect(section).not.toHaveTextContent('27 Std./Woche');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  const rows = section.querySelectorAll('.cd-timeline-row');
  expect(rows[0]).toHaveTextContent('01.01.2025');
  expect(rows[1]).toHaveTextContent('01.12.2024');
  expect(rows[2]).toHaveTextContent('01.09.2024');
});

it('shows the employment chain start separately from the selected qualification period', () => {
  renderDetail({
    tab: 'hist',
    employee: { ...employee, periodId: 3, startDate: '2025-01-01' },
    timelineItems: [
      {
        kind: 'period',
        date: '2025-01-01',
        record: { id: 3, startDate: '2025-01-01', endDate: null, qualification: 'Pflegekraft' },
      },
      {
        kind: 'period',
        date: '2024-01-01',
        record: { id: 2, startDate: '2024-01-01', endDate: '2024-12-31', qualification: 'Pflegekraft' },
      },
      {
        kind: 'period',
        date: '2023-07-01',
        record: { id: 1, startDate: '2023-07-01', endDate: '2023-12-31', qualification: 'Fachkraft' },
      },
    ],
  });

  expect(screen.getByText(/Abschnitt seit 01\.01\.2025/)).toBeInTheDocument();
  expect(document.querySelector('.cd-detail-employment-start')).toHaveTextContent(
    'Beschäftigt seit 01.07.2023',
  );
});

it('collapses only redundant boundary events and keeps notes or custom titles', () => {
  renderDetail({
    tab: 'hist',
    timelineItems: [
      {
        kind: 'period',
        date: '2024-01-01',
        record: { id: 1, startDate: '2024-01-01', endDate: '2024-12-31', qualification: 'Pflegekraft' },
      },
      {
        kind: 'event',
        date: '2024-01-01',
        record: { id: 2, eventDate: '2024-01-01', type: 'join', title: 'Eintritt' },
      },
      {
        kind: 'event',
        date: '2024-01-01',
        record: {
          id: 5,
          eventDate: '2024-01-01',
          type: 'join',
          title: 'Eintritt',
          details: 'Startdatum: 2024-01-01',
        },
      },
      {
        kind: 'event',
        date: '2024-01-01',
        record: {
          id: 6,
          eventDate: '2024-01-01',
          type: 'join',
          title: 'Eintritt',
          details:
            'Aus bisherigem Eintrittsereignis übernommen. Qualifikation und Stunden prüfen. Personalakte geprüft.',
        },
      },
      {
        kind: 'event',
        date: '2024-12-31',
        record: { id: 3, eventDate: '2024-12-31', type: 'leave', title: 'Austritt', details: 'Vertrag bis Jahresende.' },
      },
      {
        kind: 'event',
        date: '2024-01-01',
        record: { id: 4, eventDate: '2024-01-01', type: 'join', title: 'Rückkehr aus Elternzeit' },
      },
    ],
  });

  const section = screen.getByRole('heading', { name: 'Historie' }).closest('section')!;
  expect(section.querySelectorAll('.cd-timeline-row')).toHaveLength(4);
  expect(section).not.toHaveTextContent('Startdatum: 2024-01-01');
  expect(section).toHaveTextContent('Personalakte geprüft.');
  expect(section).toHaveTextContent('Austritt');
  expect(section).toHaveTextContent('Vertrag bis Jahresende.');
  expect(section).toHaveTextContent('Rückkehr aus Elternzeit');
  expect(screen.getByRole('button', { name: 'Beschäftigungsperiode ab 01.01.2024 bearbeiten' })).toBeInTheDocument();
});
