import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
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
  faCog,
  faInfoCircle,
  faEnvelope
} from '@fortawesome/free-solid-svg-icons';
import type {
  CompetencyDefinition,
  InstructionDefinition,
  QualificationType,
  UpdateStatus,
  AppInfo,
  StorageMode,
} from '../../shared/types';
import type {
  CompetencyModalPayload,
  EncryptionSetupState,
  InstructionModalPayload,
  QualificationModalPayload,
} from '../../types/ui';
import logoUrl from '../../assets/logo.png';

type SettingsPageProps = {
  qualifications: QualificationType[];
  competencies: CompetencyDefinition[];
  instructions: InstructionDefinition[];
  qualificationEdits: Record<number, string>;
  competencyEdits: Record<number, string>;
  dbMessage: string | null;
  baseHoursInput: string;
  updateStatus: UpdateStatus;
  lastUpdateCheckAt: string | null;
  appInfo: AppInfo | null;
  storageMode: StorageMode;
  encryptionSetup: EncryptionSetupState;
  onOpenQualificationModal: (payload: QualificationModalPayload) => void;
  onOpenCompetencyModal: (payload: CompetencyModalPayload) => void;
  onOpenInstructionModal: (payload: InstructionModalPayload) => void;
  onReorderQualification: (orderedIds: number[]) => void | Promise<void>;
  onReorderCompetency: (orderedIds: number[]) => void | Promise<void>;
  onReorderInstruction: (orderedIds: number[]) => void | Promise<void>;
  onDeleteQualification: (id: number) => void;
  onDeleteCompetency: (id: number) => void;
  onDeleteInstruction: (id: number) => void;
  onBaseHoursInputChange: (val: string) => void;
  onSaveBaseHours: () => void | Promise<void>;
  onDbExport: (mode: 'encrypted' | 'plain') => void | Promise<void>;
  onDbImport: (mode: 'encrypted' | 'plain') => void | Promise<void>;
  onOpenRecoveryKey: () => void;
  onOpenEnableEncryption: () => void;
  onCloseEnableEncryption: () => void;
  onEncryptionSetupChange: (next: Partial<EncryptionSetupState>) => void;
  onEnableEncryption: () => void | Promise<void>;
  onDisableEncryption: () => void | Promise<void>;
  onCheckUpdates: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
  onDropDatabase: () => void | Promise<void>;
  onFullReset: () => void | Promise<void>;
};

type TabId =
  | 'general'
  | 'qualifications'
  | 'competencies'
  | 'instructions'
  | 'database'
  | 'danger'
  | 'info';

