/**
 * Authentication IPC Handlers
 *
 * Handles registration, login, and password recovery.
 */

import { ipcMain, app, shell } from 'electron';
import crypto from 'crypto';

import type { AppState, AppInfo, StorageMode } from '../../shared/types';
import {
  type AppConfig,
  deriveKey,
  hashPassword,
  fingerprintKey,
  parseRecoveryKey,
  encryptBuffer,
  decryptBuffer,
  readConfig,
  writeConfig,
  getConfigStorageMode,
} from '../crypto';
import {
  setEncryptionKey,
  getEncryptionKey,
  openDatabase,
  persistEncryptedDb,
  closeDb,
  deleteEncryptedSnapshot,
  ensureDataDir,
  setStorageMode,
  getStorageMode,
  isDbOpen,
} from '../database/connection';
import { writeAtomic } from '../atomicFile';
import { getDb, getWorkingDbPath } from '../database/connection';
import { archiveAppData } from '../dataArchive';

// Track unlock state
let unlocked = false;

/**
 * Plain storage has no key, so "Sperren" there is a privacy cover over the
 * window rather than encryption — it hides the data from someone walking past
 * and is lifted by a button, not a password. Kept separate from `unlocked`
 * because syncRuntimeState() otherwise reports plain storage as always open.
 */
let screenLocked = false;

export const isUnlocked = (): boolean => unlocked;
export const setUnlocked = (value: boolean): void => {
  unlocked = value;
};

const getDefaultAppState = (): AppState => ({
  configured: false,
  unlocked: false,
  storageMode: 'encrypted',
});

const syncRuntimeState = (): AppState => {
  let config: AppConfig | null;
  try {
    config = readConfig();
  } catch (err) {
    // Keep the window and updater available, but never offer setup for unreadable data.
    unlocked = false;
    setEncryptionKey(null);
    setStorageMode('encrypted');
    return {
      ...getDefaultAppState(),
      startupError:
        err instanceof Error ? err.message : 'Die lokale Konfiguration kann nicht gelesen werden.',
    };
  }
  if (!config) {
    unlocked = false;
    setEncryptionKey(null);
    setStorageMode('encrypted');
    return getDefaultAppState();
  }

  const storageMode = getConfigStorageMode(config);
  setStorageMode(storageMode);
  if (storageMode === 'plain') {
    unlocked = !screenLocked;
    setEncryptionKey(null);
    return {
      configured: true,
      unlocked: !screenLocked,
      storageMode,
    };
  }

  return {
    configured: true,
    unlocked,
    storageMode,
  };
};

const buildConfiguredState = (storageMode: StorageMode, isOpen: boolean): AppState => ({
  configured: true,
  unlocked: isOpen,
  storageMode,
});

/**
 * Register all auth-related IPC handlers
 */
