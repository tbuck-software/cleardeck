import { ipcMain } from 'electron';
import {
  connectServer,
  getServerConnection,
  refreshServer,
  useLocalConnection,
  withConnectionLock,
  resolveServerConflict,
  setServerEditing,
} from '../serverConnection';
import { isUnlocked, setUnlocked } from './auth';
import type { ConnectServerInput } from '../../shared/serverConnection';

export function registerServerHandlers(): void {
  ipcMain.handle('server:state', () => getServerConnection());
  ipcMain.handle('server:connect', (_event, input: ConnectServerInput) =>
    withConnectionLock(() => {
      if (
        !input ||
        typeof input.url !== 'string' ||
        typeof input.username !== 'string' ||
        typeof input.password !== 'string' ||
        typeof input.initialize !== 'boolean' ||
        (input.offline !== undefined && typeof input.offline !== 'boolean')
      )
        throw new Error('Ungültige Serverkonfiguration.');
      return connectServer(input, isUnlocked());
    }),
  );
  ipcMain.handle('server:local', () =>
    withConnectionLock(async () => {
      await useLocalConnection();
      setUnlocked(false);
    }),
  );
  ipcMain.handle('server:refresh', () => refreshServer());
  ipcMain.handle('server:resolve', (_event, choice) => resolveServerConflict(choice));
  ipcMain.handle('server:editing', (_event, editing) => {
    if (typeof editing !== 'boolean') throw new Error('Ungültiger Bearbeitungszustand.');
    setServerEditing(editing);
  });
}
