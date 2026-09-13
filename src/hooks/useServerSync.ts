import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../services/api';
import type { ServerConnection } from '../shared/serverConnection';

export const SERVER_SYNC_POLL_MS = 2_000;

export type UseServerSyncOptions = {
  /** The local database is unlocked and may be read by the renderer. */
  enabled: boolean;
  /** Server mode is kept separate from `connected`: an offline copy is usable too. */
  serverMode: boolean;
  /** A modal, page form, or other unsaved editor is currently open. */
  editing: boolean;
  /** Reloads renderer read models from the current local workspace. */
  onRemoteChange: () => Promise<void> | void;
  /** Poll failures are intentionally silent; this is used for actionable IPC errors. */
  onError?: (error: unknown) => void;
  pollIntervalMs?: number;
};

export type ServerSyncState = {
  connection: ServerConnection | null;
  dataVersion: number | null;
  pendingVersion: number | null;
  refreshing: boolean;
};

const isDataVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isEditableElement = (value: Element | null): value is HTMLElement => {
  if (!(value instanceof HTMLElement)) return false;
  if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement) {
    return !value.disabled && !value.readOnly;
  }
  if (value instanceof HTMLSelectElement) return !value.disabled;
  return value.isContentEditable;
};

/**
 * Keeps the renderer's read models in step with the local workspace while the
 * main process handles network synchronization. The main process is told
 * about editing before the next paint, and a changed version is held until
 * the editor is closed again.
 */
