import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import ProgressBar from './ProgressBar';
import ReleaseNotes from './ReleaseNotes';
import UpdateErrorDetails from './UpdateErrorDetails';
import type { UpdateStatus } from '../../shared/types';

type UpdatePopoverProps = {
  status: UpdateStatus;
  /** Sidebar: anchored to the nav rail. Corner: bottom right, opening upward. */
  placement?: 'sidebar' | 'corner';
  wide?: boolean;
  currentVersion?: string;
  onCheck: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
  onInstall: () => void | Promise<void>;
};

const remainingTime = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return 'Restzeit wird berechnet …';
  if (seconds <= 0) return 'Download wird abgeschlossen …';
  if (seconds < 60) return `Noch ca. ${Math.ceil(seconds)} Sek.`;
  return `Noch ca. ${Math.ceil(seconds / 60)} Min.`;
};

const HEADINGS: Record<UpdateStatus['state'], string> = {
  idle: 'Updates',
  checking: 'Suche nach Updates …',
  available: 'Update verfügbar',
  'not-available': 'Auf dem neuesten Stand',
  downloading: 'Update wird geladen',
  downloaded: 'ist bereit',
  installing: 'Neustart wird vorbereitet …',
  error: 'Update fehlgeschlagen',
};

const UpdatePopover = ({
  status,
  placement = 'sidebar',
  wide = true,
  currentVersion,
  onCheck,
  onDownload,
  onInstall,
}: UpdatePopoverProps) => {
  const [open, setOpen] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const ready = status.state === 'downloaded';
  const available = status.state === 'available';
  const downloading = status.state === 'downloading';
  const failed = status.state === 'error';
  // Idle/up-to-date states live on the Über page, not in the sidebar.
  const notable = ready || available || downloading || failed;

  useEffect(() => {
    setSnoozed(false);
  }, [status.version, status.state]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!notable || snoozed) return null;

  const progress =
    downloading && typeof status.progress === 'number' && Number.isFinite(status.progress)
      ? Math.max(0, Math.min(100, Math.round(status.progress)))
      : undefined;

  const heading = ready
    ? `ClearDeck ${status.version ?? ''} ist bereit`
    : HEADINGS[status.state];
  const subline = ready
    ? `Heruntergeladen · installiert wird beim Neustart${currentVersion ? ` · aktuell ${currentVersion}` : ''}`
    : available
      ? `Version ${status.version ?? '—'} kann geladen werden`
      : downloading
        ? `Version ${status.version ?? '—'} wird geladen`
        : 'Das Update wurde nicht abgeschlossen.';

  const inCorner = placement === 'corner';

  return (
    <div className="update-popover-anchor" ref={containerRef}>
      <button
        type="button"
        className={`cd-nav cd-nav-update${inCorner ? ' cd-nav-update-inline' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title={wide ? undefined : heading}
        aria-expanded={open}
      >
        <span className="cd-nav-update-icon">
          <Icon name={failed ? 'warning' : 'upload'} />
          <span className="cd-nav-dot" />
        </span>
        {(wide || inCorner) && (
          <>
            <span style={{ flex: 1 }}>
              {failed ? 'Update fehlgeschlagen' : `Update ${status.version ?? ''}`.trim()}
            </span>
            <span className="cd-nav-update-flag">{ready ? 'Neu' : downloading ? `${progress ?? 0} %` : ''}</span>
          </>
        )}
      </button>

      {open && (
        <div className="update-popover-scrim" onClick={() => setOpen(false)}>
          <div
            className={`update-popover${inCorner ? ' update-popover-corner' : ''}`}
            style={inCorner ? undefined : { left: wide ? 250 : 90 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="update-popover-arrow" />
            <div className="update-popover-head">
              <div>
                <div className="update-popover-title">{heading}</div>
                <div className="update-popover-sub">{subline}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Schließen"
                onClick={() => setOpen(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {downloading && (
              <ProgressBar value={progress} label="Update-Download" note={remainingTime(status.remainingSeconds)} />
            )}

            {failed && <UpdateErrorDetails key={status.message} message={status.message} />}

            <div className="update-popover-notes">
              <ReleaseNotes notes={status.releaseNotes} />
            </div>


            <div className="update-popover-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSnoozed(true)}>
                Später
              </button>
              {ready && (
                <button type="button" className="btn btn-primary" onClick={() => void onInstall()}>
                  Installieren &amp; neu starten
                </button>
              )}
              {available && (
                <button type="button" className="btn btn-primary" onClick={() => void onDownload()}>
                  Herunterladen
                </button>
              )}
              {failed && (
                <button type="button" className="btn btn-primary" onClick={() => void onCheck()}>
                  Erneut versuchen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePopover;
