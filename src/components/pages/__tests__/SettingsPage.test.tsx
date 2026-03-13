/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import api from '../../../services/api';
import SettingsPage from '../SettingsPage';
import type {
  CompetencyDefinition,
  InstructionDefinition,
  QualificationType,
  UpdateStatus,
} from '../../../shared/types';
import type {
  CompetencyModalPayload,
  EncryptionSetupState,
  InstructionModalPayload,
  QualificationModalPayload,
} from '../../../types/ui';

vi.mock('../../../services/api', () => ({
  default: {
    app: {
      openExternal: vi.fn<(_: string) => Promise<boolean>>().mockResolvedValue(true),
    },
  },
}));

const qualifications: QualificationType[] = [
  { id: 1, name: 'Alpha', note: 'Erste' },
  { id: 2, name: 'Beta', note: 'Zweite' },
];

const competencies: CompetencyDefinition[] = [
  { id: 1, code: '', name: 'Einarbeitung', category: 'Allgemein', relevance: 'Alle', note: 'Praktische Einarbeitung' },
  { id: 2, code: 'BPf 10', name: 'Wundversorgung', category: 'SGB V', relevance: 'Nur PFK', note: 'Freigabe im Alltag' },
];
const instructions: InstructionDefinition[] = [
  { id: 1, topic: 'Hygieneunterweisung', legalBasis: 'IfSG / KRINKO' },
  { id: 2, topic: 'Brandschutzunterweisung', legalBasis: 'ArbStättV' },
];

const baseStatus: UpdateStatus = { state: 'idle' };
const baseEncryptionSetup: EncryptionSetupState = {
  open: false,
  password: '',
  repeat: '',
  error: null,
  nextMode: 'encrypted',
};

