import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

import { writeAtomic } from './atomicFile';
import {
  DEFAULT_UPDATE_OWNER,
  DEFAULT_UPDATE_REPO,
  DEFAULT_UPDATE_REPOSITORY_URL,
  type SaveUpdatePreferencesInput,
  type UpdateCredentials,
  type UpdatePreferences,
} from '../shared/updatePreferences';

const STORED_VERSION = 1;
const MAX_UPDATE_TOKEN_LENGTH = 4096;
const MAX_UPDATE_CIPHERTEXT_LENGTH = 16 * 1024;
const MAX_UPDATE_FILE_BYTES = 32 * 1024;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const GITHUB_HOST = 'github.com';

type StoredUpdatePreferences = {
  version: typeof STORED_VERSION;
  owner: string;
  repo: string;
  /** Base64 encoded safeStorage ciphertext. This is never a plaintext token. */
  token?: string;
};

export type ParsedRepository = {
  owner: string;
  repo: string;
};

export const getUpdatePreferencesPath = (): string =>
  path.join(app.getPath('userData'), 'update-source.json');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validOwner = (value: unknown): value is string =>
  typeof value === 'string' && OWNER_PATTERN.test(value);

const validRepo = (value: unknown): value is string =>
  typeof value === 'string' && REPOSITORY_PATTERN.test(value);

const repositoryUrlFor = ({ owner, repo }: ParsedRepository): string =>
  `https://${GITHUB_HOST}/${owner}/${repo}`;

const sameRepository = (left: ParsedRepository, right: ParsedRepository): boolean =>
  left.owner.toLowerCase() === right.owner.toLowerCase() &&
  left.repo.toLowerCase() === right.repo.toLowerCase();

const isBase64 = (value: string): boolean =>
  value.length > 0 &&
  value.length <= MAX_UPDATE_CIPHERTEXT_LENGTH &&
  value.length % 4 === 0 &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(value);

/**
 * Parse the only URL shape accepted by the update settings. URL parsing alone
 * is not enough here because it normalizes path traversal and accepts user
 * info, ports, queries, and fragments that do not belong in a repository URL.
 */
export const parseGitHubRepositoryUrl = (value: unknown): ParsedRepository => {
  if (typeof value !== 'string') {
    throw new Error('Bitte eine GitHub-Repository-URL eingeben.');
  }

  const input = value.trim();
  if (
    !input ||
    input.includes('\\') ||
    input.includes('\r') ||
    input.includes('\n') ||
    input.includes('?') ||
    input.includes('#') ||
    /(?:^|\/)(?:\.{1,2})(?:\/|$)/.test(input) ||
    /%2e/i.test(input)
  ) {
    throw new Error('Bitte eine GitHub-Repository-URL eingeben.');
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Bitte eine gültige HTTPS-URL von github.com eingeben.');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname.toLowerCase() !== GITHUB_HOST ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Die Update-Quelle muss eine HTTPS-URL von github.com sein.');
  }

  const pathParts = parsed.pathname.split('/');
  if (pathParts[0] !== '' || pathParts.length < 3 || pathParts.length > 4) {
    throw new Error('Bitte die URL eines GitHub-Repositories eingeben.');
  }

  const [rawOwner, rawRepo, trailing] = pathParts.slice(1);
  if (trailing !== undefined && trailing !== '') {
    throw new Error('Bitte die URL eines GitHub-Repositories eingeben.');
  }

  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
  if (!validOwner(rawOwner) || !validRepo(repo)) {
    throw new Error('Der GitHub-Repositoryname ist ungültig.');
  }

  return { owner: rawOwner, repo };
};

const readStoredPreferences = (): StoredUpdatePreferences | null => {
  try {
    const settingsPath = getUpdatePreferencesPath();
    if (fs.statSync(settingsPath).size > MAX_UPDATE_FILE_BYTES) return null;
    const raw = fs.readFileSync(settingsPath, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > MAX_UPDATE_FILE_BYTES) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== STORED_VERSION ||
      !validOwner(parsed.owner) ||
      !validRepo(parsed.repo)
    ) {
      return null;
    }

    const token = parsed.token;
    if (token !== undefined && (typeof token !== 'string' || !isBase64(token))) {
      return null;
    }

    return {
      version: STORED_VERSION,
      owner: parsed.owner,
      repo: parsed.repo,
      ...(typeof token === 'string' && token ? { token } : {}),
    };
  } catch {
    return null;
  }
};

const encryptionAvailable = (): boolean => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const storage = safeStorage as typeof safeStorage & {
      getSelectedStorageBackend?: () => string;
    };
    return storage.getSelectedStorageBackend?.().toLowerCase() !== 'basic_text';
  } catch {
    return false;
  }
};

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

