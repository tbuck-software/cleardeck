/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard';
import type { QualificationType, YearDataset, UnifiedEvent, UnifiedEventType } from '../../../shared/types';

const sampleDataset: YearDataset = {
  employees: [],
  aggregation: {
    totalHeadcount: 3,
    totalFte: 7.5,
    categories: [
      { qualification: 'Pflegekraft', headcount: 2, fte: 4.5 },
      { qualification: 'Admin', headcount: 1, fte: 3 },
    ],
  },
  baseHours: 36,
};

const qualifications: QualificationType[] = [
  { id: 1, name: 'Pflegekraft' },
  { id: 2, name: 'Admin' },
];

const mockUnifiedEvents: UnifiedEvent[] = [
  {
    id: 'event-1',
    employeeId: 1,
    date: '2024-12-20',
    type: 'care-visit',
    title: 'Pflegevisite',
    employeeName: 'Max Mustermann',
  },
];

const mockOnEventClick = vi.fn();
const mockOnToggleEventFilter = vi.fn();
const mockOnShowAllEvents = vi.fn();
const mockOnHideAllEvents = vi.fn();
const mockHiddenEventTypes: UnifiedEventType[] = [];

describe('Dashboard', () => {
  it('zeigt Kennzahlen und Qualifikationen', () => {
    render(
      <Dashboard
        year={2024}
        dataset={sampleDataset}
        baseHours={36}
        averageFte={2.5}
        totalFte={sampleDataset.aggregation.totalFte}
        totalHeadcount={sampleDataset.aggregation.totalHeadcount}
        qualifications={qualifications}
        unifiedEvents={mockUnifiedEvents}
        hiddenEventTypes={mockHiddenEventTypes}
        onEventClick={mockOnEventClick}
        onToggleEventFilter={mockOnToggleEventFilter}
        onShowAllEvents={mockOnShowAllEvents}
        onHideAllEvents={mockOnHideAllEvents}
        departmentStats={[]}
      />,
    );

    expect(screen.getByText('Gesamt VZÄ')).toBeInTheDocument();
    expect(screen.getByText('7.50')).toBeInTheDocument();
    expect(screen.getByText('Ø VZÄ je Person')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getAllByText('Qualifikationen').length).toBeGreaterThan(0);
    expect(screen.getByText('Pflegekraft')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('zeigt leeren Zustand ohne Kategorien', () => {
    const emptyDataset: YearDataset = {
      employees: [],
      aggregation: { totalHeadcount: 0, totalFte: 0, categories: [] },
    };

    render(
      <Dashboard
        year={2025}
        dataset={emptyDataset}
        baseHours={0}
        averageFte={0}
        totalFte={0}
        totalHeadcount={0}
        qualifications={[]}
        unifiedEvents={[]}
        hiddenEventTypes={mockHiddenEventTypes}
        onEventClick={mockOnEventClick}
        onToggleEventFilter={mockOnToggleEventFilter}
        onShowAllEvents={mockOnShowAllEvents}
        onHideAllEvents={mockOnHideAllEvents}
        departmentStats={[]}
      />,
    );

    expect(screen.getByText('Keine Qualifikationen definiert.')).toBeInTheDocument();
    expect(screen.getByText('Keine bevorstehenden Ereignisse.')).toBeInTheDocument();
  });

  it('zeigt bevorstehende Ereignisse an', () => {
    render(
      <Dashboard
        year={2024}
        dataset={sampleDataset}
        baseHours={36}
        averageFte={2.5}
        totalFte={7.5}
        totalHeadcount={3}
        qualifications={qualifications}
        unifiedEvents={mockUnifiedEvents}
        hiddenEventTypes={mockHiddenEventTypes}
        onEventClick={mockOnEventClick}
        onToggleEventFilter={mockOnToggleEventFilter}
        onShowAllEvents={mockOnShowAllEvents}
        onHideAllEvents={mockOnHideAllEvents}
        departmentStats={[]}
      />,
    );

    expect(screen.getByText('Bevorstehende Ereignisse')).toBeInTheDocument();
    expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
    expect(screen.getByText('Pflegevisite')).toBeInTheDocument();
  });
});


