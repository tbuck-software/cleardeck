/// <reference types="vitest/globals" />

import { configureExternalLinkHandling, shouldOpenExternally } from '../externalLinks';

describe('shouldOpenExternally', () => {
  it('erkennt externe http(s)-links gegenueber der lokalen app-origin', () => {
    expect(shouldOpenExternally('https://github.com/tbuck-software/cleardeck', 'http://localhost:3000')).toBe(true);
    expect(shouldOpenExternally('http://localhost:3000/settings', 'http://localhost:3000')).toBe(false);
  });

  it('behandelt mailto immer als extern und file-basierte apps korrekt', () => {
    expect(shouldOpenExternally('mailto:mail@tbuck.de', 'file:///Applications/ClearDeck.app/index.html')).toBe(true);
    expect(shouldOpenExternally('https://tbuck.de', 'file:///Applications/ClearDeck.app/index.html')).toBe(true);
    expect(shouldOpenExternally('file:///tmp/other.html', 'file:///Applications/ClearDeck.app/index.html')).toBe(false);
  });
});

describe('configureExternalLinkHandling', () => {
  it('leitet externe links aus neuen fenstern an den systembrowser weiter', () => {
    const openExternal = vi.fn<(_: string) => Promise<void>>().mockResolvedValue();
    let openHandler: ((details: { url: string }) => { action: 'allow' | 'deny' }) | undefined;

    const window = {
      webContents: {
        setWindowOpenHandler: vi.fn((handler) => {
          openHandler = handler;
        }),
        on: vi.fn(),
      },
    };

    configureExternalLinkHandling(window as never, 'http://localhost:3000', openExternal);

    expect(openHandler?.({ url: 'https://github.com/tbuck-software/cleardeck' })).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith('https://github.com/tbuck-software/cleardeck');
  });

  it('blockiert same-window-navigation zu externen links und laesst interne in ruhe', () => {
    const openExternal = vi.fn<(_: string) => Promise<void>>().mockResolvedValue();
    const listeners = new Map<string, (event: { preventDefault: () => void }, url: string) => void>();
    const preventDefault = vi.fn();

    const window = {
      webContents: {
        setWindowOpenHandler: vi.fn(),
        on: vi.fn((eventName, listener) => {
          listeners.set(eventName, listener);
        }),
      },
    };

    configureExternalLinkHandling(window as never, 'http://localhost:3000', openExternal);

    listeners.get('will-navigate')?.({ preventDefault }, 'https://github.com/tbuck-software/cleardeck');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://github.com/tbuck-software/cleardeck');

    listeners.get('will-navigate')?.({ preventDefault }, 'http://localhost:3000/settings');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledTimes(1);
  });
});
