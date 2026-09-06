import { ipcMain, type IpcMainInvokeEvent } from 'electron';
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
  ipcMain.handle(channel, (event, ...args) => {
    const before = isDbOpen() && getStorageMode() === 'encrypted' ? getDb().serialize() : null;
    let result;
    try {
      result = listener(event, ...args);
    } catch (error) {
      if (before) restoreMemorySnapshot(before);
      throw error;
    }
    if (result && typeof result.then === 'function') {
      return result.then((value: unknown) => {
        flushDatabase();
        return value;
      });
    }
    try {
      flushDatabase();
    } catch (error) {
      if (before) restoreMemorySnapshot(before);
      throw error;
    }
    return result;
  });
};
