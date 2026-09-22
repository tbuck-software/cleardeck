import React from 'react';
import Icon, { type IconName } from '../ui/Icon';
import UpdatePopover from '../ui/UpdatePopover';
import type { Page } from '../../types/ui';
import type { StorageMode, UpdateStatus } from '../../shared/types';
import logoUrl from '../../assets/logo.png';

type NavEntry = { key: Page; label: string; icon: IconName; badge?: number };

const MAIN_NAV: NavEntry[] = [
  { key: 'dashboard', label: 'Übersicht', icon: 'dashboard' },
  { key: 'list', label: 'Team', icon: 'team' },
  { key: 'patients', label: 'Patient:innen', icon: 'patients' },
  { key: 'audit', label: 'MD-Prüfung', icon: 'audit' },
  { key: 'calendar', label: 'Kalender', icon: 'calendar' },
];

const ADMIN_NAV: NavEntry[] = [
  { key: 'integrity', label: 'Datenprüfung', icon: 'warning' },
  { key: 'quals', label: 'Qualifikationen', icon: 'qualifications' },
  { key: 'services', label: 'Leistungen', icon: 'services' },
  { key: 'comps', label: 'Kompetenzen', icon: 'competencies' },
  { key: 'instrs', label: 'Einweisungen', icon: 'instructions' },
];

type AppSidebarProps = {
  current: Page;
  wide: boolean;
  /** Without encryption the button covers the screen rather than locking it. */
  storageMode: StorageMode;
  openTaskCount: number;
  updateStatus: UpdateStatus;
  currentVersion?: string;
  onNavigate: (page: Page) => void;
  onOpenPalette: () => void;
  onLock: () => void;
  onCheckUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
};

const AppSidebar = ({
  current,
  wide,
  storageMode,
  openTaskCount,
  updateStatus,
  currentVersion,
  onNavigate,
  onOpenPalette,
  onLock,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}: AppSidebarProps) => {
  const lockLabel = storageMode === 'encrypted' ? 'Sperren' : 'Verdecken';

  const renderNav = (entry: NavEntry) => (
    <button
      key={entry.key}
      type="button"
      className="cd-nav"
      aria-current={current === entry.key ? 'page' : undefined}
      aria-label={
        entry.badge
          ? `${entry.label}, ${entry.badge} ${entry.badge === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}`
          : entry.label
      }
      title={
        wide
          ? undefined
          : entry.badge
            ? `${entry.label}, ${entry.badge} ${entry.badge === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}`
            : entry.label
      }
      onClick={() => onNavigate(entry.key)}
    >
      <Icon name={entry.icon} />
      {wide && <span style={{ flex: 1 }}>{entry.label}</span>}
      {entry.badge ? (
        <span className="cd-nav-badge" aria-hidden="true">
          {!wide && entry.badge > 9 ? '9+' : entry.badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <aside className="app-sidebar" data-wide={wide}>
      <div className="app-sidebar-brand">
        <img src={logoUrl} alt="" className="app-sidebar-logo" />
        {wide && (
          <div className="app-sidebar-title">
            {process.env.NODE_ENV === 'development' ? 'ClearDeck Dev' : 'ClearDeck'}
          </div>
        )}
      </div>

      <button type="button" className="cd-nav cd-nav-search" onClick={onOpenPalette}>
        <Icon name="search" />
        {wide && (
          <>
            <span style={{ flex: 1 }}>Suchen…</span>
            <kbd className="cd-kbd">⌘K</kbd>
          </>
        )}
      </button>

      {MAIN_NAV.map((entry) =>
        renderNav(entry.key === 'dashboard' ? { ...entry, badge: openTaskCount } : entry),
      )}

      {wide ? (
        <div className="app-sidebar-group">Verwaltung</div>
      ) : (
        <div className="app-sidebar-rule" />
      )}
      {ADMIN_NAV.map(renderNav)}

      <div style={{ flex: 1 }} />

      <UpdatePopover
        status={updateStatus}
        wide={wide}
        currentVersion={currentVersion}
        onCheck={onCheckUpdates}
        onDownload={onDownloadUpdate}
        onInstall={onInstallUpdate}
      />

      <button
        type="button"
        className="cd-nav"
        title={wide ? undefined : 'Einstellungen'}
        onClick={() => onNavigate('settings')}
      >
        <Icon name="settings" />
        {wide && <span style={{ flex: 1 }}>Einstellungen</span>}
      </button>
      <button
        type="button"
        className="cd-nav cd-nav-muted"
        title={wide ? undefined : lockLabel}
        onClick={onLock}
      >
        <Icon name={storageMode === 'encrypted' ? 'lock' : 'eyeOff'} />
        {wide && <span>{lockLabel}</span>}
      </button>
    </aside>
  );
};

export default AppSidebar;
