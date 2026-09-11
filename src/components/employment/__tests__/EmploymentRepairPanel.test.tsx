/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EmploymentRepairPanel from '../EmploymentRepairPanel';
import type {
  EmploymentIntegrityOverview,
  IntegrityPeriod,
  ReconcilePeriodsPreview,
} from '../../../shared/types';

const apiMock = vi.hoisted(() => ({
  employment: {
    previewReconcile: vi.fn(),
    applyReconcile: vi.fn(),
    previewConsolidate: vi.fn(),
    applyConsolidate: vi.fn(),
    previewMerge: vi.fn(),
    applyMerge: vi.fn(),
  },
  backup: { run: vi.fn() },
}));

vi.mock('../../../services/api', () => ({ api: apiMock, default: apiMock }));

const period = (overrides: Partial<IntegrityPeriod> & { id: number }): IntegrityPeriod => ({
  employeeId: 1,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  qualification: 'Pflegekraft',
  note: null,
  weeklyHours: 36,
  fte: 1,
  ...overrides,
});

const overview = (
  partial: Partial<EmploymentIntegrityOverview> = {},
): EmploymentIntegrityOverview => ({
  issues: [],
  employees: [
    { id: 1, name: 'Anna Berger', birthDate: '1985-06-12' },
    { id: 2, name: 'Anna Berger', birthDate: null },
  ],
  periods: [],
  ...partial,
});

const renderPanel = (
  data: EmploymentIntegrityOverview,
  overrides: Partial<React.ComponentProps<typeof EmploymentRepairPanel>> = {},
) => {
  const props = {
    employeeId: 1,
    overview: data,
    backupFolder: '/backups' as string | null,
    onOpenBackupSettings: vi.fn(),
    onOpenPeriod: vi.fn(),
    onApplied: vi.fn(),
    ...overrides,
  };
  render(<EmploymentRepairPanel {...props} />);
  return props;
};

const duplicateOverview = () =>
  overview({
    issues: [
      {
        kind: 'overlapping-periods',
        severity: 'error',
        employeeId: 1,
        relatedEmployeeId: null,
        periodIds: [10, 11],
      },
    ],
    periods: [
      period({ id: 10, startDate: '2019-01-01', endDate: '2019-12-31' }),
      period({ id: 11, startDate: '2019-01-01', endDate: null }),
    ],
  });

const reconcilePreview: ReconcilePeriodsPreview = {
  kind: 'reconcile-periods',
  token: 'token-1',
  employee: { id: 1, name: 'Anna Berger' },
  retained: {
    id: 11,
    before: { startDate: '2019-01-01', endDate: null },
    after: { startDate: '2019-01-01', endDate: '2019-12-31' },
  },
  removed: { id: 10, startDate: '2019-01-01', endDate: '2019-12-31' },
  affectedRecords: [{ table: 'employment_terms', ids: [1, 2], count: 2 }],
  conflicts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.backup.run.mockResolvedValue({ saved: true, file: 'backup.zip' });
});

