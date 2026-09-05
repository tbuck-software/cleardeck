/// <reference types="vitest/globals" />

import { renderHook, waitFor } from '@testing-library/react';
import useAuth from '../useAuth';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { auth: { getState: vi.fn() } } }));

const createHook = () => {
  const params = {
    year: 2026, handleError: vi.fn(), setLoading: vi.fn(), refreshDataset: vi.fn(),
    openRecoveryKey: vi.fn(), setForm: vi.fn(), setQualifications: vi.fn(),
    setQualificationEdits: vi.fn(), setCompetencyDefinitions: vi.fn(),
    setCompetencyEdits: vi.fn(), setInstructionDefinitions: vi.fn(), hydrateBaseHours: vi.fn(),
  };
  return renderHook(() => useAuth(params));
};

describe('authentication bootstrap', () => {
  it('waits for the main process before offering setup', async () => {
    vi.mocked(api.auth.getState).mockResolvedValue({ configured: false, unlocked: false, storageMode: 'encrypted' });
    const { result } = createHook();
    expect(result.current.authLoading).toBe(true);
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.appReady.startupError).toBeUndefined();
  });

  it('keeps IPC failures as a startup error instead of leaving the initial setup state', async () => {
    vi.mocked(api.auth.getState).mockRejectedValue(new Error('IPC unavailable'));
    const { result } = createHook();
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.appReady.startupError).toBe('IPC unavailable');
    expect(result.current.appReady.unlocked).toBe(false);
  });
});
