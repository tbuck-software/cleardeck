import path from 'path';
import fs from 'fs';
import { productName } from '../../package.json';
import { app } from 'electron';

const DEV_USER_DATA_PREFIX = 'dev-';

const getDefaultUserDataPath = (): string => app.getPath('appData');

const getDevUserDataPath = (): string => {
  const appDataPath = getDefaultUserDataPath();
  const scenarioSuffix = process.env.CLEARDECK_DEV_SCENARIO === 'updates' ? '-updates' : '';
  const folderName = `${DEV_USER_DATA_PREFIX}${productName}${scenarioSuffix}`;
  return path.join(appDataPath, folderName);
};

export const configureUserDataPath = (): void => {
  if (app.isPackaged) {
    return;
  }

  app.setName(`${productName} Dev`);
  if (process.platform === 'win32') app.setAppUserModelId('com.electron.cleardeck.dev');
  const devUserDataPath = getDevUserDataPath();
  fs.mkdirSync(devUserDataPath, { recursive: true });
  app.setPath('sessionData', devUserDataPath);
  app.setAppLogsPath(path.join(devUserDataPath, 'logs'));
  if (app.getPath('userData') !== devUserDataPath) {
    app.setPath('userData', devUserDataPath);
  }
};

export const getDataDir = (): string => path.join(app.getPath('userData'), 'data');

export const getConfigPath = (): string => path.join(getDataDir(), 'config.json');

export const getEncryptedDbPath = (): string => path.join(getDataDir(), 'employee.db.enc');

export const getWorkingDbPath = (): string => path.join(getDataDir(), 'employee.db');