describe('EmploymentRepairPanel', () => {
  it('bleibt leer, solange es zu dieser Person keinen Hinweis gibt', () => {
    const { container } = render(
      <EmploymentRepairPanel
        employeeId={1}
        overview={overview()}
        backupFolder={null}
        onOpenBackupSettings={vi.fn()}
        onOpenPeriod={vi.fn()}
        onApplied={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('schickt vertauschte Daten in den vorhandenen Zeitraum-Editor', () => {
    const props = renderPanel(
      overview({
        issues: [
          {
            kind: 'reversed-period',
            severity: 'error',
            employeeId: 1,
            relatedEmployeeId: null,
            periodIds: [10],
          },
        ],
        periods: [period({ id: 10, startDate: '2024-05-01', endDate: '2024-01-31' })],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum bearbeiten' }));
    expect(props.onOpenPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, startDate: '2024-05-01', endDate: '2024-01-31' }),
    );
  });

  it('gibt die Vorschau erst frei, wenn ein Abschnitt behalten wird', () => {
    renderPanel(duplicateOverview());

    const previewButton = screen.getByRole('button', { name: 'Vorschau' });
    expect(previewButton).toBeDisabled();
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(previewButton).toBeEnabled();
  });

  it('meldet ein leeres Datum im Bereich statt als Meldung der Anwendung', async () => {
    renderPanel(duplicateOverview());

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.change(screen.getByLabelText('Belegter Beginn'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));

    expect(await screen.findByText('Bitte einen Beginn eintragen.')).toBeInTheDocument();
    expect(apiMock.employment.previewReconcile).not.toHaveBeenCalled();
  });

  it('speichert mit den Kennungen der bestätigten Vorschau und setzt die Eingaben zurück', async () => {
    apiMock.employment.previewReconcile.mockResolvedValue(reconcilePreview);
    apiMock.employment.applyReconcile.mockResolvedValue(undefined);
    const props = renderPanel(duplicateOverview());

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() => expect(apiMock.employment.previewReconcile).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Auflösung speichern' }));
    await waitFor(() => expect(apiMock.employment.applyReconcile).toHaveBeenCalled());

    expect(apiMock.backup.run).toHaveBeenCalledTimes(1);
    expect(apiMock.employment.applyReconcile).toHaveBeenCalledWith({
      periodIds: [11, 10],
      retainedPeriodId: 11,
      startDate: '2019-01-01',
      endDate: '2019-12-31',
      previewToken: 'token-1',
    });
    await waitFor(() => expect(props.onApplied).toHaveBeenCalledWith('Doppelter Abschnitt aufgelöst.'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auflösung speichern' })).toBeDisabled(),
    );
    expect(screen.getAllByRole('radio')[1]).not.toBeChecked();
  });

  it('verwirft eine veraltete Vorschau und sperrt das Speichern wieder', async () => {
    apiMock.employment.previewReconcile.mockResolvedValue(reconcilePreview);
    apiMock.employment.applyReconcile.mockRejectedValue(
      new Error('Die Vorschau ist veraltet. Bitte Daten neu prüfen.'),
    );
    renderPanel(duplicateOverview());

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() => expect(apiMock.employment.previewReconcile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Auflösung speichern' }));

    expect(
      await screen.findByText('Die Vorschau ist veraltet. Bitte die Vorschau erneut erstellen.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auflösung speichern' })).toBeDisabled();
  });

  it('listet Konflikte einzeln und lässt das Speichern gesperrt', async () => {
    apiMock.employment.previewReconcile.mockResolvedValue({
      ...reconcilePreview,
      conflicts: ['Erster Konflikt.', 'Zweiter Konflikt.'],
    });
    renderPanel(duplicateOverview());

    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));

    expect(await screen.findByText('Erster Konflikt.')).toBeInTheDocument();
    expect(screen.getByText('Zweiter Konflikt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auflösung speichern' })).toBeDisabled();
  });

  it('benennt den fehlenden Backup-Ordner und speichert trotzdem', async () => {
    apiMock.employment.previewReconcile.mockResolvedValue(reconcilePreview);
    apiMock.employment.applyReconcile.mockResolvedValue(undefined);
    renderPanel(duplicateOverview(), { backupFolder: null });

    expect(screen.getByText(/Kein Backup-Ordner eingerichtet/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() => expect(apiMock.employment.previewReconcile).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Auflösung speichern' }));

    await waitFor(() => expect(apiMock.employment.applyReconcile).toHaveBeenCalled());
    expect(apiMock.backup.run).not.toHaveBeenCalled();
  });

  it('legt angrenzende Abschnitte mit denselben Kennungen zusammen', async () => {
    apiMock.employment.previewConsolidate.mockResolvedValue({
      kind: 'consolidate-periods',
      token: 'token-2',
      employee: { id: 1, name: 'Anna Berger' },
      before: [
        { id: 20, startDate: '2024-01-01', endDate: '2024-06-30', qualification: 'Pflegekraft' },
        { id: 21, startDate: '2024-07-01', endDate: null, qualification: 'Pflegekraft' },
      ],
      after: { startDate: '2024-01-01', endDate: null, qualification: 'Pflegekraft' },
      affectedRecords: [],
      conflicts: [],
    });
    apiMock.employment.applyConsolidate.mockResolvedValue(undefined);
    const props = renderPanel(
      overview({
        issues: [
          {
            kind: 'suspicious-period',
            severity: 'warning',
            employeeId: 1,
            relatedEmployeeId: null,
            periodIds: [21],
          },
        ],
        periods: [
          period({ id: 20, startDate: '2024-01-01', endDate: '2024-06-30' }),
          period({ id: 21, startDate: '2024-07-01', endDate: null }),
        ],
      }),
    );

    fireEvent.click(
      screen.getByRole('heading', { name: 'Angrenzende Abschnitte zusammenlegen' })
        .closest('section')!
        .querySelector('button.btn-secondary')!,
    );
    await waitFor(() => expect(apiMock.employment.previewConsolidate).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Zusammenlegen' }));

    await waitFor(() =>
      expect(apiMock.employment.applyConsolidate).toHaveBeenCalledWith({
        periodIds: [20, 21],
        previewToken: 'token-2',
      }),
    );
    await waitFor(() => expect(props.onApplied).toHaveBeenCalledWith('Abschnitte zusammengelegt.'));
  });

  it('führt die andere Person in die geöffnete Person zusammen', async () => {
    apiMock.employment.previewMerge.mockResolvedValue({
      kind: 'employee-merge',
      token: 'token-3',
      target: { id: 1, name: 'Anna Berger' },
      source: { id: 2, name: 'Anna Berger' },
      linkedRecords: [{ table: 'employee_events', ids: [1], count: 1 }],
      conflicts: [],
    });
    apiMock.employment.applyMerge.mockResolvedValue(undefined);
    const props = renderPanel(
      overview({
        issues: [
          {
            kind: 'same-name',
            severity: 'warning',
            employeeId: 1,
            relatedEmployeeId: 2,
            periodIds: [],
          },
        ],
      }),
    );

    expect(screen.getByRole('heading', { name: 'Mit Anna Berger zusammenführen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() =>
      expect(apiMock.employment.previewMerge).toHaveBeenCalledWith({
        targetEmployeeId: 1,
        sourceEmployeeId: 2,
      }),
    );
    expect(await screen.findByText('Wird übernommen – Ereignisse: 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zusammenführen' }));
    await waitFor(() =>
      expect(apiMock.employment.applyMerge).toHaveBeenCalledWith({
        targetEmployeeId: 1,
        sourceEmployeeId: 2,
        previewToken: 'token-3',
      }),
    );
    await waitFor(() => expect(props.onApplied).toHaveBeenCalledWith('Personen zusammengeführt.'));
  });
});
