/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeDetail from '../EmployeeDetail';
import type { EmployeeWithPeriod } from '../../../shared/types';

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
};

describe('EmployeeDetail', () => {
  it('zeigt Kompetenzen pro Teammitglied mit Hinzufuegen-Aktion', () => {
    const onAddCompetency = vi.fn();
    const onOpenSuggestedCompetencies = vi.fn();

    render(
      <EmployeeDetail
        employee={employee}
        employeeCompetencies={[]}
        employeeInstructions={[]}
        canAddCompetency={true}
        canAddInstruction={true}
        suggestedCompetencyCount={2}
        displayStart="2024-01-01"
        timelineItems={[]}
        onAddCompetency={onAddCompetency}
        onAddInstruction={vi.fn()}
        onOpenSuggestedCompetencies={onOpenSuggestedCompetencies}
        onOpenEditModal={vi.fn()}
        onStartNewPeriod={vi.fn()}
        onSelectCompetency={vi.fn()}
        onSelectInstruction={vi.fn()}
        onSelectPeriod={vi.fn()}
        onSelectEvent={vi.fn()}
      />,
    );

    expect(screen.getByText('Übersicht')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kompetenzen/i }));
    expect(screen.getByText('Noch keine Kompetenzen zugeordnet.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Kompetenz hinzufügen'));
    expect(onAddCompetency).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Vorschläge aus Qualifikation'));
    expect(onOpenSuggestedCompetencies).toHaveBeenCalledTimes(1);
  });
});
