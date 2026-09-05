import { app } from 'electron';
import { readConfig, writeConfig } from './crypto';
import { ensureDataDir, openDatabase, setStorageMode } from './database/connection';

// Explicit scenario starts use dev-ClearDeck-updates, never the normal Dev or
// production profile. Existing configuration is preserved, including encryption.
export const prepareDevelopmentScenario = (): void => {
  if (app.isPackaged || process.env.CLEARDECK_DEV_SCENARIO !== 'updates') return;
  if (readConfig()) return;
  ensureDataDir();
  writeConfig({ storageMode: 'plain', configVersion: 3 });
  setStorageMode('plain');
  openDatabase(); // The normal fresh-database seed contains synthetic demo data.
};
