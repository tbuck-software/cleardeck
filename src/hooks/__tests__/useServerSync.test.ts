/// <reference types="vitest/globals" />

import { act, renderHook } from '@testing-library/react';
import useServerSync from '../useServerSync';
import api from '../../services/api';
import type { ServerConnection } from '../../shared/serverConnection';

const getConnectionMock = vi.fn<() => Promise<ServerConnection>>();
const setEditingMock = vi.fn<(editing: boolean) => Promise<void>>();

vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    connection: {
      get: () => getConnectionMock(),
      setEditing: (...args: unknown[]) => setEditingMock(...(args as [boolean])),
    },
  },
}));

const state = (dataVersion: number): ServerConnection => ({
  mode: 'server',
  connected: true,
  dataVersion,
});

describe('useServerSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getConnectionMock.mockResolvedValue(state(1));
    setEditingMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it('defers a remote refresh while a dirty editor is open and resumes on close', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    getConnectionMock.mockResolvedValueOnce(state(1)).mockResolvedValue(state(2));

    const { rerender, unmount } = renderHook(
      ({ editing }: { editing: boolean }) =>
        useServerSync({
          enabled: true,
          serverMode: true,
          editing,
          onRemoteChange: refresh,
          pollIntervalMs: 100,
        }),
      { initialProps: { editing: true } },
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(refresh).not.toHaveBeenCalled();

    rerender({ editing: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setEditingMock).toHaveBeenCalledWith(true);
    expect(setEditingMock).toHaveBeenCalledWith(false);
    unmount();
  });

  it('protects nested inputs immediately and releases the protection after blur', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useServerSync({
        enabled: true,
        serverMode: true,
        editing: false,
        onRemoteChange: refresh,
        pollIntervalMs: 10_000,
      }),
    );
    const input = document.createElement('input');
    document.body.append(input);

    await act(async () => {
      input.focus();
      await Promise.resolve();
    });
    expect(setEditingMock).toHaveBeenLastCalledWith(true);

    await act(async () => {
      input.blur();
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    expect(setEditingMock).toHaveBeenLastCalledWith(false);
    unmount();
  });

  it('protects dialogs mounted outside the renderer modal state', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useServerSync({
        enabled: true,
        serverMode: true,
        editing: false,
        onRemoteChange: refresh,
        pollIntervalMs: 10_000,
      }),
    );
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');

    await act(async () => {
      document.body.append(dialog);
      await Promise.resolve();
    });
    expect(setEditingMock).toHaveBeenLastCalledWith(true);

    await act(async () => {
      dialog.remove();
      await Promise.resolve();
    });
    expect(setEditingMock).toHaveBeenLastCalledWith(false);
    unmount();
  });

  it('refreshes once from the first server version after cached hydration', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    getConnectionMock.mockResolvedValue(state(7));
    const { unmount } = renderHook(() =>
      useServerSync({
        enabled: true,
        serverMode: true,
        editing: false,
        onRemoteChange: refresh,
        pollIntervalMs: 100,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not poll while the local workspace is locked or local-only', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ enabled, serverMode }: { enabled: boolean; serverMode: boolean }) =>
        useServerSync({ enabled, serverMode, editing: false, onRemoteChange: refresh }),
      { initialProps: { enabled: false, serverMode: true } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(getConnectionMock).not.toHaveBeenCalled();

    rerender({ enabled: true, serverMode: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(getConnectionMock).not.toHaveBeenCalled();
  });
});

// Keep the module import visible to TypeScript's isolated test mocks.
void api;
