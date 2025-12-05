import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faTrash,
  faKey,
  faDatabase,
  faShieldAlt,
  faSync,
  faList,
  faDownload,
  faUpload,
  faExclamationTriangle,
  faClock,
  faCog
} from '@fortawesome/free-solid-svg-icons';
import type { QualificationType, UpdateStatus } from '../../shared/types';
import type { QualificationModalPayload } from '../../types/ui';

type SettingsPageProps = {
  qualifications: QualificationType[];
  qualificationEdits: Record<number, string>;
  dbMessage: string | null;
  baseHoursInput: string;
  updateStatus: UpdateStatus;
  onOpenQualificationModal: (payload: QualificationModalPayload) => void;
  onReorderQualification: (orderedIds: number[]) => void | Promise<void>;
  onDeleteQualification: (id: number) => void;
  onBaseHoursInputChange: (val: string) => void;
  onSaveBaseHours: () => void | Promise<void>;
  onDbExport: (mode: 'encrypted' | 'plain') => void | Promise<void>;
  onDbImport: (mode: 'encrypted' | 'plain') => void | Promise<void>;
  onOpenRecoveryKey: () => void;
  onCheckUpdates: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
  onDropDatabase: () => void | Promise<void>;
  onFullReset: () => void | Promise<void>;
};

type TabId = 'general' | 'qualifications' | 'database' | 'danger';

