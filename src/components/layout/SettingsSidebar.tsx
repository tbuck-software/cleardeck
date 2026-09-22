import React from 'react';
import Icon, { type IconName } from '../ui/Icon';
import type { Page } from '../../types/ui';
import type { StorageMode } from '../../shared/types';

const SETTINGS_NAV: { key: Page; label: string; icon: IconName }[] = [
  { key: 'settings', label: 'Allgemein', icon: 'settings' },
  { key: 'security', label: 'Sicherheit & Backup', icon: 'security' },
  { key: 'connections', label: 'Verbindungen', icon: 'link' },
  { key: 'shortcuts', label: 'Tastenkürzel', icon: 'shortcuts' },
  { key: 'logs', label: 'Logs & Diagnose', icon: 'logs' },
  { key: 'about', label: 'Über ClearDeck', icon: 'about' },
];

type SettingsSidebarProps = {
  current: Page;
  wide: boolean;
  storageMode: StorageMode;
  onNavigate: (page: Page) => void;
  onLeave: () => void;
  onLock: () => void;
};

const SettingsSidebar = ({ current, wide, storageMode, onNavigate, onLeave, onLock }: SettingsSidebarProps) => (
  <aside className="app-sidebar" data-wide={wide}>
    <button type="button" className="cd-nav cd-nav-muted app-sidebar-back" aria-label="Zurück" onClick={onLeave}>
      <Icon name="arrowLeft" />
      {wide && <span>Zurück</span>}
    </button>
    {wide && <div className="app-sidebar-heading">Einstellungen</div>}

    {SETTINGS_NAV.map((entry) => (
      <button
        key={entry.key}
        type="button"
        className="cd-nav"
        aria-current={current === entry.key ? 'page' : undefined}
        aria-label={entry.label}
        title={wide ? undefined : entry.label}
        onClick={() => onNavigate(entry.key)}
      >
        <Icon name={entry.icon} />
        {wide && <span style={{ flex: 1 }}>{entry.label}</span>}
      </button>
    ))}

    <div style={{ flex: 1 }} />

    <button type="button" className="cd-nav" aria-label="Zurück" onClick={onLeave}>
      <Icon name="arrowLeft" />
      {wide && <span style={{ flex: 1 }}>Zurück</span>}
    </button>
    <button type="button" className="cd-nav cd-nav-muted" aria-label={storageMode === 'encrypted' ? 'Sperren' : 'Verdecken'} onClick={onLock}>
      <Icon name={storageMode === 'encrypted' ? 'lock' : 'eyeOff'} />
      {wide && <span>{storageMode === 'encrypted' ? 'Sperren' : 'Verdecken'}</span>}
    </button>
  </aside>
);

export default SettingsSidebar;
