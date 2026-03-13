import { shell } from 'electron';
import type { BrowserWindow } from 'electron';

type ExternalOpener = (url: string) => Promise<void>;

const isHttpUrl = (protocol: string): boolean => protocol === 'http:' || protocol === 'https:';

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const shouldOpenExternally = (targetUrl: string, appUrl: string): boolean => {
  const target = parseUrl(targetUrl);
  if (!target) return false;

  if (target.protocol === 'mailto:') {
    return true;
  }

  if (!isHttpUrl(target.protocol)) {
    return false;
  }

  const app = parseUrl(appUrl);
  if (!app) {
    return true;
  }

  if (isHttpUrl(app.protocol)) {
    return target.origin !== app.origin;
  }

  return true;
};

export const configureExternalLinkHandling = (
  window: Pick<BrowserWindow, 'webContents'>,
  appUrl: string,
  openExternal: ExternalOpener = (url) => shell.openExternal(url),
): void => {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url, appUrl)) {
      void openExternal(url);
      return { action: 'deny' };
    }

    return { action: 'allow' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!shouldOpenExternally(url, appUrl)) {
      return;
    }

    event.preventDefault();
    void openExternal(url);
  });
};
