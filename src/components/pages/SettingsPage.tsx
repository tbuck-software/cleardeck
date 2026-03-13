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

type SettingsSectionProps = {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
};

type CollectionEntryProps = {
  title: string;
  meta?: string[];
  note?: string | null;
  draggable?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLElement>) => void;
};

const SettingsSection = ({ eyebrow, title, subtitle, actions, tone = 'default', children }: SettingsSectionProps) => (
  <section className={`settings-section ${tone === 'danger' ? 'settings-section-danger' : ''}`}>
    <div className="settings-section-head">
      <div className="settings-section-copy">
        {eyebrow && <p className="eyebrow settings-eyebrow">{eyebrow}</p>}
        <h3 className="settings-section-title">{title}</h3>
        {subtitle && <p className="settings-section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="settings-section-cta">{actions}</div>}
    </div>
    <div className="settings-section-body">{children}</div>
  </section>
);

const CollectionEntry = ({
  title,
  meta = [],
  note,
  draggable,
  onOpen,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: CollectionEntryProps) => (
  <article
    className="settings-list-item"
    draggable={draggable}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <button type="button" className="settings-list-main" onClick={onOpen}>
      <div className="settings-list-title-row">
        <strong>{title}</strong>
        {meta.length > 0 && (
          <div className="settings-list-tags">
            {meta.map((entry) => (
              <span key={entry} className="settings-list-tag">
                {entry}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="settings-list-note">{note && note.trim().length > 0 ? note : 'Keine Notiz'}</p>
    </button>
    {onDelete && (
      <button
        type="button"
        className="ghost-button danger icon-button settings-list-delete"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title="Löschen"
      >
        <FontAwesomeIcon icon={faTrash} />
      </button>
    )}
  </article>
);

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
  const [dragItemId, setDragItemId] = useState<number | null>(null);
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

  const tabs: { id: TabId; label: string; icon: any; description: string }[] = [
    { id: 'general', label: 'Allgemein', icon: faCog, description: 'Arbeitszeit, Updates und Grundkonfiguration.' },
    { id: 'qualifications', label: 'Qualifikationen', icon: faList, description: 'Pflegeprofile und Sortierung pflegen.' },
    { id: 'competencies', label: 'Kompetenzen', icon: faList, description: 'Fachthemen, Relevanz und Kategorien steuern.' },
    { id: 'instructions', label: 'Einweisungen', icon: faList, description: 'Unterweisungen zentral verwalten und sortieren.' },
    { id: 'database', label: 'Datenbank & Sicherheit', icon: faDatabase, description: 'Backups, Import und Zugriffsschutz.' },
    { id: 'danger', label: 'Gefahrenzone', icon: faExclamationTriangle, description: 'Irreversible Aktionen mit voller Absicht.' },
    { id: 'info', label: 'Info', icon: faInfoCircle, description: 'Version, Links und Systemumgebung.' },
  ];

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="settings-layout">
      <div className="settings-sidebar">
        <div className="settings-sidebar-head">
          <p className="settings-sidebar-kicker">Steuerzentrale</p>
          <h2>Einstellungen</h2>
        </div>
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
        <div className="settings-page-head">
          <div>
            <p className="settings-page-kicker">{activeTabConfig.label}</p>
            <h2>{activeTabConfig.label}</h2>
          </div>
          <p className="settings-page-summary">{activeTabConfig.description}</p>
        </div>
        {activeTab === 'general' && (
          <div className="settings-stack">
            <SettingsSection
              eyebrow={<><FontAwesomeIcon icon={faClock} style={{ marginRight: 8 }} /> Arbeitszeit</>}
              title="Basis für VZÄ"
              subtitle="Der Referenzwert für Auswertungen und Personalquoten."
            >
              <div className="settings-split-panel">
                <div className="settings-highlight-tile">
                  <span>Aktuell</span>
                  <strong>{baseHoursInput || '36'}</strong>
                  <em>Std./Woche</em>
                </div>
                <label className="settings-inline-field">
                  Basis-Wochenstunden
                  <div className="settings-inline-action">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={baseHoursInput}
                      onChange={(e) => onBaseHoursInputChange(e.target.value)}
                    />
                    <button className="primary" onClick={onSaveBaseHours}>
                      Speichern
                    </button>
                  </div>
                </label>
              </div>
            </SettingsSection>

            <SettingsSection
              eyebrow={<><FontAwesomeIcon icon={faSync} style={{ marginRight: 8 }} /> System</>}
              title="Software Updates"
              subtitle={updateCopy}
            >
              <div className="settings-action-band">
                <button
                  className="ghost-button"
                  onClick={onCheckUpdates}
                  disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
                >
                  {updateStatus.state === 'checking' ? 'Suche …' : 'Nach Updates suchen'}
                </button>
                {updateStatus.state === 'downloaded' && (
                  <button className="primary" onClick={onInstallUpdate}>
                    Installieren & neu starten
                  </button>
                )}
                {targetReleaseUrl && (
                  <a
                    href={targetReleaseUrl}
                    className="ghost-button settings-link-button"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Release auf GitHub öffnen
                  </a>
                )}
              </div>
              <div className="settings-meta-grid">
                <div className="settings-meta-item">
                  <span>Installiert</span>
                  <strong>{currentVersion}</strong>
                </div>
                <div className="settings-meta-item">
                  <span>Letzte Prüfung</span>
                  <strong>{lastCheckLabel}</strong>
                </div>
                {availableVersion && (
                  <div className="settings-meta-item">
                    <span>Zielversion</span>
                    <strong>{availableVersion}</strong>
                  </div>
                )}
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === 'qualifications' && (
          <SettingsSection
            eyebrow="Verwaltung"
            title="Qualifikationen"
            subtitle={`${qualifications.length} Einträge. Ziehen zum Sortieren, antippen zum Bearbeiten.`}
            actions={
              <button
                className="primary"
                onClick={() => onOpenQualificationModal({ value: '', note: '', id: undefined })}
              >
                <FontAwesomeIcon icon={faPlus} /> Neu
              </button>
            }
          >
            <div className="settings-list">
              {qualifications.map((q) => (
                <CollectionEntry
                  key={q.id ?? q.name}
                  title={q.name}
                  note={q.note}
                  meta={q.id ? [`#${q.id}`] : []}
                  draggable={!!q.id}
                  onDragStart={() => setDragItemId(q.id ?? null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragItemId || !q.id || dragItemId === q.id) return;
                    const orderedIds = qualifications.map((item) => item.id!).filter(Boolean);
                    const from = orderedIds.indexOf(dragItemId);
                    const to = orderedIds.indexOf(q.id);
                    if (from === -1 || to === -1) return;
                    const reordered = [...orderedIds];
                    const [moved] = reordered.splice(from, 1);
                    reordered.splice(to, 0, moved);
                    onReorderQualification(reordered);
                  }}
                  onOpen={() =>
                    q.id &&
                    onOpenQualificationModal({
                      id: q.id as number,
                      value: qualificationEdits[q.id as number] ?? q.name,
                      note: q.note ?? '',
                    })
                  }
                  onDelete={q.id ? () => onDeleteQualification(q.id as number) : undefined}
                />
              ))}
              {qualifications.length === 0 && <div className="settings-empty-state">Keine Qualifikationen hinterlegt.</div>}
            </div>
          </SettingsSection>
        )}

        {activeTab === 'competencies' && (
          <SettingsSection
            eyebrow="Verwaltung"
            title="Kompetenzen"
            subtitle={`${competencies.length} Einträge. Kategorien und Relevanz direkt im Überblick.`}
            actions={
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
            }
          >
            <div className="settings-list">
              {competencies.map((item) => (
                <CollectionEntry
                  key={item.id ?? item.name}
                  title={item.name}
                  note={item.note}
                  meta={[item.code, item.category ?? 'Allgemein', item.relevance ?? 'Alle'].filter(Boolean) as string[]}
                  draggable={!!item.id}
                  onDragStart={() => setDragItemId(item.id ?? null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragItemId || !item.id || dragItemId === item.id) return;
                    const orderedIds = competencies.map((entry) => entry.id!).filter(Boolean);
                    const from = orderedIds.indexOf(dragItemId);
                    const to = orderedIds.indexOf(item.id);
                    if (from === -1 || to === -1) return;
                    const reordered = [...orderedIds];
                    const [moved] = reordered.splice(from, 1);
                    reordered.splice(to, 0, moved);
                    onReorderCompetency(reordered);
                  }}
                  onOpen={() =>
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
                  onDelete={item.id ? () => onDeleteCompetency(item.id as number) : undefined}
                />
              ))}
              {competencies.length === 0 && <div className="settings-empty-state">Keine Kompetenzen hinterlegt.</div>}
            </div>
          </SettingsSection>
        )}

        {activeTab === 'instructions' && (
          <SettingsSection
            eyebrow="Verwaltung"
            title="Einweisungen"
            subtitle={`${instructions.length} Einträge. Rechtsgrundlagen und Hinweise bleiben sichtbar.`}
            actions={
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
            }
          >
            <div className="settings-list">
              {instructions.map((item) => (
                <CollectionEntry
                  key={item.id ?? item.topic}
                  title={item.topic}
                  note={item.note}
                  meta={[item.legalBasis ?? 'Ohne Grundlage'].filter(Boolean) as string[]}
                  draggable={!!item.id}
                  onDragStart={() => setDragItemId(item.id ?? null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragItemId || !item.id || dragItemId === item.id) return;
                    const orderedIds = instructions.map((entry) => entry.id!).filter(Boolean);
                    const from = orderedIds.indexOf(dragItemId);
                    const to = orderedIds.indexOf(item.id);
                    if (from === -1 || to === -1) return;
                    const reordered = [...orderedIds];
                    const [moved] = reordered.splice(from, 1);
                    reordered.splice(to, 0, moved);
                    onReorderInstruction(reordered);
                  }}
                  onOpen={() =>
                    item.id &&
                    onOpenInstructionModal({
                      id: item.id as number,
                      topic: item.topic,
                      legalBasis: item.legalBasis ?? '',
                      note: item.note ?? '',
                    })
                  }
                  onDelete={item.id ? () => onDeleteInstruction(item.id as number) : undefined}
                />
              ))}
              {instructions.length === 0 && <div className="settings-empty-state">Keine Einweisungen hinterlegt.</div>}
            </div>
          </SettingsSection>
        )}

        {activeTab === 'database' && (
          <div className="settings-stack">
            <SettingsSection
              eyebrow={<><FontAwesomeIcon icon={faDatabase} style={{ marginRight: 8 }} /> Datenbank</>}
              title="Wartung & Backup"
              subtitle="Export für Sicherungen, Import für vollständiges Ersetzen der lokalen Datenbank."
            >
              <div className="settings-dual-grid">
                <div className="settings-action-tile">
                  <span className="settings-tile-kicker">Export</span>
                  <strong>Lokale Sicherung erzeugen</strong>
                  <p>Im Alltag meist als SQL. Verschlüsselt nur im geschützten Modus.</p>
                  <div className="settings-action-band compact">
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
                </div>
                <div className="settings-action-tile settings-action-tile-warn">
                  <span className="settings-tile-kicker">Import</span>
                  <strong>Bestehende Daten ersetzen</strong>
                  <p>Der Import überschreibt die lokale Datenbank vollständig.</p>
                  <div className="settings-action-band compact">
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
                </div>
              </div>
              <div className="settings-inline-note">
                Verschlüsselte Importe erwarten das aktuelle App-Passwort.
              </div>
              {dbMessage && <div className="settings-inline-note success-text">{dbMessage}</div>}
            </SettingsSection>

            <SettingsSection
              eyebrow={<><FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: 8 }} /> Sicherheit</>}
              title="Zugriff & Keys"
              subtitle="App-Schutz und Recovery-Zugang für den lokalen Datenbestand."
            >
              <div className={`settings-security-band ${storageMode === 'plain' ? 'plain' : 'encrypted'}`}>
                <span className="settings-security-label">Speichermodus</span>
                <strong>{storageMode === 'encrypted' ? 'Verschlüsselt' : 'Unverschlüsselt'}</strong>
                <p>
                  {storageMode === 'encrypted'
                    ? 'Recovery Key separat und sicher offline ablegen.'
                    : 'Für Patientendaten nicht empfohlen.'}
                </p>
              </div>
              <div className="settings-action-band">
                {storageMode === 'encrypted' ? (
                  <>
                    <button className="ghost-button" onClick={onOpenRecoveryKey}>
                      <FontAwesomeIcon icon={faKey} /> Recovery Key anzeigen
                    </button>
                    <button className="ghost-button danger" onClick={onDisableEncryption}>
                      <FontAwesomeIcon icon={faShieldAlt} /> Verschlüsselung deaktivieren
                    </button>
                  </>
                ) : (
                  <button className="primary" onClick={onOpenEnableEncryption}>
                    <FontAwesomeIcon icon={faShieldAlt} /> Verschlüsselung aktivieren
                  </button>
                )}
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === 'danger' && (
          <SettingsSection
            eyebrow={<><FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: 8 }} /> Gefahrenzone</>}
            title="Unwiderrufliche Aktionen"
            subtitle="Diese Eingriffe löschen lokale Daten oder die komplette Konfiguration."
            tone="danger"
          >
            <div className="settings-danger-list">
              <div className="settings-danger-row">
                <div>
                  <h4>Datenbank löschen</h4>
                  <p>Entfernt nur die lokale Datenbank. Das Passwort bleibt erhalten.</p>
                </div>
                <button className="ghost-button danger" onClick={onDropDatabase}>
                  Löschen
                </button>
              </div>
              <div className="settings-danger-row">
                <div>
                  <h4>App Reset</h4>
                  <p>Löscht Datenbank und Konfiguration vollständig.</p>
                </div>
                <button className="ghost-button danger" onClick={onFullReset}>
                  Reset
                </button>
              </div>
            </div>
          </SettingsSection>
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
