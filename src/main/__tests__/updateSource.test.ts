/// <reference types="vitest/globals" />

import { manualUpdateReason, redactUpdateFeedUrl, resolveUpdateSource } from '../updateSource';

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

  it('ignoriert Laufzeittokens fuer den verpackten oeffentlichen GitHub-Feed', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'ghp_public-feed-must-not-use-this-token',
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: false },
      }),
    ).toEqual({ kind: 'packaged' });
  });

  it('behandelt eine fehlende private-Angabe als oeffentlichen Feed', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'ghp_public-feed-must-not-use-this-token',
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db' },
      }),
    ).toEqual({ kind: 'packaged' });
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

  it('laesst einen Token nur fuer eine ausdruecklich private Konfiguration zu', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'private-runtime-token',
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: true },
      }),
    ).toEqual({
      kind: 'github',
      owner: 'Rasalas',
      repo: 'employee-db',
      private: true,
      token: 'private-runtime-token',
    });
  });

  it('uebernimmt gespeichertes Repository ohne Token als oeffentlichen Feed', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'inherited-environment-token',
        runtimeCredentials: { owner: 'Someone', repo: 'renamed-app' },
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: false },
      }),
    ).toEqual({ kind: 'github', owner: 'Someone', repo: 'renamed-app', private: false });
  });

  it('nutzt einen ausdruecklich gespeicherten Token fuer den privaten Feed', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'inherited-environment-token',
        runtimeCredentials: { owner: 'Someone', repo: 'renamed-app', token: 'local-token' },
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: false },
      }),
    ).toEqual({
      kind: 'github',
      owner: 'Someone',
      repo: 'renamed-app',
      private: true,
      token: 'local-token',
    });
  });

  it('ignoriert den Umgebungstoken bei gespeicherter privater Quelle ohne lokalen Token', () => {
    expect(
      resolveUpdateSource({
        ghToken: 'inherited-environment-token',
        runtimeCredentials: { owner: 'Someone', repo: 'renamed-app' },
        packagedConfig: { provider: 'github', owner: 'Rasalas', repo: 'employee-db', private: true },
      }),
    ).toEqual({ kind: 'github', owner: 'Someone', repo: 'renamed-app', private: false });
  });

  it('entfernt Zugangsdaten aus generischen Feed-URLs fuer Meldungen', () => {
    expect(redactUpdateFeedUrl(
      'https://feed-user:feed-password@updates.example.com/latest.yml?access_token=query-secret&channel=stable',
    )).toBe('https://updates.example.com/latest.yml');
    expect(redactUpdateFeedUrl('https://updates.example.com/latest.yml?channel=stable'))
      .toBe('https://updates.example.com/latest.yml');
  });
});
