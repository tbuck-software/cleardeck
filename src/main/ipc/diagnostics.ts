import fs from 'fs';
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { clearDiagnostics, diagnosticsDir, readDiagnostics } from '../diagnostics';
import { formatDiagnostics } from '../../shared/diagnostics';

export const registerDiagnosticHandlers = (getWindow: () => BrowserWindow | null): void => {
  ipcMain.handle('diagnostics:read', () => readDiagnostics());

  ipcMain.handle('diagnostics:openFolder', async (): Promise<boolean> => {
    const folder = diagnosticsDir();
    fs.mkdirSync(folder, { recursive: true });
    const error = await shell.openPath(folder);
    return error === '';
  });

  ipcMain.handle('diagnostics:clear', (): void => clearDiagnostics());
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
