/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard';
import type { QualificationType, YearDataset } from '../../../shared/types';

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
      />,
    );

    expect(screen.getByText('Keine Qualifikationen mit VZÄ im gewählten Jahr.')).toBeInTheDocument();
  });
});