const createProps = (overrides: Partial<React.ComponentProps<typeof SettingsPage>> = {}): React.ComponentProps<typeof SettingsPage> => ({
  qualifications,
  competencies,
  instructions,
  qualificationEdits: {},
  competencyEdits: {},
  dbMessage: null,
  baseHoursInput: '36',
  updateStatus: baseStatus,
  lastUpdateCheckAt: null,
  appInfo: null,
  storageMode: 'encrypted',
  encryptionSetup: baseEncryptionSetup,
  onOpenQualificationModal: vi.fn<(payload: QualificationModalPayload) => void>(),
  onOpenCompetencyModal: vi.fn<(payload: CompetencyModalPayload) => void>(),
  onOpenInstructionModal: vi.fn<(payload: InstructionModalPayload) => void>(),
  onReorderQualification: vi.fn<(ids: number[]) => void>(),
  onReorderCompetency: vi.fn<(ids: number[]) => void>(),
  onReorderInstruction: vi.fn<(ids: number[]) => void>(),
  onDeleteQualification: vi.fn<(id: number) => void>(),
  onDeleteCompetency: vi.fn<(id: number) => void>(),
  onDeleteInstruction: vi.fn<(id: number) => void>(),
  onBaseHoursInputChange: vi.fn<(val: string) => void>(),
  onSaveBaseHours: vi.fn(),
  onDbExport: vi.fn(),
  onDbImport: vi.fn(),
  onOpenRecoveryKey: vi.fn(),
  onOpenEnableEncryption: vi.fn(),
  onCloseEnableEncryption: vi.fn(),
  onEncryptionSetupChange: vi.fn(),
  onEnableEncryption: vi.fn(),
  onDisableEncryption: vi.fn(),
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

    // Navigate to qualifications tab first
    fireEvent.click(screen.getByText('Qualifikationen'));

    fireEvent.click(screen.getByText('Neu'));
    expect(props.onOpenQualificationModal).toHaveBeenCalledWith({ value: '', note: '', id: undefined });

    const firstRow = screen.getByText('Alpha').closest('.settings-list-item')!;
    const secondRow = screen.getByText('Beta').closest('.settings-list-item')!;

    fireEvent.dragStart(firstRow);
    fireEvent.dragOver(secondRow);
    fireEvent.drop(secondRow);

    expect(props.onReorderQualification).toHaveBeenCalledWith([2, 1]);
  });

  it('verwaltet Kompetenzen im eigenen Tab', () => {
    const props = createProps();
    render(<SettingsPage {...props} />);

    fireEvent.click(screen.getByText('Kompetenzen'));
    fireEvent.click(screen.getByText('Neu'));

    expect(props.onOpenCompetencyModal).toHaveBeenCalledWith({
      id: undefined,
      code: '',
      value: '',
      category: 'Allgemein',
      relevance: 'Alle',
      note: '',
    });

    const firstRow = screen.getByText('Einarbeitung').closest('.settings-list-item')!;
    const secondRow = screen.getByText('Wundversorgung').closest('.settings-list-item')!;

    fireEvent.dragStart(firstRow);
    fireEvent.dragOver(secondRow);
    fireEvent.drop(secondRow);

    expect(props.onReorderCompetency).toHaveBeenCalledWith([2, 1]);
  });

  it('verwaltet Einweisungen im eigenen Tab', () => {
    const props = createProps();
    render(<SettingsPage {...props} />);

    fireEvent.click(screen.getByText('Einweisungen'));
    fireEvent.click(screen.getByText('Neu'));

    expect(props.onOpenInstructionModal).toHaveBeenCalledWith({
      id: undefined,
      topic: '',
      legalBasis: '',
      note: '',
    });
  });

  it('zeigt Update- und Basisstunden-Status an', () => {
    const props = createProps({
      dbMessage: 'Export erledigt',
      updateStatus: { state: 'downloaded', version: '1.2.3' },
      lastUpdateCheckAt: '2026-03-08T09:30:00.000Z',
      appInfo: {
        name: 'ClearDeck',
        version: '1.7.2',
        author: 'Torben Buck',
        email: 'mail@tbuck.de',
        github: 'https://github.com/Rasalas/employee-db',
        license: 'SEE LICENSE IN LICENSE',
        copyright: 'Copyright',
        electronVersion: '39.2.4',
        nodeVersion: '20.0.0',
        platform: 'darwin',
        arch: 'arm64',
      },
    });

    render(<SettingsPage {...props} />);

    // Test is on 'Allgemein' tab by default
    fireEvent.change(screen.getByDisplayValue('36'), { target: { value: '40' } });
    expect(props.onBaseHoursInputChange).toHaveBeenCalledWith('40');

    expect(screen.getByText('Installiert')).toBeInTheDocument();
    expect(screen.getByText('v1.7.2')).toBeInTheDocument();
    expect(
      screen.getByText('v1.2.3 ist heruntergeladen. Aktiv bleibt v1.7.2, bis du installierst und neu startest.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Installieren & neu starten')).toBeEnabled();
    expect(screen.getByText('Release auf GitHub öffnen')).toHaveAttribute(
      'href',
      'https://github.com/Rasalas/employee-db/releases/tag/v1.2.3',
    );

    // Navigate to database tab to check dbMessage
    fireEvent.click(screen.getByText('Datenbank & Sicherheit'));
    expect(screen.getByText('Export erledigt')).toBeInTheDocument();
  });

  it('zeigt den unverschlüsselten Modus in den Sicherheitseinstellungen', () => {
    const props = createProps({
      storageMode: 'plain',
    });

    render(<SettingsPage {...props} />);

    fireEvent.click(screen.getByText('Datenbank & Sicherheit'));
    expect(screen.getByText('Speichermodus')).toBeInTheDocument();
    expect(screen.getByText('Unverschlüsselt')).toBeInTheDocument();
    expect(screen.getByText('Verschlüsselung aktivieren')).toBeEnabled();
    expect(screen.getByRole('button', { name: /Verschlüsselt Import/i })).toBeDisabled();
  });

  it('öffnet Info- und Release-Links explizit extern', () => {
    const props = createProps({
      appInfo: {
        name: 'ClearDeck',
        version: '1.7.2',
        author: 'Torben Buck',
        email: 'mail@tbuck.de',
        github: 'https://github.com/Rasalas/employee-db',
        license: 'SEE LICENSE IN LICENSE',
        copyright: 'Copyright',
        electronVersion: '39.2.4',
        nodeVersion: '20.0.0',
        platform: 'darwin',
        arch: 'arm64',
      },
      updateStatus: { state: 'downloaded', version: '1.2.3' },
    });

    render(<SettingsPage {...props} />);

    fireEvent.click(screen.getByText('Release auf GitHub öffnen'));
    expect(api.app.openExternal).toHaveBeenCalledWith(
      'https://github.com/Rasalas/employee-db/releases/tag/v1.2.3',
    );

    fireEvent.click(screen.getByText('Info'));
    fireEvent.click(screen.getByText('Torben kontaktieren'));
    expect(api.app.openExternal).toHaveBeenCalledWith(
      'https://wa.me/4917638955537?text=Hallo%20Torben%2C%0A%0Aich%20habe%20eine%20Frage%20zu%20ClearDeck%20v1.7.2.%0A%0ABeschreibung%3A',
    );

    fireEvent.click(screen.getByText('GitHub Repository'));
    expect(api.app.openExternal).toHaveBeenCalledWith('https://github.com/Rasalas/employee-db');
  });
});
