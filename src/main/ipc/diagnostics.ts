import fs from 'fs';
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readDiagnostics } from '../diagnostics';
import { formatDiagnostics } from '../../shared/diagnostics';

export const registerDiagnosticHandlers = (getWindow: () => BrowserWindow | null): void => {
  ipcMain.handle('diagnostics:read', () => readDiagnostics());
  ipcMain.handle('diagnostics:export', async (): Promise<boolean> => {
    const options = {
      title: 'Diagnose für Feedback speichern',
      defaultPath: `ClearDeck-Diagnose-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: 'Textdatei', extensions: ['txt'] }],
    };
    const window = getWindow();
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, formatDiagnostics(readDiagnostics()), 'utf8');
    return true;
  });
};
