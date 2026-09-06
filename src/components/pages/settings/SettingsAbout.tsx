import React from 'react';
import type { AppInfo, UpdateStatus } from '../../../shared/types';
import logoUrl from '../../../assets/logo.png';

const CHECK_LABELS: Record<UpdateStatus['state'], string> = {
  idle: 'Noch nicht geprüft.',
  checking: 'Suche nach Updates …',
  available: 'Eine neuere Version steht bereit.',
  'not-available': 'Keine neuere Version.',
  downloading: 'Update wird geladen …',
  downloaded: 'Update installiert sich beim nächsten Neustart.',
  installing: 'Neustart wird vorbereitet …',
  error: 'Die letzte Prüfung ist fehlgeschlagen.',
};

type SettingsAboutProps = {
  appInfo: AppInfo | null;
  updateStatus: UpdateStatus;
  lastUpdateCheckAt: string | null;
  onCheckUpdates: () => void | Promise<void>;
  onContact: () => void;
};

const SettingsAbout = ({
  appInfo,
  updateStatus,
  lastUpdateCheckAt,
  onCheckUpdates,
  onContact,
}: SettingsAboutProps) => (
  <div className="cd-page cd-detail" style={{ maxWidth: 720 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <img src={logoUrl} alt="" style={{ width: 96, height: 96, objectFit: 'contain' }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            ClearDeck
          </h1>
          {appInfo?.version && <span className="tag tag-accent">v{appInfo.version}</span>}
        </div>
        <p className="cd-muted" style={{ margin: '4px 0 0' }}>
          Team- und Patient:innen-Verwaltung für den Pflegedienst — lokal, verschlüsselt, ohne
          Cloud.
        </p>
      </div>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px 32px',
        fontSize: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Entwickler</div>
        <div style={{ fontWeight: 600 }}>{appInfo?.author ?? 'Torben Buck'}</div>
        {appInfo?.email && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{appInfo.email}</div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Lizenz</div>
        <div style={{ fontWeight: 600 }}>{appInfo?.license ?? 'Proprietär'}</div>
        {appInfo?.copyright && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{appInfo.copyright}</div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Laufzeit</div>
        <div style={{ fontWeight: 600 }}>
          Electron {appInfo?.electronVersion ?? '—'} · Node {appInfo?.nodeVersion ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
          {appInfo?.platform ?? '—'} {appInfo?.arch ?? ''}
        </div>
      </div>
    </div>

    <p className="cd-muted-13">
      ClearDeck hieß früher Employee DB. Beide Namen bezeichnen dieselbe App; die Umbenennung ist
      keine Synchronisierung zwischen zwei Produkten.
    </p>

    <p className="cd-muted-14" style={{ margin: 0 }}>
      Updates werden beim Start und stündlich geprüft.{' '}
      {lastUpdateCheckAt ? `Letzte Prüfung ${lastUpdateCheckAt}. ` : ''}
      {CHECK_LABELS[updateStatus.state]}{' '}
      <button type="button" className="cd-link" onClick={() => void onCheckUpdates()}>
        Jetzt prüfen
      </button>
    </p>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" className="btn btn-primary" onClick={onContact}>
        Torben kontaktieren
      </button>
    </div>
  </div>
);

export default SettingsAbout;
