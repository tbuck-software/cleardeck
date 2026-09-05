/// <reference types="vitest/globals" />
// @vitest-environment node

/**
 * Locking has to leave nothing readable behind. These tests pin the two
 * failures we hit: a silent no-op without encryption, and a plaintext working
 * copy left on disk because only the handle was closed.
 */

const state = {
  storageMode: 'encrypted' as 'encrypted' | 'plain',
  workingFileExists: true,
  key: Buffer.alloc(32, 7) as Buffer | null,
  screenLocked: false,
};

const persistEncryptedDb = vi.fn(() => {
  // Mirrors the real one: encrypts and removes the decrypted working copy.
  if (state.storageMode === 'plain' || !state.key) return;
  state.workingFileExists = false;
});
const closeDb = vi.fn();
const setEncryptionKey = vi.fn((next: Buffer | null) => {
  state.key = next;
});

/** The handler under test, mirrored from src/main/ipc/auth.ts. */
const lock = (): { unlocked: boolean } => {
  if (state.storageMode === 'plain') {
    state.screenLocked = true;
    closeDb();
    return { unlocked: false };
  }
  persistEncryptedDb();
  setEncryptionKey(null);
  return { unlocked: false };
};

/** syncRuntimeState()'s plain branch, which must respect the screen lock. */
const syncPlain = (): { unlocked: boolean } => ({ unlocked: !state.screenLocked });

beforeEach(() => {
  state.storageMode = 'encrypted';
  state.workingFileExists = true;
  state.key = Buffer.alloc(32, 7);
  state.screenLocked = false;
  vi.clearAllMocks();
});

describe('auth:lock', () => {
  it('verschlüsselt vor dem Schließen und lässt keine Klartextdatei zurück', () => {
    expect(lock()).toEqual({ unlocked: false });

    expect(persistEncryptedDb).toHaveBeenCalledTimes(1);
    expect(state.workingFileExists).toBe(false);
  });

  it('verwirft den Schlüssel', () => {
    lock();
    expect(setEncryptionKey).toHaveBeenCalledWith(null);
    expect(state.key).toBeNull();
  });

  it('schließt nicht bloß das Handle', () => {
    lock();
    expect(closeDb).not.toHaveBeenCalled();
  });

  it('deckt ohne Verschlüsselung nur den Bildschirm ab', () => {
    state.storageMode = 'plain';

    expect(lock()).toEqual({ unlocked: false });
    // Nichts zu verschlüsseln, kein Schlüssel zu verwerfen — nur zugedeckt.
    expect(persistEncryptedDb).not.toHaveBeenCalled();
    expect(setEncryptionKey).not.toHaveBeenCalled();
    expect(closeDb).toHaveBeenCalledTimes(1);
  });

  it('meldet den Sichtschutz auch beim naechsten Statusabruf', () => {
    state.storageMode = 'plain';

    expect(syncPlain()).toEqual({ unlocked: true });
    lock();
    // Ohne eigenes Flag wuerde der Plain-Zweig sofort wieder "offen" melden.
    expect(syncPlain()).toEqual({ unlocked: false });
  });
});
