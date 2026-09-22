import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ReportModal from '../ReportModal';
import type { YearDataset } from '../../../shared/types';

const dataset: YearDataset = { employees: [], aggregation: { totalHeadcount: 0, totalFte: 0, categories: [] }, availableYears: [2025] };
const props = { open: true, year: 2025, years: [2025], baseHours: 36, dataset,
  onModeChange: vi.fn(), onYearChange: vi.fn(), onExport: vi.fn(), onFixMissingHours: vi.fn(), onClose: vi.fn() };

it('defaults to month ends and offers daily weighting and the year-end snapshot', () => {
  render(<ReportModal {...props} />);
  expect(screen.getByRole('radio', { name: 'Durchschnitt aus 12 Monatsenden' })).toBeChecked();
  expect(screen.getByRole('columnheader', { name: 'Personen an Monatsenden' })).toBeInTheDocument();
  expect(screen.getByText(/nicht gesondert auf SGB XI/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Taggewichteter Jahresdurchschnitt' }));
  expect(props.onModeChange).toHaveBeenLastCalledWith('year-average');
  fireEvent.click(screen.getByRole('radio', { name: 'Stichtag 31.12.' }));
  expect(props.onModeChange).toHaveBeenLastCalledWith('stichtag');
});

it('labels the alternative report without claiming a month-end person count', () => {
  render(<ReportModal {...props} mode="year-average" />);
  expect(screen.getByRole('radio', { name: 'Taggewichteter Jahresdurchschnitt' })).toBeChecked();
  expect(screen.getByRole('columnheader', { name: 'Personen' })).toBeInTheDocument();
  expect(screen.queryByText(/nicht gesondert auf SGB XI/)).not.toBeInTheDocument();
});
