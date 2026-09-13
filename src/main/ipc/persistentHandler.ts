import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { isServerMode, runServerOperation, withCurrentConnection } from '../serverConnection';
import {
  flushDatabase,
  getDb,
  getStorageMode,
  isDbOpen,
  restoreMemorySnapshot,
} from '../database/connection';

/** Await persistence before acknowledging any data operation to the renderer. */
export const handleData = (
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => any,
): void => {
  ipcMain.handle(channel, (event, ...args) => withCurrentConnection(async () => {
    if (isServerMode()) return runServerOperation(channel, () => listener(event, ...args));
    const before = isDbOpen() && getStorageMode() === 'encrypted' ? getDb().serialize() : null;
    try {
      const result = await listener(event, ...args);
      flushDatabase();
      return result;
    } catch (error) {
      if (before) restoreMemorySnapshot(before);
      throw error;
    }
  }));
};
