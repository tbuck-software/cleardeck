import React from 'react';
import Icon from '../../ui/Icon';
import Segmented from '../../ui/Segmented';
import { formatDateDE } from '../../../utils/dateFormat';
import type { EncryptionSetupState } from '../../../types/ui';
import type { AutoBackupMode, BackupState, StorageMode } from '../../../shared/types';

const AUTO_HINTS: Record<AutoBackupMode, string> = {
  off: 'Es wird nur gesichert, wenn du „Backup jetzt erstellen“ wählst.',
  close: 'Beim Schließen der App wird eine Sicherung geschrieben.',
  daily: 'Beim Schließen der App, sofern die letzte Sicherung über einen Tag her ist.',
  weekly: 'Beim Schließen der App, sofern die letzte Sicherung über eine Woche her ist.',
};

const relativeDay = (iso: string | null): string => {
  if (!iso) return 'noch nie';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 30) return `vor ${days} Tagen`;
  return formatDateDE(iso.slice(0, 10));
};

type RowProps = {
  title: string;
  note?: string;
  disabled?: boolean;
  onClick: () => void;
};

const Row = ({ title, note, disabled, onClick }: RowProps) => (
  <button type="button" className="cd-item" disabled={disabled} onClick={onClick}>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {note && <div className="cd-muted-13">{note}</div>}
    </div>
    <span className="cd-arrow">→</span>
  </button>
);

type SettingsSecurityProps = {
  storageMode: StorageMode;
  encryptionSetup: EncryptionSetupState;
  dbMessage: string | null;
  backup: BackupState;
  backupBusy: boolean;
  onRunBackup: () => void;
  onChooseBackupFolder: () => void;
  onBackupSettingsChange: (next: Partial<BackupState>) => void;
  onOpenExport: () => void;
  onOpenRestore: () => void;
  onOpenPassword: () => void;
  onOpenRecoveryKey: () => void;
  onOpenEnableEncryption: () => void;
  onDisableEncryption: () => void | Promise<void>;
  onDropDatabase: () => void | Promise<void>;
  onFullReset: () => void | Promise<void>;
};

