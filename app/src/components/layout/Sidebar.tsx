import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGaugeHigh, faUsers, faGear, faCode, faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Page } from '../../types/ui';
import type { UpdateStatus } from '../../shared/types';
import logoUrl from '../../assets/logo.png';

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
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    setIsOpen(false);
  };

  const navItems: { key: Page; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: faGaugeHigh },
    { key: 'list', label: 'Team', icon: faUsers },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-logo-wrapper">
          <img src={logoUrl} alt="ClearDeck Logo" className="brand-logo" />
          <div>
            <div className="brand-title">ClearDeck</div>
            <div className="brand-sub">Verwaltungstool</div>
          </div>
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menü umschalten"
        >
          <FontAwesomeIcon icon={isOpen ? faXmark : faBars} />
        </button>
      </div>

      <div className={`sidebar-content ${isOpen ? 'show' : ''}`}>
        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${current === item.key ? 'active' : ''}`}
              onClick={() => handleNavigate(item.key)}
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
          <button
            className={`nav-item ${current === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavigate('settings')}
          >
            <FontAwesomeIcon icon={faGear} /> Einstellungen
          </button>
          {process.env.NODE_ENV === 'development' && (
            <button
              className={`nav-item ${current === 'dev' ? 'active' : ''}`}
              onClick={() => handleNavigate('dev')}
            >
              <FontAwesomeIcon icon={faCode} /> DEV
            </button>
          )}
          <div className="nav-hint">
            &copy; {new Date().getFullYear()} Torben Buck
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
