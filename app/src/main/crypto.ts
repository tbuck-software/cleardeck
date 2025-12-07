/**
 * Cryptographic utilities for database encryption and password hashing
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Config file path
const dataDir = path.join(app.getPath('userData'), 'data');
const configPath = path.join(dataDir, 'config.json');

export type AppConfig = {
  salt: string;
  passwordHash: string;
  encryptedKey: string;
  keyIv: string;
  keyTag: string;
  keyFingerprint?: string;
  configVersion: number;
};

/**
 * Ensure the data directory exists
 */
export const ensureDataDir = (): void => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

/**
 * Derive an encryption key from a password
 */
export const deriveKey = (password: string, salt: string): Buffer =>
  crypto.pbkdf2Sync(password, salt, 200_000, 32, 'sha512');

/**
 * Hash a password for storage
 */
export const hashPassword = (password: string, salt: string): string =>
  crypto.pbkdf2Sync(password, salt, 220_000, 64, 'sha512').toString('hex');

/**
 * Create a fingerprint of an encryption key
 */
export const fingerprintKey = (key: Buffer): string =>
  crypto.createHash('sha256').update(key).digest('hex');

/**
 * Parse a recovery key from user input (base64 or hex)
 */
export const parseRecoveryKey = (input: string): Buffer => {
  const trimmed = input.trim();
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) {
      return buf;
    }
  } catch {
    // ignore
  }
  try {
    const buf = Buffer.from(trimmed, 'hex');
    if (buf.length === 32) {
      return buf;
    }
  } catch {
    // ignore
  }
  throw new Error('Recovery Key hat ein ungültiges Format (erwartet Base64 oder Hex, 32 Byte).');
};

/**
 * Encrypt a buffer using AES-256-GCM
 */
export const encryptBuffer = (
  data: Buffer,
  key: Buffer,
): { iv: Buffer; tag: Buffer; content: Buffer } => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, content };
};

/**
 * Decrypt a buffer using AES-256-GCM
 */
export const decryptBuffer = (
  payload: { iv: Buffer; tag: Buffer; content: Buffer },
  key: Buffer,
): Buffer => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.iv);
  decipher.setAuthTag(payload.tag);
  return Buffer.concat([decipher.update(payload.content), decipher.final()]);
};

/**
 * Encrypt a file to another file
 */
export const encryptFile = (inputPath: string, outputPath: string, key: Buffer): void => {
  const data = fs.readFileSync(inputPath);
  const payload = encryptBuffer(data, key);
  const combined = Buffer.concat([payload.iv, payload.tag, payload.content]);
  fs.writeFileSync(outputPath, combined);
};

/**
 * Decrypt a file to another file
 */
export const decryptFile = (inputPath: string, outputPath: string, key: Buffer): void => {
  const payload = fs.readFileSync(inputPath);
  if (payload.length < 28) {
    throw new Error('Verschlüsseltes Datenpaket ist ungültig.');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const content = payload.subarray(28);
  const data = decryptBuffer({ iv, tag, content }, key);
  fs.writeFileSync(outputPath, data);
};

/**
 * Check if the application is configured (has a config file)
 */
export const isConfigured = (): boolean => fs.existsSync(configPath);

/**
 * Read the application config
 */
export const readConfig = (): AppConfig | null => {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content) as AppConfig;
  } catch {
    return null;
  }
};

/**
 * Write the application config
 */
export const writeConfig = (config: AppConfig): void => {
  ensureDataDir();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

/**
 * Delete the config file
 */
export const deleteConfig = (): void => {
  if (fs.existsSync(configPath)) {
    fs.rmSync(configPath, { force: true });
  }
};

// Re-export paths
export { configPath, dataDir };

