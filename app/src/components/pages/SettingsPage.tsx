import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faKey } from '@fortawesome/free-solid-svg-icons';
import type { QualificationType, UpdateStatus } from '../../shared/types';

type SettingsPageProps = {
  qualifications: QualificationType[];
  qualificationEdits: Record<number, string>;
  dbMessage: string | null;
  baseHoursInput: string;
  updateStatus: UpdateStatus;
  onOpenQualificationModal: (payload: { id?: number; value: string; note: string }) => void;
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

  return (
    <div className="stack">
      <div className="card form-card">
        <div className="form-header">
          <div>
            <p className="eyebrow">Qualifikationen</p>
            <h3>Typen verwalten</h3>
          </div>
          <button className="primary" onClick={() => onOpenQualificationModal({ value: '', note: '', id: undefined })}>
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
      <div className="card form-card">
        <div className="form-header">
          <div>
            <p className="eyebrow">Datenbank</p>
            <h3>Import / Export</h3>
          </div>
        </div>
        <div className="form-grid">
          <label className="full-width">Export</label>
          <div className="inline-row">
            <button className="ghost-button" onClick={() => onDbExport('plain')}>
              Unverschlüsselt exportieren (SQLite)
            </button>
            <button className="ghost-button" onClick={() => onDbExport('encrypted')}>
              Verschlüsselt exportieren (.enc)
            </button>
          </div>
          <label className="full-width">Import</label>
          <div className="inline-row">
            <button className="ghost-button" onClick={() => onDbImport('plain')}>
              Unverschlüsselt importieren (SQLite)
            </button>
            <button className="ghost-button" onClick={() => onDbImport('encrypted')}>
              Verschlüsselt importieren (.enc)
            </button>
          </div>
          <p className="subtitle small">
            Import ersetzt die lokale Datenbank. Verschlüsselte Importe erwarten das aktuelle App-Passwort / den geladenen
            Schlüssel.
          </p>
          {dbMessage && <p className="subtitle small success-text">{dbMessage}</p>}
          <label className="full-width">
            Basis-Wochenstunden für VZÄ (Default 36)
            <input type="number" min="1" step="1" value={baseHoursInput} onChange={(e) => onBaseHoursInputChange(e.target.value)} />
          </label>
          <div className="form-actions">
            <button className="ghost-button" onClick={onSaveBaseHours}>
              Basiswert speichern
            </button>
          </div>
        </div>
      </div>
      <div className="card form-card">
        <div className="form-header">
          <div>
            <p className="eyebrow">Sicherheit</p>
            <h3>Recovery Key</h3>
          </div>
        </div>
        <div className="form-grid">
          <p className="subtitle small">
            Recovery Key entsperrt die Datenbank auch ohne Passwort. Sicher offline ablegen, nicht weitergeben.
          </p>
          <div className="inline-row">
            <button className="ghost-button" onClick={onOpenRecoveryKey}>
              <FontAwesomeIcon icon={faKey} /> Recovery Key anzeigen
            </button>
          </div>
          <p className="subtitle small">
            Tipp: Direkt nach der Einrichtung speichern. Wer den Key besitzt, kann alle Daten lesen.
          </p>
        </div>
      </div>
      <div className="card form-card">
        <div className="form-header">
          <div>
            <p className="eyebrow">Updates</p>
            <h3>Neue Versionen</h3>
          </div>
        </div>
        <div className="form-grid">
          <div className="inline-row">
            <button
              className="ghost-button"
              onClick={onCheckUpdates}
              disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
            >
              {updateStatus.state === 'checking' ? 'Suche …' : 'Nach Updates suchen'}
            </button>
            {updateStatus.state === 'downloaded' && (
              <button className="primary" onClick={onInstallUpdate}>
                Neu starten & installieren
              </button>
            )}
          </div>
          <p className="subtitle small">
            {updateStatus.state === 'available' && `Update ${updateStatus.version ? `v${updateStatus.version}` : ''} verfügbar.`}
            {updateStatus.state === 'downloading' &&
              `Lade ${updateStatus.version ? `v${updateStatus.version}` : 'Update'} (${Math.round(updateStatus.progress ?? 0)}%) …`}
            {updateStatus.state === 'downloaded' && `Update ${updateStatus.version ? `v${updateStatus.version}` : ''} heruntergeladen.`}
            {updateStatus.state === 'not-available' && 'Keine neueren Updates gefunden.'}
            {updateStatus.state === 'error' && `Update-Fehler: ${updateStatus.message}`}
            {updateStatus.state === 'idle' && 'Updates werden beim Start, stündlich und bei Fokus geprüft.'}
          </p>
        </div>
      </div>

      <div className="card danger-card">
        <div className="form-header">
          <div>
            <p className="eyebrow">Danger Zone</p>
            <h3>Unwiderrufliche Aktionen</h3>
          </div>
        </div>
        <div className="danger-actions">
          <div>
            <h4>Datenbank löschen</h4>
            <p className="subtitle small">
              Entfernt die lokale Datenbank, das Passwort bleibt erhalten. Import oder Neuerfassung danach nötig.
            </p>
          </div>
          <button className="ghost-button danger" onClick={onDropDatabase}>
            Datenbank löschen
          </button>
        </div>
        <div className="danger-actions">
          <div>
            <h4>App zurücksetzen</h4>
            <p className="subtitle small">
              Löscht Datenbank und Konfiguration. Beim nächsten Start wird die Ersteinrichtung angezeigt.
            </p>
          </div>
          <button className="ghost-button danger" onClick={onFullReset}>
            App zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
