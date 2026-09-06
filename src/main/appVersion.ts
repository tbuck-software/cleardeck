import { app } from 'electron';
import { version } from '../../package.json';

/**
 * Unpackaged, `app.getVersion()` reports Electron's version because the webpack
 * bundle has no package.json of its own — so read ClearDeck's own version.
 */
export const appVersion = (): string => (app.isPackaged ? app.getVersion() : version);