const SettingsPage = ({
  qualifications,
  qualificationEdits,
  dbMessage,
  baseHoursInput,
  updateStatus,
  onOpenQualificationModal,
  onReorderQualification,
  onDeleteQualification,
  onBaseHoursInputChange,
  onSaveBaseHours,
  onDbExport,
  onDbImport,
  onOpenRecoveryKey,
  onCheckUpdates,
  onInstallUpdate,
  onDropDatabase,
  onFullReset,
}: SettingsPageProps) => {
  const [dragQualificationId, setDragQualificationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'general', label: 'Allgemein', icon: faCog },
    { id: 'qualifications', label: 'Qualifikationen', icon: faList },
    { id: 'database', label: 'Datenbank & Sicherheit', icon: faDatabase },
    { id: 'danger', label: 'Gefahrenzone', icon: faExclamationTriangle },
  ];

  return (
    <div className="settings-layout">
      <div className="settings-sidebar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <FontAwesomeIcon icon={tab.icon} style={{ width: 20 }} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <>
            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">
                    <FontAwesomeIcon icon={faClock} style={{ marginRight: 8 }} /> Arbeitszeit
                  </p>
                  <h3>Konfiguration</h3>
                </div>
              </div>
              <div className="form-grid">
                <label className="full-width">
                  Basis-Wochenstunden für VZÄ (Default 36)
                  <div className="inline-row" style={{ marginTop: 8 }}>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={baseHoursInput}
                      onChange={(e) => onBaseHoursInputChange(e.target.value)}
                    />
                    <button className="ghost-button" onClick={onSaveBaseHours}>
                      Speichern
                    </button>
                  </div>
                </label>
              </div>
            </div>

            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">
                    <FontAwesomeIcon icon={faSync} style={{ marginRight: 8 }} /> System
                  </p>
                  <h3>Software Updates</h3>
                </div>
              </div>
              <div className="form-grid">
                <div className="inline-row">
                  <button
                    className="ghost-button"
                    onClick={onCheckUpdates}
                    disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                    style={{ width: '100%' }}
                  >
                    {updateStatus.state === 'checking' ? 'Suche …' : 'Nach Updates suchen'}
                  </button>
                  {updateStatus.state === 'downloaded' && (
                    <button className="primary" onClick={onInstallUpdate}>
                      Installieren
                    </button>
                  )}
                </div>
                <p className="subtitle small">
                  {updateStatus.state === 'available' && `Update ${updateStatus.version ? `v${updateStatus.version}` : ''} verfügbar.`}
                  {updateStatus.state === 'downloading' &&
                    `Lade ${updateStatus.version ? `v${updateStatus.version}` : 'Update'} (${Math.round(updateStatus.progress ?? 0)}%) …`}
                  {updateStatus.state === 'downloaded' &&
                    `Update ${updateStatus.version ? `v${updateStatus.version}` : ''} heruntergeladen.`}
                  {updateStatus.state === 'not-available' && 'Keine neueren Updates gefunden.'}
                  {updateStatus.state === 'error' && `Update-Fehler: ${updateStatus.message}`}
                  {updateStatus.state === 'idle' && 'Updates werden beim Start, stündlich und bei Fokus geprüft.'}
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'qualifications' && (
          <div className="card form-card">
            <div className="form-header">
              <div>
                <p className="eyebrow">Verwaltung</p>
                <h3>Qualifikationen</h3>
              </div>
              <button
                className="primary"
                onClick={() => onOpenQualificationModal({ value: '', note: '', id: undefined })}
              >
                <FontAwesomeIcon icon={faPlus} /> Neu
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Notiz</th>
                    <th style={{ width: 80 }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {qualifications.map((q) => (
                    <tr
                      key={q.id ?? q.name}
                      className="clickable-row"
                      draggable={!!q.id}
                      onDragStart={() => setDragQualificationId(q.id ?? null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragQualificationId || !q.id || dragQualificationId === q.id) return;
                        const orderedIds = qualifications.map((item) => item.id!).filter(Boolean);
                        const from = orderedIds.indexOf(dragQualificationId);
                        const to = orderedIds.indexOf(q.id);
                        if (from === -1 || to === -1) return;
                        const reordered = [...orderedIds];
                        const [moved] = reordered.splice(from, 1);
                        reordered.splice(to, 0, moved);
                        onReorderQualification(reordered);
                      }}
                      onClick={() =>
                        q.id &&
                        onOpenQualificationModal({
                          id: q.id as number,
                          value: qualificationEdits[q.id as number] ?? q.name,
                          note: q.note ?? '',
                        })
                      }
                    >
                      <td>{q.name}</td>
                      <td className="muted">{q.note ?? '—'}</td>
                      <td>
                        {q.id && (
                          <button
                            className="ghost-button danger icon-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteQualification(q.id as number);
                            }}
                            title="Löschen"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {qualifications.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty">
                        Keine Qualifikationen hinterlegt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <>
            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">
                    <FontAwesomeIcon icon={faDatabase} style={{ marginRight: 8 }} /> Datenbank
                  </p>
                  <h3>Wartung & Backup</h3>
                </div>
              </div>
              <div className="form-grid">
                <label className="full-width">Exportieren</label>
                <div className="inline-row">
                  <button className="ghost-button" onClick={() => onDbExport('plain')}>
                    <FontAwesomeIcon icon={faDownload} /> SQL
                  </button>
                  <button className="ghost-button" onClick={() => onDbExport('encrypted')}>
                    <FontAwesomeIcon icon={faDownload} /> Verschlüsselt
                  </button>
                </div>
                <label className="full-width" style={{ color: 'var(--danger)' }}>
                  Importieren
                </label>
                <div className="inline-row">
                  <button className="ghost-button danger" onClick={() => onDbImport('plain')}>
                    <FontAwesomeIcon icon={faUpload} /> SQL Import
                  </button>
                  <button className="ghost-button danger" onClick={() => onDbImport('encrypted')}>
                    <FontAwesomeIcon icon={faUpload} /> Verschlüsselt Import
                  </button>
                </div>
                <p className="subtitle small">
                  Import ersetzt die lokale Datenbank. Verschlüsselte Importe erwarten das aktuelle App-Passwort.
                </p>
                {dbMessage && <p className="subtitle small success-text">{dbMessage}</p>}
              </div>
            </div>

            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">
                    <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: 8 }} /> Sicherheit
                  </p>
                  <h3>Zugriff & Keys</h3>
                </div>
              </div>
              <div className="form-grid">
                <button className="ghost-button" onClick={onOpenRecoveryKey} style={{ justifyContent: 'flex-start' }}>
                  <FontAwesomeIcon icon={faKey} /> Recovery Key anzeigen
                </button>
                <p className="subtitle small">
                  Sicher offline ablegen. Wer den Key besitzt, kann alle Daten ohne Passwort lesen.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'danger' && (
          <div className="card danger-card">
            <div className="form-header">
              <div>
                <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: 8 }} /> Danger Zone
                </p>
                <h3 style={{ color: 'white' }}>Unwiderrufliches</h3>
              </div>
            </div>
            <div className="danger-actions">
              <div>
                <h4 style={{ color: 'white' }}>Datenbank löschen</h4>
                <p className="subtitle small" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Entfernt die lokale Datenbank, das Passwort bleibt erhalten.
                </p>
              </div>
              <button className="ghost-button danger" onClick={onDropDatabase}>
                Löschen
              </button>
            </div>
            <div className="danger-actions">
              <div>
                <h4 style={{ color: 'white' }}>App Reset</h4>
                <p className="subtitle small" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Löscht Datenbank und Konfiguration.
                </p>
              </div>
              <button className="ghost-button danger" onClick={onFullReset}>
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
