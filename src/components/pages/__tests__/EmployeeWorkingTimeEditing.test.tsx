import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmployeeDetail from '../EmployeeDetail';
import EventModal from '../../modals/EventModal';
import { useState } from 'react';
import type { EventModalState } from '../../../types/ui';
import api from '../../../services/api';
import type { EmployeeWithPeriod } from '../../../shared/types';

vi.mock('../../../services/api', () => ({ default: { workingTimes: { save: vi.fn() } } }));
const employee: EmployeeWithPeriod = {
  id: 7, name: 'Testperson', startDate: '2024-09-01', employmentStartDate: '2024-09-01',
  qualification: 'Pflegekraft',
  status: 'active', weeklyHours: 36, fte: 1,
  workingTimes: [{ id: 42, periodId: 9, effectiveFrom: '2025-03-01', effectiveUntil: null, weeklyHours: 36, fte: 1 }],
};
const showDetail = (onSaved: () => Promise<void>) => render(
  <EmployeeDetail employee={employee} baseHours={36} tab="hist" competencies={[]} instructions={[]}
    timelineItems={[]} suggestedCompetencyCount={0} availableCompetencyCount={0} availableInstructionCount={0}
    onTabChange={vi.fn()} onEdit={vi.fn()} onCompetenciesSaved={vi.fn()} onWorkingTimeSaved={onSaved} onAddCompetency={vi.fn()}
    onAddInstruction={vi.fn()} onOpenSuggestedCompetencies={vi.fn()} onSelectCompetency={vi.fn()}
    onSelectInstruction={vi.fn()} onStartNewPeriod={vi.fn()} onSelectTimelineItem={vi.fn()}
    onOpenEmploymentAction={vi.fn()} />,
);
beforeEach(() => vi.clearAllMocks());

it('opens the selected row and saves a date correction using its stable entry ID', async () => {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  vi.mocked(api.workingTimes.save).mockResolvedValue(undefined);
  showDetail(onSaved);
  fireEvent.click(screen.getByText('36 Std./Woche · 1,00 VZÄ'));
  expect(screen.getByRole('dialog', { name: 'Arbeitszeit bearbeiten' })).toBeInTheDocument();
  expect(screen.getByLabelText('Gültig ab')).toHaveValue('2025-03-01');
  expect(screen.getByLabelText('Wochenstunden')).toHaveValue(36);
  fireEvent.change(screen.getByLabelText('Gültig ab'), { target: { value: '2025-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(api.workingTimes.save).toHaveBeenCalledWith({ id: 42, employeeId: 7, effectiveFrom: '2025-01-01', weeklyHours: 36, fte: 1 });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('keeps the draft visible and shows a collision error without reporting success', async () => {
  const onSaved = vi.fn();
  vi.mocked(api.workingTimes.save).mockRejectedValue(new Error('Für dieses Datum gibt es bereits einen Arbeitszeitstand.'));
  showDetail(onSaved);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Arbeitszeit ab 01.03.2025 · 36 Std./Woche · 1,00 VZÄ bearbeiten',
    }),
  );
  fireEvent.change(screen.getByLabelText('Gültig ab'), { target: { value: '2024-09-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('bereits');
  expect(screen.getByLabelText('Gültig ab')).toHaveValue('2024-09-01');
  expect(onSaved).not.toHaveBeenCalled();
});

it('adds a separate entry and derives the linked FTE from hours', async () => {
  vi.mocked(api.workingTimes.save).mockResolvedValue(undefined);
  const NewEntry = () => {
    const [state, setState] = useState<EventModalState>({ open: true, type: 'period', eventDate: '2026-01-01', title: '', details: '' });
    return <EventModal state={state} employee={employee} baseHours={36}
      onWorkingTimeSaved={async () => undefined} qualifications={[]}
      periodForm={{ startDate: '2026-01-01', endDate: '', qualification: 'Pflegekraft' }}
      onStateChange={next => setState(prev => ({ ...prev, ...next }))} onPeriodFormChange={vi.fn()}
      onClose={vi.fn()} onSaveEvent={vi.fn()} onSavePeriod={vi.fn()}
      onDeleteEvent={vi.fn()} onDeletePeriod={vi.fn()} />;
  };
  render(<NewEntry />);
  fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'working-time' } });
  expect(screen.getByRole('dialog', { name: 'Neuer Eintrag' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Qualifikation')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'VZÄ aus Wochenstunden berechnen' }));
  fireEvent.change(screen.getByLabelText('Wochenstunden'), { target: { value: '18' } });
  fireEvent.change(screen.getByLabelText('Gültig ab'), { target: { value: '2024-09-01' } });
  expect(screen.getByLabelText('VZÄ')).toHaveValue(0.5);
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(api.workingTimes.save).toHaveBeenCalledWith({
    id: undefined, employeeId: 7, effectiveFrom: '2024-09-01', weeklyHours: 18, fte: 0.5,
  }));
});

it('keeps historical qualification corrections editable', () => {
  const onPeriodFormChange = vi.fn();
  render(
    <EventModal
      state={{ open: true, type: 'period', eventDate: '2026-01-01', title: '', details: '' }}
      employee={employee}
      baseHours={36}
      onWorkingTimeSaved={async () => undefined}
      qualifications={[{ id: 1, name: 'Pflegekraft' }, { id: 2, name: 'Pflegefachkraft' }]}
      periodForm={{
        startDate: '2024-09-01',
        endDate: '2025-12-31',
        qualification: 'Pflegekraft',
        periodId: 9,
      }}
      onStateChange={vi.fn()}
      onPeriodFormChange={onPeriodFormChange}
      onClose={vi.fn()}
      onSaveEvent={vi.fn()}
      onSavePeriod={vi.fn()}
      onDeleteEvent={vi.fn()}
      onDeletePeriod={vi.fn()}
    />,
  );

  const qualification = screen.getByLabelText('Qualifikation');
  expect(qualification).not.toBeDisabled();
  fireEvent.change(qualification, { target: { value: 'Pflegefachkraft' } });
  expect(onPeriodFormChange).toHaveBeenCalledWith(expect.objectContaining({
    periodId: 9,
    qualification: 'Pflegefachkraft',
  }));
});

it('reicht die Zeile als echten Button aus, damit die Tastaturbedienung greift', () => {
  showDetail(async () => undefined);
  const row = screen.getByRole('button', {
    name: 'Arbeitszeit ab 01.03.2025 · 36 Std./Woche · 1,00 VZÄ bearbeiten',
  });

  expect(row.tagName).toBe('BUTTON');
  expect(row).toHaveAttribute('type', 'button');
  row.focus();
  expect(row).toHaveFocus();
});
