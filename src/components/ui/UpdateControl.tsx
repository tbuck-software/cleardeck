import { useId, useState, useRef, useLayoutEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faRotate, faCircleExclamation, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import type { UpdateStatus } from '../../shared/types';
import UpdateErrorDetails from './UpdateErrorDetails';

type UpdateControlProps = {
  status: UpdateStatus;
  onCheck: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
  onInstall: () => void | Promise<void>;
  compact?: boolean;
};

const remainingTime = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return 'Restzeit wird berechnet …';
  if (seconds <= 0) return 'Download wird abgeschlossen …';
  if (seconds < 60) return `Noch ca. ${Math.ceil(seconds)} Sek.`;
  return `Noch ca. ${Math.ceil(seconds / 60)} Min.`;
};

export default function UpdateControl({ status, onCheck, onDownload, onInstall, compact = false }: UpdateControlProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const notesId = useId();
  const controlRef = useRef<HTMLElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = notesRef.current;
    const control = controlRef.current;
    if (!notesOpen || !panel || !control) return;
    // The top layer avoids clipping the notes inside the scrolling sidebar.
    panel.showPopover?.();
    const anchor = control.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 32);
    panel.style.width = `${width}px`;
    const beside = compact && anchor.right + width <= window.innerWidth - 16;
    panel.style.left = `${beside ? anchor.right : Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16))}px`;
    panel.style.top = `${Math.max(16, Math.min(beside ? anchor.bottom - panel.offsetHeight : anchor.top - panel.offsetHeight, window.innerHeight - panel.offsetHeight - 16))}px`;
  }, [notesOpen, compact, status.version, status.state, status.releaseNotes]);
  const downloading = status.state === 'downloading';
  const installing = status.state === 'installing';
  const busy = downloading || installing || status.state === 'checking';
  const retry = status.state === 'error' ? status.retry : undefined;
  const ready = status.state === 'downloaded' || retry === 'install';
  const available = status.state === 'available' || retry === 'download';
  const action = ready ? onInstall : available ? onDownload : onCheck;
  const actionLabel = ready ? 'Update installieren und neu starten' : available ? 'Update herunterladen' : 'Updates prüfen';
  const labels = {
    idle: 'Updates',
    checking: 'Suche nach Updates …',
    available: 'Update verfügbar',
    'not-available': 'Auf dem neuesten Stand',
    downloading: 'Update wird geladen',
    downloaded: 'Bereit zum Neustart',
    installing: 'Neustart wird vorbereitet …',
    error: 'Update fehlgeschlagen',
  };
  const icon = status.state === 'error' ? faCircleExclamation : ready || installing ? faRotate : downloading || available ? faDownload : faArrowUp;
  const progress = downloading && typeof status.progress === 'number' && Number.isFinite(status.progress)
    ? Math.max(0, Math.min(100, Math.round(status.progress))) : undefined;
  const notes = status.releaseNotes?.trim();

  return (
    <section
      className={`update-control ${compact ? 'update-control-compact' : ''} ${status.state === 'error' ? 'update-control-error' : ''}`}
      aria-label="Software-Update"
      ref={controlRef}
      onMouseEnter={() => setNotesOpen(true)}
      onMouseLeave={() => setNotesOpen(false)}
      onFocus={() => setNotesOpen(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setNotesOpen(false); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { setNotesOpen(false); event.stopPropagation(); } }}
    >
      <div className="update-control-heading">
        <span className="update-control-icon" aria-hidden="true"><FontAwesomeIcon icon={icon} /></span>
        <div className="update-control-title" role="status">
          <strong>{labels[status.state]}</strong>
          {status.version && <span>Version {status.version}</span>}
        </div>
        {status.version && <button type="button" className="update-notes-toggle" aria-label="Neuerungen anzeigen" aria-expanded={notesOpen} aria-controls={notesId} onClick={() => setNotesOpen(true)}>ⓘ</button>}
      </div>
      {downloading && <div className="update-transfer">
        <progress max={100} value={progress} aria-label="Update-Download" />
        <div><strong>{progress === undefined ? 'Verbindung wird hergestellt …' : `${progress} %`}</strong><span>{remainingTime(status.remainingSeconds)}</span></div>
      </div>}
      {installing && <p className="update-control-detail">Das Update wird geprüft und installiert. Die App startet anschließend neu.</p>}
      {status.state === 'error' && <>
        <p className="update-control-detail">Das Update wurde nicht abgeschlossen. Du kannst es erneut versuchen.</p>
        <UpdateErrorDetails key={status.message} message={status.message} />
      </>}
      <button type="button" className="update-control-action" onClick={() => void action()} disabled={busy}>
        {busy ? installing ? 'Installation läuft …' : downloading ? 'Download läuft …' : 'Suche läuft …' : actionLabel}
      </button>
      {status.version && notesOpen && <div ref={notesRef} popover="manual" id={notesId} className="update-notes" role="region" aria-label="Neuerungen" tabIndex={0}>
        <p className="update-notes-heading">Neuerungen bis {status.version}</p>
        {notes ? <div className="update-notes-content">{notes}</div> : <p>Für dieses Update wurden keine Neuerungen veröffentlicht.</p>}
      </div>}
    </section>
  );
}
