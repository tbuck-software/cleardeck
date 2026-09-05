import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faDownload, faRotate } from '@fortawesome/free-solid-svg-icons';
import api from '../../services/api';
import type { DiagnosticSnapshot } from '../../shared/types';
import { formatDiagnostics } from '../../shared/diagnostics';
import '../../styles/diagnostics.css';

const DiagnosticsPanel = () => {
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot>({ entries: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await api.diagnostics.read());
      setError(null);
    } catch {
      setError('Die Diagnose konnte nicht geladen werden. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatDiagnostics(snapshot));
      setNotice('Diagnose kopiert. Du kannst sie in deine Nachricht einfügen.');
    } catch {
      setNotice('Kopieren nicht möglich. Du kannst die Diagnose als Datei speichern.');
    }
  };
  const exportFile = async () => {
    setExporting(true);
    setNotice(null);
    try {
      if (await api.diagnostics.export()) setNotice('Diagnosedatei gespeichert. Du kannst sie deiner Feedback-Nachricht anhängen.');
    } catch {
      setNotice('Die Diagnosedatei konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-toolbar">
        <span className="diagnostics-count">{snapshot.entries.length} Einträge · Neueste zuerst</span>
        <button type="button" className="ghost-button" onClick={() => void refresh()} disabled={loading}>
          <FontAwesomeIcon icon={faRotate} spin={loading} /> {loading ? 'Lädt …' : 'Aktualisieren'}
        </button>
      </div>
      {(error || snapshot.storageError) && <p className="error" role="alert">{error || snapshot.storageError}</p>}
      <div className="diagnostics-entries" role="region" aria-label="Diagnoseeinträge" tabIndex={0} aria-busy={loading}>
        {!loading && snapshot.entries.length === 0 && <p className="diagnostics-empty">Noch keine Diagnoseeinträge vorhanden.</p>}
        <ol>
          {snapshot.entries.map((entry, index) => (
            <li className={`diagnostics-entry diagnostics-entry-${entry.level}`} key={`${entry.at}-${index}`}>
              <div className="diagnostics-meta">
                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString('de-DE')}</time>
                <span className={`diagnostics-level diagnostics-level-${entry.level}`}>{entry.level === 'error' ? 'Fehler' : 'Info'}</span>
                <span>{entry.source}</span>
              </div>
              <p>{entry.message}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="diagnostics-feedback">
        <div>
          <h4>Diagnose für Feedback</h4>
          <p>Die Diagnose enthält App-Start und Update-Ereignisse, ohne Zugangsdaten oder Datenbankinhalte. Kopiere sie oder speichere eine Datei zum Anhängen an deine Nachricht. Es wird nichts automatisch versendet.</p>
        </div>
        <div className="diagnostics-actions">
          <button type="button" className="ghost-button" onClick={() => void copy()} disabled={loading || !!error || snapshot.entries.length === 0}>
            <FontAwesomeIcon icon={faCopy} /> Diagnose kopieren
          </button>
          <button type="button" className="ghost-button" onClick={() => void exportFile()} disabled={exporting || loading || !!error}>
            <FontAwesomeIcon icon={faDownload} /> {exporting ? 'Speichert …' : 'Diagnosedatei speichern'}
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
      </div>
    </div>
  );
};

export default DiagnosticsPanel;
