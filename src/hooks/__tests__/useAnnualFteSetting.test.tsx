import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import useSettingsDb from '../useSettingsDb';
import SettingsGeneral from '../../components/pages/settings/SettingsGeneral';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: {
  settings: { setAnnualFteMethod: vi.fn() },
  updates: { onStatus: vi.fn(), check: vi.fn().mockResolvedValue(undefined) },
  app: { getInfo: vi.fn().mockResolvedValue(null) },
  auth: { getState: vi.fn().mockResolvedValue({ storageMode: 'plain' }) },
} }));
const params = () => ({ year: 2025, refreshDataset: vi.fn().mockResolvedValue(undefined),
  onError: vi.fn(), onToast: vi.fn(), confirmAction: vi.fn(), onAfterDrop: vi.fn(),
  onAfterReset: vi.fn(), onAuthStateChange: vi.fn(), onOpenRecoveryKey: vi.fn(),
});
beforeEach(() => vi.clearAllMocks());

it('persists the method and refreshes the selected year before reporting success', async () => {
  const options = params();
  let resolveSave: (value: 'year-average') => void;
  vi.mocked(api.settings.setAnnualFteMethod).mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
  const { result } = renderHook(() => useSettingsDb(options));
  let saving: Promise<void>;
  act(() => { saving = result.current.actions.handleSaveAnnualFteMethod('year-average'); });
  expect(result.current.state.annualFteSaving).toBe(true);
  expect(options.refreshDataset).not.toHaveBeenCalled();
  await act(async () => { resolveSave!('year-average'); await saving; });
  expect(options.refreshDataset).toHaveBeenCalledWith(2025, true);
  expect(options.onToast).toHaveBeenCalledWith('Berechnung der Jahres-VZÄ gespeichert.');
  expect(result.current.state.annualFteSaving).toBe(false);
});

it.each(['save', 'refresh'])('shows errors and permits retry after %s failure', async (stage) => {
  const options = params();
  const error = new Error('Verbindung unterbrochen');
  vi.mocked(api.settings.setAnnualFteMethod).mockResolvedValue('year-average');
  if (stage === 'save') vi.mocked(api.settings.setAnnualFteMethod).mockRejectedValue(error);
  else options.refreshDataset.mockRejectedValue(error);
  const { result } = renderHook(() => useSettingsDb(options));
  await act(() => result.current.actions.handleSaveAnnualFteMethod('year-average'));
  expect(options.onError).toHaveBeenCalledWith(error);
  expect(options.onToast).not.toHaveBeenCalled();
  expect(result.current.state.annualFteSaving).toBe(false);
});

it('offers both annual methods in general settings and disables changes while saving', () => {
  const onChange = vi.fn();
  const props = { baseHoursInput: '36', careSettings: { visitIntervalDays: 90, instructionReminderDays: 30 },
    onBaseHoursInputChange: vi.fn(), onSaveBaseHours: vi.fn(), onCareSettingsChange: vi.fn(),
    annualFteMethod: 'month-end-average' as const, annualFteSaving: false, onAnnualFteMethodChange: onChange };
  const { rerender } = render(<SettingsGeneral {...props} />);
  const select = screen.getByLabelText('Berechnung der Jahres-VZÄ');
  expect(select).toHaveValue('month-end-average');
  fireEvent.change(select, { target: { value: 'year-average' } });
  expect(onChange).toHaveBeenCalledWith('year-average');
  rerender(<SettingsGeneral {...props} annualFteMethod="year-average" annualFteSaving />);
  expect(select).toHaveValue('year-average');
  expect(select).toBeDisabled();
  expect(screen.getByText(/nach ihren gültigen Kalendertagen/)).toBeInTheDocument();
});