export const registerAuthHandlers = (): void => {
  syncRuntimeState();

  ipcMain.handle('app:state', (): AppState => syncRuntimeState());

  ipcMain.handle(
    'app:info',
    (): AppInfo => ({
      name: app.getName(),
      version: app.getVersion(),
      author: 'Torben Buck – tbuck software',
      email: 'mail@tbuck.de',
      github: 'https://github.com/Rasalas/employee-db',
      license: 'Proprietär (Einzelnutzer-Lizenz)',
      copyright: `© ${new Date().getFullYear()} tbuck software`,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    }),
  );

  ipcMain.handle('app:openExternal', async (_event, url: string): Promise<boolean> => {
    if (!url) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('auth:register', (_event, password: string): AppState => {
    if (readConfig()) {
      throw new Error('Die App ist bereits eingerichtet. Bitte melde dich an.');
    }
    ensureDataDir();

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const passwordKey = deriveKey(password, salt);
    const keyBytes = crypto.randomBytes(32);
    const encrypted = encryptBuffer(keyBytes, passwordKey);
    const keyFingerprint = fingerprintKey(keyBytes);

    const config: AppConfig = {
      storageMode: 'encrypted',
      salt,
      passwordHash,
      encryptedKey: encrypted.content.toString('base64'),
      keyIv: encrypted.iv.toString('base64'),
      keyTag: encrypted.tag.toString('base64'),
      keyFingerprint,
      configVersion: 3,
    };
    writeConfig(config);

    setStorageMode('encrypted');
    setEncryptionKey(keyBytes);
    unlocked = true;
    openDatabase({ create: true });
    persistEncryptedDb();
    return buildConfiguredState('encrypted', true);
  });

  ipcMain.handle('auth:registerPlain', (): AppState => {
    if (readConfig()) {
      throw new Error('Die App ist bereits eingerichtet. Bitte melde dich an.');
    }
    ensureDataDir();
    writeConfig({
      storageMode: 'plain',
      configVersion: 3,
    });

    setStorageMode('plain');
    setEncryptionKey(null);
    unlocked = true;
    openDatabase({ create: true });
    return buildConfiguredState('plain', true);
  });

  ipcMain.handle('auth:login', (_event, password: string): AppState => {
    const config = readConfig();
    if (!config) {
      throw new Error('Die App wurde noch nicht eingerichtet. Bitte erstelle zuerst ein Passwort.');
    }
    if (getConfigStorageMode(config) === 'plain') {
      setStorageMode('plain');
      screenLocked = false;
      unlocked = true;
      setEncryptionKey(null);
      if (!isDbOpen()) {
        openDatabase();
      }
      return buildConfiguredState('plain', true);
    }
    if (
      !config.salt ||
      !config.passwordHash ||
      !config.encryptedKey ||
      !config.keyIv ||
      !config.keyTag
    ) {
      throw new Error('Die Verschlüsselungskonfiguration ist unvollständig.');
    }
    const derived = deriveKey(password, config.salt);
    const hashed = hashPassword(password, config.salt);
    if (hashed !== config.passwordHash) {
      throw new Error('Das eingegebene Passwort ist nicht korrekt. Bitte versuche es erneut.');
    }

    const keyBytes = decryptBuffer(
      {
        content: Buffer.from(config.encryptedKey, 'base64'),
        iv: Buffer.from(config.keyIv, 'base64'),
        tag: Buffer.from(config.keyTag, 'base64'),
      },
      derived,
    );

    const keyFingerprint = fingerprintKey(keyBytes);
    if (!config.keyFingerprint || (config.configVersion ?? 1) < 2) {
      const upgraded: AppConfig = {
        ...config,
        storageMode: 'encrypted',
        keyFingerprint,
        configVersion: 3,
      };
      writeConfig(upgraded);
    }

    setStorageMode('encrypted');
    setEncryptionKey(keyBytes);
    try {
      openDatabase();
      unlocked = true;
    } catch (error) {
      unlocked = false;
      setEncryptionKey(null);
      throw error;
    }
    return buildConfiguredState('encrypted', true);
  });

  /**
   * Sperren: re-encrypt, drop the key, and leave the config alone.
   *
   * persistEncryptedDb() rather than closeDb(): closing only releases the
   * handle and would leave the decrypted working copy sitting on disk, which
   * would make locking worse than not locking at all.
   *
   * Plain storage has no key to drop; there it only covers the window and is
   * lifted again by a button. The lock screen says so, so nobody mistakes it
   * for protection.
   */
  ipcMain.handle('auth:lock', (): AppState => {
    const storageMode = getStorageMode();
    if (storageMode === 'plain') {
      screenLocked = true;
      closeDb();
      unlocked = false;
      return buildConfiguredState(storageMode, false);
    }
    persistEncryptedDb();
    setEncryptionKey(null);
    unlocked = false;
    return buildConfiguredState(storageMode, false);
  });

  /**
   * Change the password without touching the database.
   *
   * The data key itself stays the same and is only re-wrapped with a key
   * derived from the new password. That keeps the Recovery-Key valid — it *is*
   * the data key — and leaves existing backups readable with the password they
   * were written under.
   */
  ipcMain.handle(
    'auth:changePassword',
    (
      _event,
      { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
    ): AppState => {
      const config = readConfig();
      if (!config) {
        throw new Error('Die App wurde noch nicht eingerichtet.');
      }
      if (getConfigStorageMode(config) === 'plain') {
        throw new Error('Ohne Verschlüsselung gibt es kein Passwort zu ändern.');
      }
      if (!newPassword || newPassword.trim().length === 0) {
        throw new Error('Bitte ein neues Passwort eingeben.');
      }
      if (!config.salt || !config.passwordHash) {
        throw new Error('Die Verschlüsselungskonfiguration ist unvollständig.');
      }
      if (hashPassword(currentPassword, config.salt) !== config.passwordHash) {
        throw new Error('Das aktuelle Passwort ist nicht korrekt.');
      }

      const keyBytes = getEncryptionKey();
      if (!keyBytes) {
        throw new Error('Bitte zuerst anmelden.');
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const encrypted = encryptBuffer(keyBytes, deriveKey(newPassword, salt));

      writeConfig({
        ...config,
        storageMode: 'encrypted',
        salt,
        passwordHash: hashPassword(newPassword, salt),
        encryptedKey: encrypted.content.toString('base64'),
        keyIv: encrypted.iv.toString('base64'),
        keyTag: encrypted.tag.toString('base64'),
        keyFingerprint: fingerprintKey(keyBytes),
        configVersion: 3,
      });

      return buildConfiguredState('encrypted', true);
    },
  );

  ipcMain.handle('auth:recoveryKey', (): { recoveryKey: string; fingerprint: string } => {
    const key = getEncryptionKey();
    if (getStorageMode() === 'plain') {
      throw new Error('Im unverschlüsselten Modus gibt es keinen Recovery Key.');
    }
    if (!unlocked || !key) {
      throw new Error('Du musst angemeldet sein, um den Recovery Key anzuzeigen.');
    }
    return {
      recoveryKey: key.toString('base64'),
      fingerprint: fingerprintKey(key),
    };
  });

  ipcMain.handle(
    'auth:recover',
    (_event, payload: { recoveryKey: string; newPassword: string }): AppState => {
      const config = readConfig();
      if (!config) {
        throw new Error('Die App wurde noch nicht eingerichtet.');
      }
      if (getConfigStorageMode(config) === 'plain') {
        throw new Error('Im unverschlüsselten Modus ist kein Passwort-Reset nötig.');
      }
      const { recoveryKey, newPassword } = payload;
      if (!recoveryKey || recoveryKey.trim().length === 0) {
        throw new Error('Bitte gib deinen Recovery Key ein.');
      }
      if (!newPassword || newPassword.trim().length === 0) {
        throw new Error('Bitte gib ein neues Passwort ein.');
      }

      const keyBytes = parseRecoveryKey(recoveryKey);
      const fingerprint = fingerprintKey(keyBytes);
      if (config.keyFingerprint && config.keyFingerprint !== fingerprint) {
        throw new Error('Der Recovery Key ist ungültig oder gehört zu einer anderen Installation.');
      }

      try {
        setEncryptionKey(keyBytes);
        unlocked = true;
        openDatabase();
      } catch (err) {
        setEncryptionKey(null);
        unlocked = false;
        throw err;
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(newPassword, salt);
      const passwordKey = deriveKey(newPassword, salt);
      const encrypted = encryptBuffer(keyBytes, passwordKey);

      const nextConfig: AppConfig = {
        ...config,
        storageMode: 'encrypted',
        salt,
        passwordHash,
        encryptedKey: encrypted.content.toString('base64'),
        keyIv: encrypted.iv.toString('base64'),
        keyTag: encrypted.tag.toString('base64'),
        keyFingerprint: fingerprint,
        configVersion: Math.max(config.configVersion ?? 1, 3),
      };
      writeConfig(nextConfig);

      setStorageMode('encrypted');
      return buildConfiguredState('encrypted', true);
    },
  );

  ipcMain.handle('auth:disableEncryption', (): AppState => {
    const config = readConfig();
    if (!config) {
      throw new Error('Die App wurde noch nicht eingerichtet.');
    }
    if (getConfigStorageMode(config) === 'plain') {
      return buildConfiguredState('plain', true);
    }
    if (!unlocked || !getEncryptionKey()) {
      throw new Error('Bitte zuerst anmelden, um die Verschlüsselung zu ändern.');
    }

    if (!isDbOpen()) {
      openDatabase();
    }
    writeAtomic(getWorkingDbPath(), getDb().serialize());
    closeDb();
    writeConfig({
      storageMode: 'plain',
      configVersion: 3,
    });
    setStorageMode('plain');
    setEncryptionKey(null);
    unlocked = true;
    deleteEncryptedSnapshot();
    openDatabase();
    return buildConfiguredState('plain', true);
  });

  ipcMain.handle('auth:enableEncryption', (_event, password: string): AppState => {
    const config = readConfig();
    if (!config) {
      throw new Error('Die App wurde noch nicht eingerichtet.');
    }
    if (!password || password.trim().length === 0) {
      throw new Error('Bitte ein Passwort eingeben.');
    }
    if (getConfigStorageMode(config) === 'encrypted') {
      throw new Error('Die Verschlüsselung ist bereits aktiv.');
    }

    ensureDataDir();
    closeDb();

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const passwordKey = deriveKey(password, salt);
    const keyBytes = crypto.randomBytes(32);
    const encrypted = encryptBuffer(keyBytes, passwordKey);
    const keyFingerprint = fingerprintKey(keyBytes);

    writeConfig({
      storageMode: 'encrypted',
      salt,
      passwordHash,
      encryptedKey: encrypted.content.toString('base64'),
      keyIv: encrypted.iv.toString('base64'),
      keyTag: encrypted.tag.toString('base64'),
      keyFingerprint,
      configVersion: 3,
    });

    setStorageMode('encrypted');
    setEncryptionKey(keyBytes);
    unlocked = true;
    openDatabase();
    return buildConfiguredState('encrypted', true);
  });

  ipcMain.handle('app:reset', (): AppState => {
    persistEncryptedDb();
    closeDb();
    archiveAppData();
    unlocked = false;
    setEncryptionKey(null);
    setStorageMode('encrypted');
    return getDefaultAppState();
  });
};
