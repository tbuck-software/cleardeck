/**
 * Authentication IPC Handlers
 *
 * Handles registration, login, and password recovery.
 */

import { ipcMain, app } from 'electron';
import crypto from 'crypto';

import type { AppState, AppInfo } from '../../shared/types';
import {
  type AppConfig,
  deriveKey,
  hashPassword,
  fingerprintKey,
  parseRecoveryKey,
  encryptBuffer,
  decryptBuffer,
  isConfigured,
  readConfig,
  writeConfig,
  deleteConfig,
} from '../crypto';
import {
  setEncryptionKey,
  getEncryptionKey,
  openDatabase,
  persistEncryptedDb,
  closeDb,
  deleteDatabase as deleteDbFiles,
  ensureDataDir,
} from '../database/connection';

// Track unlock state
let unlocked = false;

export const isUnlocked = (): boolean => unlocked;
export const setUnlocked = (value: boolean): void => {
  unlocked = value;
};

/**
 * Register all auth-related IPC handlers
 */
export const registerAuthHandlers = (): void => {
  ipcMain.handle('app:state', (): AppState => ({
    configured: isConfigured(),
    unlocked,
  }));

  ipcMain.handle('app:info', (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle('auth:register', (_event, password: string): AppState => {
    if (isConfigured()) {
      throw new Error('Die App ist bereits eingerichtet.');
    }
    ensureDataDir();

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const passwordKey = deriveKey(password, salt);
    const keyBytes = crypto.randomBytes(32);
    const encrypted = encryptBuffer(keyBytes, passwordKey);
    const keyFingerprint = fingerprintKey(keyBytes);

    const config: AppConfig = {
      salt,
      passwordHash,
      encryptedKey: encrypted.content.toString('base64'),
      keyIv: encrypted.iv.toString('base64'),
      keyTag: encrypted.tag.toString('base64'),
      keyFingerprint,
      configVersion: 2,
    };
    writeConfig(config);

    setEncryptionKey(keyBytes);
    unlocked = true;
    openDatabase();
    persistEncryptedDb();
    return { configured: true, unlocked: true };
  });

  ipcMain.handle('auth:login', (_event, password: string): AppState => {
    const config = readConfig();
    if (!config) {
      throw new Error('Noch nicht eingerichtet.');
    }
    const derived = deriveKey(password, config.salt);
    const hashed = hashPassword(password, config.salt);
    if (hashed !== config.passwordHash) {
      throw new Error('Passwort ist falsch.');
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
        keyFingerprint,
        configVersion: 2,
      };
      writeConfig(upgraded);
    }

    setEncryptionKey(keyBytes);
    unlocked = true;
    openDatabase();
    return { configured: true, unlocked: true };
  });

  ipcMain.handle('auth:recoveryKey', (): { recoveryKey: string; fingerprint: string } => {
    const key = getEncryptionKey();
    if (!unlocked || !key) {
      throw new Error('Bitte zuerst anmelden.');
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
        throw new Error('Noch nicht eingerichtet.');
      }
      const { recoveryKey, newPassword } = payload;
      if (!recoveryKey || recoveryKey.trim().length === 0) {
        throw new Error('Recovery Key fehlt.');
      }
      if (!newPassword || newPassword.trim().length === 0) {
        throw new Error('Neues Passwort fehlt.');
      }

      const keyBytes = parseRecoveryKey(recoveryKey);
      const fingerprint = fingerprintKey(keyBytes);
      if (config.keyFingerprint && config.keyFingerprint !== fingerprint) {
        throw new Error('Recovery Key passt nicht zu dieser Installation.');
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
        salt,
        passwordHash,
        encryptedKey: encrypted.content.toString('base64'),
        keyIv: encrypted.iv.toString('base64'),
        keyTag: encrypted.tag.toString('base64'),
        keyFingerprint: fingerprint,
        configVersion: Math.max(config.configVersion ?? 1, 2),
      };
      writeConfig(nextConfig);

      return { configured: true, unlocked: true };
    },
  );

  ipcMain.handle('app:reset', (): AppState => {
    closeDb();
    deleteDbFiles();
    deleteConfig();
    unlocked = false;
    setEncryptionKey(null);
    return { configured: false, unlocked: false };
  });
};
