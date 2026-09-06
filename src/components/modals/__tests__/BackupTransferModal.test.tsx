/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import { BackupExportModal, BackupRestoreModal } from '../BackupTransferModal';
import type { BackupFileInfo } from '../../../shared/types';

const noop = (): void => undefined;

const backups: BackupFileInfo[] = [
  {
    file: 'cleardeck-2026-09-05_0814.cdb',
    path: '/nas/a.cdb',
    size: 2_516_582,
    modifiedAt: '2026-09-05T08:14:00.000Z',
  },
  {
    file: 'cleardeck-2026-09-02_0814.cdb',
    path: '/nas/b.cdb',
    size: 2_400_000,
    modifiedAt: '2026-09-02T08:14:00.000Z',
  },
];

describe('BackupExportModal', () => {
  it('exportiert standardmäßig verschlüsselt', () => {
    const onExport = vi.fn();
    render(<BackupExportModal open onExport={onExport} onClose={noop} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onExport).toHaveBeenCalledWith('encrypted');
  });

  it('warnt vor der Klartext-Variante und benennt sie deutlich', () => {
    const onExport = vi.fn();
    render(<BackupExportModal open onExport={onExport} onClose={noop} />);

    fireEvent.click(screen.getByText('Unverschlüsselt (.db)'));

    expect(screen.getByRole('alert')).toHaveTextContent('Patientendaten im Klartext');
    fireEvent.click(screen.getByRole('button', { name: 'Unverschlüsselt speichern' }));
    expect(onExport).toHaveBeenCalledWith('plain');
  });
});

describe('BackupRestoreModal', () => {
  it('wählt die neueste Sicherung vor', () => {
    const onRestore = vi.fn();
    render(
      <BackupRestoreModal
        open
        busy={false}
        backups={backups}
        folder="/nas"
        onRestore={onRestore}
        onPickFile={noop}
        onClose={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' }));
    expect(onRestore).toHaveBeenCalledWith('/nas/a.cdb', '');
  });

  it('zeigt Zeitpunkt und Größe je Sicherung', () => {
    render(
      <BackupRestoreModal
        open
        busy={false}
        backups={backups}
        folder="/nas"
        onRestore={noop}
        onPickFile={noop}
        onClose={noop}
      />,
    );

    expect(screen.getByText(/05\.09\.2026, \d{2}:\d{2} · 2,4 MB/)).toBeInTheDocument();
  });

  it('warnt vor dem Ersetzen des Bestands', () => {
    render(
      <BackupRestoreModal
        open
        busy={false}
        backups={backups}
        folder="/nas"
        onRestore={noop}
        onPickFile={noop}
        onClose={noop}
      />,
    );

    expect(screen.getByText(/Der aktuelle Bestand wird ersetzt/)).toBeInTheDocument();
  });

  it('sperrt ohne Sicherungen und erklärt warum', () => {
    render(
      <BackupRestoreModal
        open
        busy={false}
        backups={[]}
        folder={null}
        onRestore={noop}
        onPickFile={noop}
        onClose={noop}
      />,
    );

    expect(screen.getByText('Es ist kein Backup-Ordner eingestellt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wiederherstellen' })).toBeDisabled();
  });

  it('sperrt während der Wiederherstellung', () => {
    render(
      <BackupRestoreModal
        open
        busy
        backups={backups}
        folder="/nas"
        onRestore={noop}
        onPickFile={noop}
        onClose={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Wird wiederhergestellt …' })).toBeDisabled();
  });
});
