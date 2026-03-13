import path from 'path';
import { app } from 'electron';

const DEV_USER_DATA_PREFIX = 'dev-';

const getDefaultUserDataPath = (): string => app.getPath('appData');

const getDevUserDataPath = (): string => {
  const appDataPath = getDefaultUserDataPath();
  const folderName = `${DEV_USER_DATA_PREFIX}${app.getName()}`;
  return path.join(appDataPath, folderName);
};

export const configureUserDataPath = (): void => {
  if (app.isPackaged) {
    return;
  }

  const devUserDataPath = getDevUserDataPath();
  if (app.getPath('userData') !== devUserDataPath) {
    app.setPath('userData', devUserDataPath);
  }
};

export const getDataDir = (): string => path.join(app.getPath('userData'), 'data');

export const getConfigPath = (): string => path.join(getDataDir(), 'config.json');

export const getEncryptedDbPath = (): string => path.join(getDataDir(), 'employee.db.enc');

export const getWorkingDbPath = (): string => path.join(getDataDir(), 'employee.db');
