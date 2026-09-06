import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmployeeCompetencies from '../EmployeeCompetencies';
import api from '../../../services/api';
import type { EmployeeCompetency } from '../../../shared/types';
vi.mock('../../../services/api', () => ({ default: { competencies: { bulkChange: vi.fn() } } }));
const entries: EmployeeCompetency[] = [
  {
    id: 1,
    competencyDefinitionId: 11,
    competencyName: 'Injektion',
    stageScheme: 'legacy',
    level: 2,
  },
  {
    id: 2,
    competencyDefinitionId: 12,
    competencyName: 'Hygiene',
    stageScheme: 'practice-v1',
    level: 3,
  },
  {
    id: 3,
    competencyDefinitionId: 13,
    competencyName: 'Verbände',
    stageScheme: 'practice-v1',
    level: 4,
  },
];
const onSaved = vi.fn();
const onSelect = vi.fn();
const show = () =>
  render(
    <EmployeeCompetencies
      employeeId={7}
      employeeName="Testperson"
      competencies={entries}
      availableCompetencyCount={0}
      suggestedCompetencyCount={0}
      onAddCompetency={vi.fn()}
      onOpenSuggestedCompetencies={vi.fn()}
      onSaved={onSaved}
      onSelectCompetency={onSelect}
    />,
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.competencies.bulkChange).mockResolvedValue(entries);
});

it('selects subsets independently from row editing and displays a mixed select-all checkbox', () => {
  show();
  fireEvent.click(screen.getByLabelText('Hygiene auswählen'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('1 ausgewählt');
  expect(screen.getByLabelText('Alle 3 Kompetenzen auswählen')).toBePartiallyChecked();
  fireEvent.click(screen.getByText('Hygiene', { selector: 'div' }));
  expect(onSelect).toHaveBeenCalledWith(entries[1]);
  expect(screen.getByLabelText('Hygiene auswählen')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Alle 3 Kompetenzen auswählen'));
  expect(screen.getByRole('status')).toHaveTextContent('3 ausgewählt');
  fireEvent.click(screen.getByLabelText('Injektion auswählen'));
  expect(screen.getByRole('status')).toHaveTextContent('2 ausgewählt');
});

it('saves exactly the selected subset with an explicitly chosen level', async () => {
  show();
  fireEvent.click(screen.getByLabelText('Hygiene auswählen'));
  fireEvent.click(screen.getByLabelText('Verbände auswählen'));
  fireEvent.click(screen.getByRole('button', { name: 'Stufe ändern' }));
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Stufe'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(entries));
  expect(api.competencies.bulkChange).toHaveBeenCalledWith({
    employeeId: 7,
    changes: [
      { competencyDefinitionId: 12, stageScheme: 'practice-v1', level: 5 },
      { competencyDefinitionId: 13, stageScheme: 'practice-v1', level: 5 },
    ],
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Alle 3 Kompetenzen auswählen')).not.toBeChecked();
});

it('lets one model stay unchanged in a mixed selection and sends completion details', async () => {
  show();
  fireEvent.click(screen.getByLabelText('Alle 3 Kompetenzen auswählen'));
  fireEvent.click(screen.getByRole('button', { name: 'Stufe ändern' }));
  expect(screen.getByLabelText('Altmodell · 1 Kompetenz')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Einarbeitung · 2 Kompetenzen'), {
    target: { value: '6' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Bestätigungsdatum');
  expect(api.competencies.bulkChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Bestätigt am'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('Bestätigt durch'), { target: { value: 'Test Leitung' } });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(api.competencies.bulkChange).toHaveBeenCalledWith({
    employeeId: 7,
    changes: [12, 13].map((competencyDefinitionId) => ({
      competencyDefinitionId,
      stageScheme: 'practice-v1',
      level: 6,
    })),
    completion: { approvedAt: '2026-01-01', approvedBy: 'Test Leitung' },
  });
});

it('keeps selection and draft after a failed save', async () => {
  vi.mocked(api.competencies.bulkChange).mockRejectedValue(new Error('Speicherfehler'));
  show();
  fireEvent.click(screen.getByLabelText('Injektion auswählen'));
  fireEvent.click(screen.getByRole('button', { name: 'Stufe ändern' }));
  fireEvent.change(screen.getByLabelText('Stufe'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Speicherfehler');
  expect(screen.getByLabelText('Stufe')).toHaveValue('5');
  expect(screen.getByLabelText('Injektion auswählen')).toBeChecked();
  expect(onSaved).not.toHaveBeenCalled();
});

it('protects the draft on Escape and restores focus after discarding', () => {
  show();
  fireEvent.click(screen.getByLabelText('Injektion auswählen'));
  const trigger = screen.getByRole('button', { name: 'Stufe ändern' });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.change(screen.getByLabelText('Stufe'), { target: { value: '5' } });
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Änderungen verwerfen?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
  expect(screen.getByLabelText('Stufe')).toHaveValue('5');
  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(api.competencies.bulkChange).not.toHaveBeenCalled();
});

it('keeps Tab focus inside the modal', () => {
  show();
  fireEvent.click(screen.getByLabelText('Injektion auswählen'));
  fireEvent.click(screen.getByRole('button', { name: 'Stufe ändern' }));
  fireEvent.change(screen.getByLabelText('Stufe'), { target: { value: '5' } });
  screen.getByRole('button', { name: 'Speichern' }).focus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus();
});
