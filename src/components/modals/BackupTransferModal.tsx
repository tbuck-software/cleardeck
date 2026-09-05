import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';
import Icon from '../ui/Icon';
import { formatDateDE } from '../../utils/dateFormat';
import type { BackupFileInfo } from '../../shared/types';

const formatSize = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatMoment = (iso: string): string => {
  const date = new Date(iso);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${formatDateDE(iso.slice(0, 10))}, ${time}`;
};

type ExportModalProps = {
  open: boolean;
  onExport: (mode: 'encrypted' | 'plain') => void;
  onClose: () => void;
};

/**
 * Download a copy. The plaintext option is the dangerous one, so it has to be
 * chosen deliberately and says what it costs.
 */
export const BackupExportModal = ({ open, onExport, onClose }: ExportModalProps) => {
  const [mode, setMode] = useState<'encrypted' | 'plain'>('encrypted');

  useEffect(() => {
    if (open) setMode('encrypted');
  }, [open]);

  const options: { value: 'encrypted' | 'plain'; title: string; desc: string }[] = [
    {
      value: 'encrypted',
      title: 'Verschlüsselt (.enc)',
      desc: 'Nur mit dem Recovery-Key dieser Installation lesbar. Für die Ablage auf einem Laufwerk.',
    },
    {
      value: 'plain',
      title: 'Unverschlüsselt (.db)',
      desc: 'Direkt lesbare SQLite-Datei. Nur für die Weitergabe an Technik, nie als Archivkopie.',
    },
  ];

  return (
    <Dialog
      open={open}
      width={540}
      title="Backup herunterladen"
      subtitle="Aktueller Stand der Datenbank, ohne die App zu sperren."
      primaryLabel={mode === 'plain' ? 'Unverschlüsselt speichern' : 'Speichern'}
      primaryDanger={mode === 'plain'}
      onPrimary={() => onExport(mode)}
      onClose={onClose}
    >
      <div className="cd-field-grid">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="cd-choice"
            aria-pressed={mode === option.value}
            data-selected={mode === option.value}
            onClick={() => setMode(option.value)}
          >
            <div style={{ fontWeight: 700 }}>{option.title}</div>
            <div className="cd-muted-13" style={{ marginTop: 4, lineHeight: 1.4 }}>
              {option.desc}
            </div>
          </button>
        ))}
      </div>

      {mode === 'plain' && (
        <div className="cd-notice cd-notice-bad" role="alert">
          <Icon name="warning" />
          <span>
            Die Datei enthält Patientendaten im Klartext. Nicht per Mail versenden, nach Gebrauch löschen.
          </span>
        </div>
      )}
    </Dialog>
  );
};

type RestoreModalProps = {
  open: boolean;
  busy: boolean;
  backups: BackupFileInfo[];
  folder: string | null;
  onRestore: (path: string) => void;
  onPickFile: () => void;
  onClose: () => void;
};

/**
 * Restore from the backup folder. Picking from a list beats a file dialog
 * because the file names carry the timestamp that matters here.
 */
export const BackupRestoreModal = ({
  open,
  busy,
  backups,
  folder,
  onRestore,
  onPickFile,
  onClose,
}: RestoreModalProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(backups[0]?.path ?? null);
  }, [open, backups]);

  return (
    <Dialog
      open={open}
      width={540}
      title="Backup wiederherstellen"
      subtitle="Sicherung auswählen — die neueste steht oben."
      primaryLabel={busy ? 'Wird wiederhergestellt …' : 'Wiederherstellen'}
      primaryDanger
      primaryDisabled={!selected || busy}
      onPrimary={() => selected && onRestore(selected)}
      onClose={onClose}
    >
      {backups.length === 0 ? (
        <p className="cd-muted-14" style={{ margin: 0 }}>
          {folder
            ? 'In diesem Ordner liegt noch keine Sicherung.'
            : 'Es ist kein Backup-Ordner eingestellt.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {backups.map((backup) => (
            <button
              key={backup.path}
              type="button"
              className="cd-choice cd-choice-row"
              aria-pressed={selected === backup.path}
              data-selected={selected === backup.path}
              onClick={() => setSelected(backup.path)}
            >
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>{backup.file}</div>
                <div className="cd-muted-13">
                  {formatMoment(backup.modifiedAt)} · {formatSize(backup.size)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="cd-notice cd-notice-bad">
        <Icon name="warning" />
        <span>
          Der aktuelle Bestand wird ersetzt. Vorher wird automatisch ein Sicherheits-Backup angelegt.
        </span>
      </div>

      <p className="cd-muted-13" style={{ margin: 0 }}>
        Sicherungen aus dieser Installation öffnen ohne Passwort — sie sind mit deinem Datenschlüssel
        versiegelt, den auch ein Passwortwechsel nicht ändert.{' '}
        <button type="button" className="cd-link" onClick={onPickFile}>
          Stattdessen Datei wählen…
        </button>
      </p>
    </Dialog>
  );
};
