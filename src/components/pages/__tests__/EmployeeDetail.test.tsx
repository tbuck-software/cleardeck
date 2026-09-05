/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeDetail from '../EmployeeDetail';
import type { EmployeeCompetency, EmployeeInstruction, EmployeeWithPeriod } from '../../../shared/types';

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

const renderDetail = (overrides: Partial<React.ComponentProps<typeof EmployeeDetail>> = {}): ReturnType<typeof render> =>
  render(
    <EmployeeDetail
      employee={employee}
      baseHours={36}
      tab="comp"
      competencies={competencies}
      instructions={instructions}
      timelineItems={[]}
      suggestedCompetencyCount={2}
      availableCompetencyCount={3}
      availableInstructionCount={3}
      onTabChange={noop}
      onEdit={noop}
      onAddCompetency={noop}
      onAddInstruction={noop}
      onOpenSuggestedCompetencies={noop}
      onSelectCompetency={noop}
      onSelectInstruction={noop}
      onStartNewPeriod={noop}
      onSelectTimelineItem={noop}
      {...overrides}
    />,
  );

describe('EmployeeDetail', () => {
  it('zeigt Stammdaten und offene Pflichten', () => {
    renderDetail();

    expect(screen.getByRole('heading', { name: 'Anna Beispiel' })).toBeInTheDocument();
    expect(screen.getByText('30 h')).toBeInTheDocument();
    expect(screen.getByText('0,80')).toBeInTheDocument();
    // Eine Kompetenz ohne Stufe plus eine offene Einweisung.
    const openLabel = screen.getByText('offene Pflichten');
    expect(openLabel.previousElementSibling).toHaveTextContent('2');
  });

  it('zeigt die Kompetenzmatrix mit Stufe', () => {
    renderDetail();

    expect(screen.getByText('Subkutane Injektion')).toBeInTheDocument();
    expect(screen.getByText('5 · Kann anleiten')).toBeInTheDocument();
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
  });

  it('erklärt, warum "Kompetenz hinzufügen" gesperrt ist', () => {
    renderDetail({ availableCompetencyCount: 0 });
    expect(screen.getByText('Kompetenz hinzufügen').closest('button')).toBeDisabled();
    expect(screen.getByText('Alle Kompetenzen des Katalogs sind zugeordnet.')).toBeInTheDocument();
  });
});
