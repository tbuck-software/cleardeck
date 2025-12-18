/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import SettingsPage from '../SettingsPage';
import type { QualificationType, UpdateStatus } from '../../../shared/types';
import type { QualificationModalPayload } from '../../../types/ui';

const qualifications: QualificationType[] = [
  { id: 1, name: 'Alpha', note: 'Erste' },
  { id: 2, name: 'Beta', note: 'Zweite' },
];

const baseStatus: UpdateStatus = { state: 'idle' };

const createProps = (overrides: Partial<React.ComponentProps<typeof SettingsPage>> = {}): React.ComponentProps<typeof SettingsPage> => ({
  qualifications,
  qualificationEdits: {},
  dbMessage: null,
  baseHoursInput: '36',
  updateStatus: baseStatus,
  appInfo: null,
  onOpenQualificationModal: vi.fn<(payload: QualificationModalPayload) => void>(),
  onReorderQualification: vi.fn<(ids: number[]) => void>(),
  onDeleteQualification: vi.fn<(id: number) => void>(),
  onBaseHoursInputChange: vi.fn<(val: string) => void>(),
  onSaveBaseHours: vi.fn(),
  onDbExport: vi.fn(),
  onDbImport: vi.fn(),
  onOpenRecoveryKey: vi.fn(),
  onCheckUpdates: vi.fn(),
  onInstallUpdate: vi.fn(),
  onDropDatabase: vi.fn(),
  onFullReset: vi.fn(),
  ...overrides,
});

describe('SettingsPage', () => {
  it('ermöglicht Neu-Anlage und Drag&Drop-Reihenfolge', () => {
    const props = createProps();
    render(<SettingsPage {...props} />);

    fireEvent.click(screen.getByText('Neu'));
    expect(props.onOpenQualificationModal).toHaveBeenCalledWith({ value: '', note: '', id: undefined });

    const firstRow = screen.getByText('Alpha').closest('tr')!;
    const secondRow = screen.getByText('Beta').closest('tr')!;

    fireEvent.dragStart(firstRow);
    fireEvent.dragOver(secondRow);
    fireEvent.drop(secondRow);

    expect(props.onReorderQualification).toHaveBeenCalledWith([2, 1]);
  });

  it('zeigt Update- und Basisstunden-Status an', () => {
    const props = createProps({
      dbMessage: 'Export erledigt',
      updateStatus: { state: 'downloaded', version: '1.2.3' },
    });

    render(<SettingsPage {...props} />);

    fireEvent.change(screen.getByDisplayValue('36'), { target: { value: '40' } });
    expect(props.onBaseHoursInputChange).toHaveBeenCalledWith('40');

    expect(screen.getByText('Export erledigt')).toBeInTheDocument();
    expect(screen.getByText('Update v1.2.3 heruntergeladen.')).toBeInTheDocument();
    expect(screen.getByText('Neu starten & installieren')).toBeEnabled();
  });
});


