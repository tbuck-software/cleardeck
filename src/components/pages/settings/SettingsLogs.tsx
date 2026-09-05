import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import api from '../../../services/api';
import { formatDiagnostics } from '../../../shared/diagnostics';
import type { AppInfo, DiagnosticSnapshot, StorageMode } from '../../../shared/types';

type LevelFilter = 'all' | 'info' | 'error';

const LEVEL_COLOR: Record<string, string> = {
  INFO: 'var(--color-accent-2-300)',
  ERROR: '#f0867a',
};

type SettingsLogsProps = {
  appInfo: AppInfo | null;
  storageMode: StorageMode;
  onNotice: (message: string) => void;
};

const SettingsLogs = ({ appInfo, storageMode, onNotice }: SettingsLogsProps) => {
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot>({ entries: [] });
  const [level, setLevel] = useState<LevelFilter>('all');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await api.diagnostics.read());
    } catch {
      onNotice('Die Diagnose konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const entries = useMemo(
    () => (level === 'all' ? snapshot.entries : snapshot.entries.filter((entry) => entry.level === level)),
    [snapshot.entries, level],
  );

  const facts = [
    { label: 'Version', value: appInfo?.version ?? '—' },
    { label: 'Electron', value: appInfo?.electronVersion ?? '—' },
    { label: 'Node', value: appInfo?.nodeVersion ?? '—' },
    { label: 'Plattform', value: `${appInfo?.platform ?? '—'} ${appInfo?.arch ?? ''}`.trim() },
    { label: 'Speicher', value: storageMode === 'encrypted' ? 'verschlüsselt' : 'unverschlüsselt' },
    { label: 'Einträge', value: String(snapshot.entries.length) },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatDiagnostics(snapshot));
      onNotice('Diagnose kopiert.');
    } catch {
      onNotice('Kopieren nicht möglich — bitte die Diagnosedatei speichern.');
    }
  };

  const openFolder = async () => {
    try {
      if (!(await api.diagnostics.openFolder())) onNotice('Der Log-Ordner konnte nicht geöffnet werden.');
    } catch {
      onNotice('Der Log-Ordner konnte nicht geöffnet werden.');
    }
  };

  const clear = async () => {
    try {
      await api.diagnostics.clear();
      await refresh();
      onNotice('Logs gelöscht.');
    } catch {
      onNotice('Die Logs konnten nicht gelöscht werden.');
    }
  };

  const download = async () => {
    try {
      if (await api.diagnostics.export()) onNotice('Diagnosedatei gespeichert.');
    } catch {
      onNotice('Die Diagnosedatei konnte nicht gespeichert werden.');
    }
  };

  return (
    <div className="cd-page cd-detail" style={{ maxWidth: 860 }}>
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            Logs &amp; Diagnose
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            Für Support-Anfragen. Enthält keine Patient:innen- oder Personendaten.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
            <Icon name="copy" size={16} />
            Kopieren
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void download()}>
            <Icon name="download" size={16} />
            Diagnosedatei speichern
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '16px 28px',
          fontSize: 14,
        }}
      >
        {facts.map((fact) => (
          <div key={fact.label}>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{fact.label}</div>
            <div className="cd-mono" style={{ fontWeight: 600 }}>
              {fact.value}
            </div>
          </div>
        ))}
      </div>

      <section>
        <div className="cd-section-head">
          <Segmented
            ariaLabel="Log-Stufe"
            options={[
              { value: 'all' as LevelFilter, label: 'Alle' },
              { value: 'info' as LevelFilter, label: 'Info' },
              { value: 'error' as LevelFilter, label: 'Fehler' },
            ]}
            value={level}
            onChange={setLevel}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cd-muted-13">{entries.length} Einträge · neueste zuerst</span>
            <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void refresh()}>
              {loading ? 'Lädt …' : 'Aktualisieren'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void openFolder()}>
              Log-Ordner öffnen
            </button>
          </div>
        </div>

        {snapshot.storageError && (
          <div className="cd-notice cd-notice-bad" style={{ marginBottom: 10 }} role="alert">
            <Icon name="warning" />
            <span>{snapshot.storageError}</span>
          </div>
        )}

        <div className="cd-log-console" role="region" aria-label="Diagnoseeinträge" tabIndex={0}>
          {entries.length === 0 && <div className="cd-log-time">Keine Einträge.</div>}
          {entries.map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="cd-log-line">
              <span className="cd-log-time">{entry.at}</span>
              <span style={{ fontWeight: 700, color: LEVEL_COLOR[entry.level.toUpperCase()] ?? 'inherit' }}>
                {entry.level.toUpperCase()}
              </span>
              <span className="cd-log-msg">
                <span className="cd-log-src">{entry.source} · </span>
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="cd-muted-13" style={{ margin: 0 }}>
        Die Diagnosedatei bündelt Systeminfo und die aufgezeichneten App- und Update-Ereignisse.{' '}
        <button type="button" className="cd-link cd-danger-link" onClick={() => void clear()}>
          Logs löschen
        </button>
      </p>
    </div>
  );
};

export default SettingsLogs;
