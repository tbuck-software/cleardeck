/// <reference types="vitest/globals" />

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
  },
}));

import { getConfigStorageMode } from '../crypto';

describe('getConfigStorageMode', () => {
  it('behandelt alte Konfigurationen ohne storageMode als verschlüsselt', () => {
    expect(getConfigStorageMode({ configVersion: 2 })).toBe('encrypted');
  });

  it('liest unverschlüsselte Konfigurationen korrekt', () => {
    expect(getConfigStorageMode({ configVersion: 3, storageMode: 'plain' })).toBe('plain');
  });
});