const SettingsSecurity = ({
  storageMode,
  encryptionSetup,
  dbMessage,
  backup,
  backupBusy,
  onRunBackup,
  onChooseBackupFolder,
  onBackupSettingsChange,
  onOpenExport,
  onOpenRestore,
  onOpenPassword,
  onOpenRecoveryKey,
  onOpenEnableEncryption,
  onDisableEncryption,
  onDropDatabase,
  onFullReset,
}: SettingsSecurityProps) => {
  const encrypted = storageMode === 'encrypted';

  return (
    <div className="cd-page cd-narrow">
      <header>
        <h1 className="cd-h1" style={{ marginTop: 0 }}>
          Sicherheit &amp; Backup
        </h1>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span
          className={`tag ${encrypted ? 'tag-accent-2' : 'tag-bad'}`}
          style={{ fontWeight: 700 }}
        >
          {encrypted ? 'Verschlüsselt' : 'Unverschlüsselt'}
        </span>
        <span className="cd-muted-14">
          Letztes Backup {relativeDay(backup.lastBackupAt)} ·{' '}
          {backup.auto === 'off'
            ? 'kein automatisches Backup'
            : AUTO_HINTS[backup.auto].replace(/\.$/, '')}
        </span>
      </div>

      {backup.lastBackupError && (
        <p role="alert" className="cd-notice cd-notice-bad">
          Letztes automatisches Backup fehlgeschlagen: {backup.lastBackupError}
        </p>
      )}
      {encrypted && (
        <p className="cd-muted-13">
          Datenbank im Arbeitsspeicher; gespeicherte Änderungen werden verschlüsselt auf diesem
          Gerät gesichert.
        </p>
      )}
      {dbMessage && (
        <p className="cd-muted-14" style={{ margin: 0 }}>
          {dbMessage}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Row
          title={backupBusy ? 'Backup läuft …' : 'Backup jetzt erstellen'}
          note={
            backup.folder
              ? `${encrypted ? 'Verschlüsselt' : 'Unverschlüsselt'} nach ${backup.folder}`
              : 'Zuerst unten einen Backup-Ordner wählen'
          }
          disabled={!backup.folder || backupBusy}
          onClick={onRunBackup}
        />
        <Row
          title="Backup herunterladen…"
          note="Aktuellen Bestand verschlüsselt oder unverschlüsselt an einem Ort deiner Wahl ablegen"
          onClick={onOpenExport}
        />
        <Row
          title="Backup wiederherstellen…"
          note="Ersetzt den lokalen Bestand vollständig"
          onClick={onOpenRestore}
        />
        {encrypted && <Row title="Passwort ändern" onClick={onOpenPassword} />}
        {encrypted ? (
          <>
            <Row
              title="Recovery-Key anzeigen"
              note="Offline aufbewahren — einziger Weg bei vergessenem Passwort"
              onClick={onOpenRecoveryKey}
            />
            <Row
              title="Verschlüsselung deaktivieren"
              note="Die Datenbank liegt danach im Klartext auf diesem Gerät"
              onClick={() => void onDisableEncryption()}
            />
          </>
        ) : (
          <Row
            title="Verschlüsselung aktivieren"
            note="Passwort setzen und Recovery-Key erzeugen"
            onClick={onOpenEnableEncryption}
          />
        )}
      </div>

      {encryptionSetup.error && (
        <div className="cd-notice cd-notice-bad" role="alert">
          <Icon name="warning" />
          <span>{encryptionSetup.error}</span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          paddingTop: 8,
          borderTop: '1px solid var(--color-divider)',
        }}
      >
        <div className="field" style={{ marginTop: 14 }}>
          <label>Automatisches Backup</label>
          <Segmented
            ariaLabel="Automatisches Backup"
            options={[
              { value: 'off' as AutoBackupMode, label: 'Aus' },
              { value: 'close' as AutoBackupMode, label: 'Beim Schließen' },
              { value: 'daily' as AutoBackupMode, label: 'Täglich' },
              { value: 'weekly' as AutoBackupMode, label: 'Wöchentlich' },
            ]}
            value={backup.auto}
            onChange={(auto) => onBackupSettingsChange({ auto })}
          />
          <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
            {backup.folder ? AUTO_HINTS[backup.auto] : 'Ohne Backup-Ordner passiert nichts.'}
          </p>
        </div>

        <div className="field">
          <label htmlFor="backup-folder">Backup-Ordner</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="backup-folder"
              className="input"
              readOnly
              value={backup.folder ?? 'Kein Ordner gewählt'}
            />
            <button type="button" className="btn btn-secondary" onClick={onChooseBackupFolder}>
              Ändern
            </button>
          </div>
          {backup.backups.length > 0 && (
            <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
              {backup.backups.length} {backup.backups.length === 1 ? 'Sicherung' : 'Sicherungen'} im
              Ordner · neueste {backup.backups[0].file}
            </p>
          )}
        </div>

        <div className="field">
          <label>Aufbewahrung</label>
          <Segmented
            ariaLabel="Aufbewahrung"
            options={[
              { value: 5, label: '5 Stände' },
              { value: 10, label: '10 Stände' },
              { value: 30, label: '30 Stände' },
            ]}
            value={backup.keep}
            onChange={(keep) => onBackupSettingsChange({ keep })}
          />
          <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
            Ältere Sicherungen im Ordner werden nach jedem Backup entfernt.
          </p>
        </div>
      </div>

      <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
        <button
          type="button"
          className="cd-link cd-danger-link"
          onClick={() => void onDropDatabase()}
        >
          Datenbank löschen
        </button>
        {' oder '}
        <button type="button" className="cd-link cd-danger-link" onClick={() => void onFullReset()}>
          App zurücksetzen…
        </button>
      </p>
    </div>
  );
};

export default SettingsSecurity;
