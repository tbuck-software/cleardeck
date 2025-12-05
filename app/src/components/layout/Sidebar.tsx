import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGaugeHigh, faUsers, faGear, faCode } from '@fortawesome/free-solid-svg-icons';
import type { Page } from '../../types/ui';
import type { UpdateStatus } from '../../shared/types';

type SidebarProps = {
  current: Page;
  onNavigate: (page: Page) => void;
  updateStatus: UpdateStatus;
  onInstallUpdate: () => void;
  onSnoozeUpdate: () => void;
  snoozed: boolean;
};

const Sidebar = ({
  current,
  onNavigate,
  updateStatus,
  onInstallUpdate,
  onSnoozeUpdate,
  snoozed,
}: SidebarProps) => {
  const navItems: { key: Page; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: faGaugeHigh },
    { key: 'list', label: 'Mitarbeitende', icon: faUsers },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">DB</div>
        <div>
          <div className="brand-title">Employee DB</div>
          <div className="brand-sub">VZAE & Historie</div>
        </div>
      </div>
      <nav className="nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${current === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <FontAwesomeIcon icon={item.icon} /> {item.label}
          </button>
        ))}
      </nav>
      <div className="nav-footer">
        {!snoozed && updateStatus.state === 'downloaded' && (
          <div className="update-pill">
            <button className="update-pill-close" onClick={onSnoozeUpdate} title="Schließen">
              ×
            </button>
            <div className="update-pill-text">
              <p className="eyebrow">Update</p>
              <strong>{updateStatus.version ? `v${updateStatus.version}` : 'Update'}</strong> bereit
            </div>
            <button className="primary small" onClick={onInstallUpdate} title="Neustart und Installation">
              Installieren
            </button>
          </div>
        )}
        <button className={`nav-item ${current === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')}>
          <FontAwesomeIcon icon={faGear} /> Einstellungen
        </button>
        {process.env.NODE_ENV === 'development' && (
          <button className={`nav-item ${current === 'dev' ? 'active' : ''}`} onClick={() => onNavigate('dev')}>
            <FontAwesomeIcon icon={faCode} /> DEV
          </button>
        )}
        <div className="nav-hint">Links: Seiten, rechts: Jahr/Export</div>
      </div>
    </aside>
  );
};

export default Sidebar;
