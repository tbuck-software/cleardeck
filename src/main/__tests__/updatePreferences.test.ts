// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  root: '',
  app: { getPath: vi.fn() },
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    getSelectedStorageBackend: undefined as (() => string) | undefined,
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

vi.mock('electron', () => ({ app: mocks.app, safeStorage: mocks.safeStorage }));

import {
  DEFAULT_UPDATE_REPOSITORY_URL,
  MAX_UPDATE_TOKEN_LENGTH,
  getUpdatePreferences,
  parseGitHubRepositoryUrl,
  readUpdateCredentials,
  saveUpdatePreferences,
} from '../updatePreferences';

const token = 'fixture-token-should-never-be-plaintext';

beforeEach(() => {
  mocks.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-update-preferences-'));
  mocks.app.getPath.mockReturnValue(mocks.root);
  mocks.safeStorage.getSelectedStorageBackend = undefined;
  mocks.safeStorage.isEncryptionAvailable.mockReturnValue(true);
  mocks.safeStorage.encryptString.mockImplementation((value: string) =>
    Buffer.from(`ciphertext:${value}`, 'utf8'),
  );
  mocks.safeStorage.decryptString.mockImplementation((value: Buffer) =>
    value.toString('utf8').replace(/^ciphertext:/, ''),
  );
});

afterEach(() => {
  vi.clearAllMocks();
  fs.rmSync(mocks.root, { recursive: true, force: true });
});

describe('update preferences', () => {
  it('uses the public default without creating a settings file', () => {
    expect(getUpdatePreferences()).toEqual({
      repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL,
      hasToken: false,
    });
    expect(readUpdateCredentials()).toBeNull();
    expect(fs.existsSync(path.join(mocks.root, 'update-source.json'))).toBe(false);
  });

  it('stores tokens through safeStorage and never writes plaintext', () => {
    const saved = saveUpdatePreferences({
      repositoryUrl: 'https://github.com/Example/team-app/',
      token,
    });

    expect(saved).toEqual({
      repositoryUrl: 'https://github.com/Example/team-app',
      hasToken: true,
    });
    expect(getUpdatePreferences()).toEqual(saved);
    expect(readUpdateCredentials()).toEqual({ owner: 'Example', repo: 'team-app', token });
    expect(mocks.safeStorage.encryptString).toHaveBeenCalledWith(token);

    const persisted = fs.readFileSync(path.join(mocks.root, 'update-source.json'), 'utf8');
    expect(persisted).not.toContain(token);
    expect(JSON.parse(persisted)).toMatchObject({ owner: 'Example', repo: 'team-app' });
  });

  it('preserves an omitted token for the same repository and clears it on a repository change', () => {
    saveUpdatePreferences({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, token });

    expect(
      saveUpdatePreferences({ repositoryUrl: 'https://github.com/tbuck-software/cleardeck' }),
    ).toEqual({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, hasToken: true });

    expect(
      saveUpdatePreferences({ repositoryUrl: 'https://github.com/Example/other-project' }),
    ).toEqual({ repositoryUrl: 'https://github.com/Example/other-project', hasToken: false });
    expect(readUpdateCredentials()).toEqual({ owner: 'Example', repo: 'other-project' });

    saveUpdatePreferences({
      repositoryUrl: 'https://github.com/Example/new-project.git',
      token: 'new-token',
    });
    expect(readUpdateCredentials()).toEqual({ owner: 'Example', repo: 'new-project', token: 'new-token' });
  });

  it('removes a saved token when the input is explicitly empty', () => {
    saveUpdatePreferences({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, token });

    expect(
      saveUpdatePreferences({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, token: '' }),
    ).toEqual({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, hasToken: false });
    expect(readUpdateCredentials()).toEqual({ owner: 'tbuck-software', repo: 'cleardeck' });
  });

  it('does not fall back to plaintext storage when safeStorage is unavailable', () => {
    mocks.safeStorage.isEncryptionAvailable.mockReturnValue(false);

    expect(() => saveUpdatePreferences({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, token })).toThrow(
      'nicht sicher gespeichert',
    );
    expect(fs.existsSync(path.join(mocks.root, 'update-source.json'))).toBe(false);
    expect(mocks.safeStorage.encryptString).not.toHaveBeenCalled();
  });

  it('does not use Electron basic_text storage as encrypted token storage', () => {
    mocks.safeStorage.getSelectedStorageBackend = vi.fn(() => 'basic_text');

    expect(() =>
      saveUpdatePreferences({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, token }),
    ).toThrow('nicht sicher gespeichert');
    expect(mocks.safeStorage.encryptString).not.toHaveBeenCalled();
  });

  it('accepts only a direct HTTPS github.com repository URL', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/tbuck-software/cleardeck.git/')).toEqual({
      owner: 'tbuck-software',
      repo: 'cleardeck',
    });

    for (const repositoryUrl of [
      'http://github.com/tbuck-software/cleardeck',
      'https://github.com.evil.example/tbuck-software/cleardeck',
      'https://attacker@github.com/tbuck-software/cleardeck',
      'https://github.com/tbuck-software/cleardeck?download=1',
      'https://github.com/tbuck-software/cleardeck/../other',
      'https://github.com/tbuck-software/cleardeck/issue/1',
      'https://github.com/tbuck-software/clear deck',
    ]) {
      expect(() => parseGitHubRepositoryUrl(repositoryUrl)).toThrow();
    }
  });

  it('rejects token line breaks and oversized values without writing them', () => {
    expect(() =>
      saveUpdatePreferences({ repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL, token: 'token\nvalue' }),
    ).toThrow('Zeilenumbrüche');
    expect(() =>
      saveUpdatePreferences({
        repositoryUrl: DEFAULT_UPDATE_REPOSITORY_URL,
        token: 'x'.repeat(MAX_UPDATE_TOKEN_LENGTH + 1),
      }),
    ).toThrow('zu lang');
    expect(fs.existsSync(path.join(mocks.root, 'update-source.json'))).toBe(false);
  });
});
