import { ipcMain } from 'electron';
import {
  connectServer, getServerConnection, refreshServer, useLocalConnection, withConnectionLock,
} from '../serverConnection';
import { isUnlocked, setUnlocked } from './auth';
import type { ConnectServerInput } from '../../shared/serverConnection';

export function registerServerHandlers(): void {
  ipcMain.handle('server:state', () => getServerConnection());
  ipcMain.handle('server:connect', (_event, input: ConnectServerInput) => withConnectionLock(() => {
    if (!input || typeof input.url !== 'string' || typeof input.username !== 'string' ||
      typeof input.password !== 'string' || typeof input.dataKey !== 'string' || typeof input.initialize !== 'boolean') {
      throw new Error('Ungültige Serverkonfiguration.');
    }
    return connectServer(input, isUnlocked());
  }));
  ipcMain.handle('server:local', () => withConnectionLock(async () => {
    await useLocalConnection();
    setUnlocked(false);
  }));
  ipcMain.handle('server:refresh', () => withConnectionLock(refreshServer));
}