const SettingsPage = ({
  qualifications,
  competencies,
  instructions,
  qualificationEdits,
  competencyEdits,
  dbMessage,
  baseHoursInput,
  updateStatus,
  lastUpdateCheckAt,
  appInfo,
  storageMode,
  encryptionSetup,
  onOpenQualificationModal,
  onOpenCompetencyModal,
  onOpenInstructionModal,
  onReorderQualification,
  onReorderCompetency,
  onReorderInstruction,
  onDeleteQualification,
  onDeleteCompetency,
  onDeleteInstruction,
  onBaseHoursInputChange,
  onSaveBaseHours,
  onDbExport,
  onDbImport,
  onOpenRecoveryKey,
  onOpenEnableEncryption,
  onCloseEnableEncryption,
  onEncryptionSetupChange,
  onEnableEncryption,
  onDisableEncryption,
  onCheckUpdates,
  onInstallUpdate,
  onDropDatabase,
  onFullReset,
}: SettingsPageProps) => {
  const [dragQualificationId, setDragQualificationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const currentVersion = appInfo ? `v${appInfo.version}` : 'unbekannt';
  const availableVersion =
    'version' in updateStatus && updateStatus.version ? `v${updateStatus.version}` : null;
  const releasesUrl = appInfo ? `${appInfo.github.replace(/\/$/, '')}/releases` : null;
  const targetReleaseUrl =
    appInfo && availableVersion
      ? `${appInfo.github.replace(/\/$/, '')}/releases/tag/${availableVersion}`
      : releasesUrl;
  const lastCheckLabel = lastUpdateCheckAt
    ? new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastUpdateCheckAt))
    : 'noch keine';

  const updateCopy = (() => {
    if (updateStatus.state === 'available') {
      return `Update ${availableVersion ?? ''} verfuegbar. Aktiv installiert ist weiterhin ${currentVersion}.`;
    }
    if (updateStatus.state === 'downloading') {
      return `Lade ${availableVersion ?? 'Update'} (${Math.round(updateStatus.progress ?? 0)}%) ... Aktuell laeuft ${currentVersion}.`;
    }
    if (updateStatus.state === 'downloaded') {
      return `${availableVersion ?? 'Das Update'} ist heruntergeladen. Aktiv bleibt ${currentVersion}, bis du installierst und neu startest.`;
    }
    if (updateStatus.state === 'not-available') {
      return `Keine neueren Updates gefunden. Installiert ist ${currentVersion}.`;
    }
    if (updateStatus.state === 'error') {
      return `Update-Fehler: ${updateStatus.message}`;
    }
    return `Installiert ist ${currentVersion}. Updates werden beim Start, stuendlich und bei Fokus geprueft.`;
  })();

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'general', label: 'Allgemein', icon: faCog },
    { id: 'qualifications', label: 'Qualifikationen', icon: faList },
    { id: 'competencies', label: 'Kompetenzen', icon: faList },
    { id: 'instructions', label: 'Einweisungen', icon: faList },
    { id: 'database', label: 'Datenbank & Sicherheit', icon: faDatabase },
    { id: 'danger', label: 'Gefahrenzone', icon: faExclamationTriangle },
    { id: 'info', label: 'Info', icon: faInfoCircle },
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
                      Installieren & neu starten
                    </button>
                  )}
                </div>
                <div className="form-grid" style={{ gap: 6 }}>
                  <p className="subtitle small" style={{ margin: 0 }}>
                    Installierte Version: <strong>{currentVersion}</strong>
                  </p>
                  <p className="subtitle small" style={{ margin: 0 }}>
                    Letzte Pruefung: <strong>{lastCheckLabel}</strong>
                  </p>
                  {availableVersion && (
                    <p className="subtitle small" style={{ margin: 0 }}>
                      Zielversion: <strong>{availableVersion}</strong>
                    </p>
                  )}
                </div>
                <p className="subtitle small">
                  {updateCopy}
                </p>
                {targetReleaseUrl && (
                  <a
                    href={targetReleaseUrl}
                    className="ghost-button"
                    target="_blank"
                    rel="noreferrer"
                    style={{ textAlign: 'center' }}
                  >
                    Release auf GitHub oeffnen
                  </a>
                )}
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
                    <th>Kürzel</th>
                    <th>Name</th>
                    <th>Kategorie</th>
                    <th>Relevanz</th>
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

        {activeTab === 'competencies' && (
          <div className="card form-card">
            <div className="form-header">
              <div>
                <p className="eyebrow">Verwaltung</p>
                <h3>Kompetenzen</h3>
              </div>
              <button
                className="primary"
                onClick={() =>
                  onOpenCompetencyModal({
                    id: undefined,
                    code: '',
                    value: '',
                    category: 'Allgemein',
                    relevance: 'Alle',
                    note: '',
                  })
                }
              >
                <FontAwesomeIcon icon={faPlus} /> Neu
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Kürzel</th>
                    <th>Name</th>
                    <th>Kategorie</th>
                    <th>Relevanz</th>
                    <th>Notiz</th>
                    <th style={{ width: 80 }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {competencies.map((item) => (
                    <tr
                      key={item.id ?? item.name}
                      className="clickable-row"
                      draggable={!!item.id}
                      onDragStart={() => setDragQualificationId(item.id ?? null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragQualificationId || !item.id || dragQualificationId === item.id) return;
                        const orderedIds = competencies.map((entry) => entry.id!).filter(Boolean);
                        const from = orderedIds.indexOf(dragQualificationId);
                        const to = orderedIds.indexOf(item.id);
                        if (from === -1 || to === -1) return;
                        const reordered = [...orderedIds];
                        const [moved] = reordered.splice(from, 1);
                        reordered.splice(to, 0, moved);
                        onReorderCompetency(reordered);
                      }}
                      onClick={() =>
                        item.id &&
                        onOpenCompetencyModal({
                          id: item.id as number,
                          code: item.code ?? '',
                          value: competencyEdits[item.id as number] ?? item.name,
                          category: item.category ?? 'Allgemein',
                          relevance: item.relevance ?? 'Alle',
                          note: item.note ?? '',
                        })
                      }
                    >
                      <td>{item.code ?? '—'}</td>
                      <td>{item.name}</td>
                      <td>{item.category ?? 'Allgemein'}</td>
                      <td>{item.relevance ?? 'Alle'}</td>
                      <td className="muted">{item.note ?? '—'}</td>
                      <td>
                        {item.id && (
                          <button
                            className="ghost-button danger icon-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCompetency(item.id as number);
                            }}
                            title="Löschen"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {competencies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        Keine Kompetenzen hinterlegt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'instructions' && (
          <div className="card form-card">
            <div className="form-header">
              <div>
                <p className="eyebrow">Verwaltung</p>
                <h3>Einweisungen</h3>
              </div>
              <button
                className="primary"
                onClick={() =>
                  onOpenInstructionModal({
                    topic: '',
                    legalBasis: '',
                    note: '',
                    id: undefined,
                  })
                }
              >
                <FontAwesomeIcon icon={faPlus} /> Neu
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Thema</th>
                    <th>Grundlage</th>
                    <th>Notiz</th>
                    <th style={{ width: 80 }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {instructions.map((item) => (
                    <tr
                      key={item.id ?? item.topic}
                      className="clickable-row"
                      draggable={!!item.id}
                      onDragStart={() => setDragQualificationId(item.id ?? null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragQualificationId || !item.id || dragQualificationId === item.id) return;
                        const orderedIds = instructions.map((entry) => entry.id!).filter(Boolean);
                        const from = orderedIds.indexOf(dragQualificationId);
                        const to = orderedIds.indexOf(item.id);
                        if (from === -1 || to === -1) return;
                        const reordered = [...orderedIds];
                        const [moved] = reordered.splice(from, 1);
                        reordered.splice(to, 0, moved);
                        onReorderInstruction(reordered);
                      }}
                      onClick={() =>
                        item.id &&
                        onOpenInstructionModal({
                          id: item.id as number,
                          topic: item.topic,
                          legalBasis: item.legalBasis ?? '',
                          note: item.note ?? '',
                        })
                      }
                    >
                      <td>{item.topic}</td>
                      <td>{item.legalBasis ?? '—'}</td>
                      <td className="muted">{item.note ?? '—'}</td>
                      <td>
                        {item.id && (
                          <button
                            className="ghost-button danger icon-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteInstruction(item.id as number);
                            }}
                            title="Löschen"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {instructions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        Keine Einweisungen hinterlegt.
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
                  <button
                    className="ghost-button"
                    onClick={() => onDbExport('encrypted')}
                    disabled={storageMode !== 'encrypted'}
                  >
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
                  <button
                    className="ghost-button danger"
                    onClick={() => onDbImport('encrypted')}
                    disabled={storageMode !== 'encrypted'}
                  >
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
                <p className="subtitle small" style={{ margin: 0 }}>
                  Speichermodus: <strong>{storageMode === 'encrypted' ? 'Verschlüsselt' : 'Unverschlüsselt'}</strong>
                </p>
                {storageMode === 'encrypted' ? (
                  <>
                    <button className="ghost-button" onClick={onOpenRecoveryKey} style={{ justifyContent: 'flex-start' }}>
                      <FontAwesomeIcon icon={faKey} /> Recovery Key anzeigen
                    </button>
                    <button className="ghost-button danger" onClick={onDisableEncryption} style={{ justifyContent: 'flex-start' }}>
                      <FontAwesomeIcon icon={faShieldAlt} /> Verschlüsselung deaktivieren
                    </button>
                  </>
                ) : (
                  <button className="primary" onClick={onOpenEnableEncryption} style={{ justifyContent: 'flex-start' }}>
                    <FontAwesomeIcon icon={faShieldAlt} /> Verschlüsselung aktivieren
                  </button>
                )}
                <p className="subtitle small">
                  {storageMode === 'encrypted'
                    ? 'Sicher offline ablegen. Wer den Key besitzt, kann alle Daten ohne Passwort lesen.'
                    : 'Im unverschlüsselten Modus gibt es keinen Recovery Key. Die Datenbank liegt lokal ohne Passwortschutz vor.'}
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

        {activeTab === 'info' && (
          <div className="card form-card">
            {appInfo ? (
              <div className="about-page">
                <div className="about-header">
                  <div className="about-logo">
                    <img src={logoUrl} alt="ClearDeck Logo" />
                  </div>
                  <div className="about-title-group">
                    <div className="about-title-wrapper">
                      <h2 className="about-app-name">{appInfo.name}</h2>
                      <span className="about-version">v{appInfo.version}</span>
                    </div>
                    <p className="about-desc">Verwaltungstool</p>
                  </div>
                </div>

                <div className="about-grid">
                  <div className="about-card">
                    <h4 className="about-section-header">Projekt</h4>
                    <div className="about-details-list">
                      <div className="about-row">
                        <span className="about-label">Entwickler</span>
                        <span className="about-value">{appInfo.author}</span>
                      </div>
                      <div className="about-row">
                        <span className="about-label">Lizenz</span>
                        <span className="about-value">{appInfo.license}</span>
                      </div>
                      <div className="about-row">
                        <span className="about-label">Copyright</span>
                        <span className="about-value">{appInfo.copyright}</span>
                      </div>
                    </div>
                  </div>

                  <div className="about-card">
                    <h4 className="about-section-header">Links</h4>
                    <div className="about-links">
                      <a href={`mailto:${appInfo.email}`} className="about-link-button">
                        <span className="link-icon">
                          <FontAwesomeIcon icon={faEnvelope} />
                        </span>
                        Support kontaktieren
                      </a>
                      <a
                        href={appInfo.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="about-link-button"
                      >
                        <span className="link-icon">
                          <FontAwesomeIcon icon={faGithub} />
                        </span>
                        GitHub Repository
                      </a>
                    </div>
                  </div>

                  <div className="system-info-wrapper">
                    <h4 className="about-section-header">Systemumgebung</h4>
                    <div className="system-info-badges">
                      <div className="sys-badge">
                        <span className="sys-label">Electron</span>
                        <span className="sys-val">v{appInfo.electronVersion}</span>
                      </div>
                      <div className="sys-badge">
                        <span className="sys-label">Node.js</span>
                        <span className="sys-val">v{appInfo.nodeVersion}</span>
                      </div>
                      <div className="sys-badge">
                        <span className="sys-label">Platform</span>
                        <span className="sys-val">{appInfo.platform}</span>
                      </div>
                      <div className="sys-badge">
                        <span className="sys-label">Arch</span>
                        <span className="sys-val">{appInfo.arch}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                <p className="subtitle">Lade App-Informationen...</p>
              </div>
            )}
          </div>
        )}
      </div>
      {encryptionSetup.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={faShieldAlt} />
            </div>
            <h3>Verschlüsselung aktivieren</h3>
            <div className="modal-body">
              <p className="modal-text">
                Lege ein Passwort fest. Danach wird beim Start wieder ein Login verlangt und ein Recovery Key bereitgestellt.
              </p>
              <label className="full-width">
                Passwort
                <input
                  type="password"
                  value={encryptionSetup.password}
                  onChange={(e) => onEncryptionSetupChange({ password: e.target.value, error: null })}
                  placeholder="Neues Passwort"
                />
              </label>
              <label className="full-width">
                Wiederholen
                <input
                  type="password"
                  value={encryptionSetup.repeat}
                  onChange={(e) => onEncryptionSetupChange({ repeat: e.target.value, error: null })}
                  placeholder="Wiederholen"
                />
              </label>
              {encryptionSetup.error && <div className="error">{encryptionSetup.error}</div>}
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={onCloseEnableEncryption}>
                Abbrechen
              </button>
              <button className="primary" onClick={onEnableEncryption}>
                Aktivieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