const useServerSync = ({
  enabled,
  serverMode,
  editing,
  onRemoteChange,
  onError,
  pollIntervalMs = SERVER_SYNC_POLL_MS,
}: UseServerSyncOptions): ServerSyncState => {
  const active = enabled && serverMode;
  const [formActive, setFormActive] = useState(false);
  const [dialogActive, setDialogActive] = useState(false);
  const [connection, setConnection] = useState<ServerConnection | null>(null);
  const [dataVersion, setDataVersion] = useState<number | null>(null);
  const [pendingVersion, setPendingVersion] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const activeRef = useRef(active);
  const baseEditingRef = useRef(editing || formActive);
  const dialogActiveRef = useRef(false);
  const editingRef = useRef(editing || formActive || dialogActive);
  const connectionRef = useRef<ServerConnection | null>(connection);
  const latestVersionRef = useRef<number | null>(null);
  const pendingVersionRef = useRef<number | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const editingRequestRef = useRef<Promise<void>>(Promise.resolve());
  const activeBeforeRenderRef = useRef(false);
  const onRemoteChangeRef = useRef(onRemoteChange);
  const onErrorRef = useRef(onError);

  activeRef.current = active;
  baseEditingRef.current = editing || formActive;
  dialogActiveRef.current = dialogActive;
  editingRef.current = editing || formActive || dialogActive;
  connectionRef.current = connection;
  onRemoteChangeRef.current = onRemoteChange;
  onErrorRef.current = onError;

  const setPending = useCallback((version: number | null) => {
    pendingVersionRef.current = version;
    setPendingVersion(version);
  }, []);

  const requestEditing = useCallback((value: boolean, reportError = true): Promise<void> => {
    // IPC requests are ordered here as well as in the main process. A quick
    // open/close cannot leave the server with the earlier value.
    const previous = editingRequestRef.current.catch((): void => undefined);
    const request = previous.then(() => api.connection.setEditing(value));
    editingRequestRef.current = request.catch((error) => {
      if (reportError) onErrorRef.current?.(error);
    });
    return request;
  }, []);

  const updateDialogState = useCallback(() => {
    const next = document.querySelector('[role="dialog"]') !== null;
    if (next === dialogActiveRef.current) return;
    dialogActiveRef.current = next;
    setDialogActive(next);
    // React's layout effect below will send the same value after the state
    // update. Sending here as well closes the small gap between a nested
    // dialog being mounted and that render completing.
    if (activeRef.current) {
      void requestEditing(next || baseEditingRef.current).catch((): void => undefined);
    }
  }, [requestEditing]);

  const refreshPending = useCallback(async (): Promise<void> => {
    if (!activeRef.current || editingRef.current || connectionRef.current?.connected === false) {
      return;
    }
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const version = pendingVersionRef.current;
    if (version === null) return;
    setPending(null);

    const refresh = (async () => {
      // In particular, wait for the false signal when an editor has just
      // closed. This keeps the main-process pull guard ahead of this read.
      await editingRequestRef.current.catch((): void => undefined);
      if (!activeRef.current || editingRef.current || connectionRef.current?.connected === false) {
        setPending(Math.max(pendingVersionRef.current ?? version, version));
        return;
      }
      setRefreshing(true);
      try {
        await onRemoteChangeRef.current();
      } catch (error) {
        setPending(Math.max(pendingVersionRef.current ?? version, version));
        onErrorRef.current?.(error);
        return;
      } finally {
        setRefreshing(false);
      }

      // A newer poll may have arrived while the read models were reloaded.
      // Leave that newer version queued for the next pass.
      if (!activeRef.current || editingRef.current) {
        setPending(Math.max(pendingVersionRef.current ?? version, version));
      }
    })();
    refreshPromiseRef.current = refresh.finally(() => {
      refreshPromiseRef.current = null;
    });
    return refreshPromiseRef.current;
  }, [setPending]);

  // Form controls which are owned by nested pages (for example connection
  // settings) cannot all be represented by App's modal state. Focus protects
  // them immediately, while the corresponding page/modal state keeps the
  // protection active across blur while its draft is mounted.
  useEffect(() => {
    if (!active) {
      if (formActive) setFormActive(false);
      return;
    }

    const markEditing = (event: Event) => {
      if (isEditableElement(event.target instanceof Element ? event.target : null)) {
        setFormActive(true);
      }
    };
    const clearAfterFocusChange = () => {
      window.setTimeout(() => {
        if (!isEditableElement(document.activeElement)) setFormActive(false);
      }, 0);
    };

    document.addEventListener('focusin', markEditing, true);
    document.addEventListener('input', markEditing, true);
    document.addEventListener('focusout', clearAfterFocusChange, true);
    return () => {
      document.removeEventListener('focusin', markEditing, true);
      document.removeEventListener('input', markEditing, true);
      document.removeEventListener('focusout', clearAfterFocusChange, true);
    };
  }, [active, formActive]);

  // Settings pages own some dialogs below the App state tree. Observe the
  // semantic dialog boundary so opening one protects its draft immediately,
  // while an idle Connections page remains eligible for automatic pulls.
  useEffect(() => {
    if (!active) {
      dialogActiveRef.current = false;
      setDialogActive(false);
      return;
    }
    updateDialogState();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(updateDialogState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, updateDialogState]);

  // `useLayoutEffect` is deliberate: opening a modal must reach main before
  // the browser paints the editor, rather than waiting for the polling tick.
  useLayoutEffect(() => {
    if (!active) {
      if (activeBeforeRenderRef.current) {
        void requestEditing(false, false).catch((): void => undefined);
      }
      activeBeforeRenderRef.current = false;
      latestVersionRef.current = null;
      connectionRef.current = null;
      setConnection(null);
      setDataVersion(null);
      setPending(null);
      dialogActiveRef.current = false;
      setDialogActive(false);
      return;
    }

    activeBeforeRenderRef.current = true;
    const request = requestEditing(editingRef.current);
    if (!editingRef.current) {
      void request.then(() => refreshPending()).catch((): void => undefined);
    } else {
      void request.catch((): void => undefined);
    }
  }, [active, editing || formActive || dialogActive, refreshPending, requestEditing, setPending]);

  // Release the guard if the app shell is unmounted while a server editor is
  // open (for example during a workspace switch).
  useEffect(
    () => () => {
      if (activeRef.current) {
        void requestEditing(false, false).catch((): void => undefined);
      }
    },
    [requestEditing],
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const next = await api.connection.get();
        if (cancelled) return;
        connectionRef.current = next;
        setConnection(next);

        if (next.mode === 'server' && isDataVersion(next.dataVersion)) {
          const previous = latestVersionRef.current;
          latestVersionRef.current = next.dataVersion;
          setDataVersion(next.dataVersion);
          if (previous === null || previous !== next.dataVersion) {
            setPending(Math.max(pendingVersionRef.current ?? next.dataVersion, next.dataVersion));
          }
        }
        await refreshPending();
      } catch {
        // Offline is a normal server-mode state. The main process preserves
        // local writes and the next poll will retry without noisy toasts.
      } finally {
        if (!cancelled) {
          timer = window.setTimeout((): void => void poll(), pollIntervalMs);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [active, pollIntervalMs, refreshPending, setPending]);

  return { connection, dataVersion, pendingVersion, refreshing };
};

export default useServerSync;