const decryptStoredToken = (stored: StoredUpdatePreferences | null): string | undefined => {
  if (!stored?.token || !encryptionAvailable()) return undefined;

  try {
    const encrypted = Buffer.from(stored.token, 'base64');
    const token = safeStorage.decryptString(encrypted);
    return isValidToken(token) ? token : undefined;
  } catch {
    return undefined;
  }
};

const isValidToken = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_UPDATE_TOKEN_LENGTH &&
  Buffer.byteLength(value, 'utf8') <= MAX_UPDATE_TOKEN_LENGTH &&
  !hasControlCharacter(value) &&
  !/\s/.test(value);

const tokenFromInput = (input: SaveUpdatePreferencesInput): string | null | undefined => {
  if (!Object.prototype.hasOwnProperty.call(input, 'token') || input.token === undefined) {
    return undefined;
  }

  if (typeof input.token !== 'string') {
    throw new Error('Der Zugriffstoken ist ungültig.');
  }

  if (input.token.includes('\r') || input.token.includes('\n')) {
    throw new Error('Der Zugriffstoken darf keine Zeilenumbrüche enthalten.');
  }

  const token = input.token.trim();
  if (!token) return null;
  if (Buffer.byteLength(token, 'utf8') > MAX_UPDATE_TOKEN_LENGTH) {
    throw new Error('Der Zugriffstoken ist zu lang.');
  }
  if (!isValidToken(token)) {
    throw new Error('Der Zugriffstoken darf keine Leer- oder Steuerzeichen enthalten.');
  }

  return token;
};

const encryptToken = (token: string): string => {
  if (!encryptionAvailable()) {
    throw new Error('Der Zugriffstoken kann auf diesem Gerät nicht sicher gespeichert werden.');
  }

  try {
    const encrypted = safeStorage.encryptString(token);
    const buffer = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
    if (!buffer.length || buffer.length > MAX_UPDATE_CIPHERTEXT_LENGTH) {
      throw new Error('invalid ciphertext');
    }
    return buffer.toString('base64');
  } catch {
    throw new Error('Der Zugriffstoken kann auf diesem Gerät nicht sicher gespeichert werden.');
  }
};

const writeStoredPreferences = (stored: StoredUpdatePreferences): void => {
  writeAtomic(
    getUpdatePreferencesPath(),
    Buffer.from(`${JSON.stringify(stored, null, 2)}\n`, 'utf8'),
  );
};

/**
 * Return the settings-safe view. It intentionally contains no token data.
 * Missing or unreadable settings use the public default repository.
 */
export const getUpdatePreferences = (): UpdatePreferences => {
  const stored = readStoredPreferences();
  if (!stored) {
    return { repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, hasToken: false };
  }

  return {
    repositoryUrl: repositoryUrlFor(stored),
    hasToken: Boolean(stored.token),
  };
};

/**
 * Save the settings-safe view. Omitting token preserves an existing token for
 * the same repository. Changing repositories clears it unless a new token is
 * supplied explicitly.
 */
export const saveUpdatePreferences = (input: SaveUpdatePreferencesInput): UpdatePreferences => {
  if (!isRecord(input)) {
    throw new Error('Die Update-Einstellungen sind ungültig.');
  }

  const repository = parseGitHubRepositoryUrl(input.repositoryUrl);
  const existing = readStoredPreferences();
  const requestedToken = tokenFromInput(input);
  const keepExistingToken =
    requestedToken === undefined && existing !== null && sameRepository(existing, repository);

  const stored: StoredUpdatePreferences = {
    version: STORED_VERSION,
    owner: repository.owner,
    repo: repository.repo,
    ...(requestedToken !== undefined
      ? requestedToken === null
        ? {}
        : { token: encryptToken(requestedToken) }
      : keepExistingToken && existing?.token
        ? { token: existing.token }
        : {}),
  };

  writeStoredPreferences(stored);
  return {
    repositoryUrl: repositoryUrlFor(repository),
    hasToken: Boolean(stored.token),
  };
};

/**
 * Read credentials for the updater. Keep this function in the main process;
 * the preload API exposes only getUpdatePreferences/saveUpdatePreferences.
 */
export const readUpdateCredentials = (): UpdateCredentials | null => {
  const stored = readStoredPreferences();
  if (!stored) return null;

  const token = decryptStoredToken(stored);
  return {
    owner: stored.owner,
    repo: stored.repo,
    ...(token ? { token } : {}),
  };
};

export {
  DEFAULT_UPDATE_OWNER,
  DEFAULT_UPDATE_REPO,
  DEFAULT_UPDATE_REPOSITORY_URL,
  MAX_UPDATE_TOKEN_LENGTH,
};
export const updatePreferencesPath = getUpdatePreferencesPath;
