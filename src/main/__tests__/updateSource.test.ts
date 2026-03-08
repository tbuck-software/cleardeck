/// <reference types="vitest/globals" />

import { manualUpdateReason, resolveUpdateSource } from '../updateSource';

describe('resolveUpdateSource', () => {
  it('bevorzugt eine explizite generic feed URL', () => {
    expect(
      resolveUpdateSource({
        updateFeedUrl: 'https://updates.example.com',
        ghToken: 'token',
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: true },
      }),
    ).toEqual({
      kind: 'generic',
      url: 'https://updates.example.com',
    });
  });

  it('nutzt GitHub mit Token fuer private Releases', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'token',
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: true },
      }),
    ).toEqual({
      kind: 'github',
      owner: 'Rasalas',
      repo: 'employee-db',
      private: true,
      token: 'token',
    });
  });

  it('faellt auf packaged config zurueck, wenn sie ohne Token nutzbar ist', () => {
    expect(
      resolveUpdateSource({
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: false },
      }),
    ).toEqual({ kind: 'packaged' });
  });

  it('meldet private GitHub Releases ohne Token als manuellen Update-Fall', () => {
    expect(
      resolveUpdateSource({
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: true },
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: manualUpdateReason,
    });
  });
});
