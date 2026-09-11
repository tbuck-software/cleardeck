import { contiguousEmploymentStart } from '../employment';

describe('contiguousEmploymentStart', () => {
  it('walks through adjacent periods outside the selected report year', () => {
    const periods = [
      { id: 1, startDate: '2022-07-01', endDate: '2023-12-31', qualification: 'Pflegekraft' },
      { id: 2, startDate: '2024-01-01', endDate: '2024-12-31', qualification: 'Fachkraft' },
      { id: 3, startDate: '2025-01-01', endDate: null, qualification: 'Fachkraft' },
    ];

    expect(contiguousEmploymentStart(periods, 3, '2025-01-01')).toBe('2022-07-01');
  });

  it('starts a new chain after a real gap or re-entry', () => {
    const periods = [
      { id: 1, startDate: '2022-01-01', endDate: '2022-12-31', qualification: 'Pflegekraft' },
      { id: 2, startDate: '2023-02-01', endDate: '2023-12-31', qualification: 'Pflegekraft' },
      { id: 3, startDate: '2024-01-01', endDate: null, qualification: 'Fachkraft' },
    ];

    expect(contiguousEmploymentStart(periods, 3, '2024-01-01')).toBe('2023-02-01');
    expect(contiguousEmploymentStart(periods, 2, '2023-02-01')).toBe('2023-02-01');
  });

  it('does not bridge malformed period dates', () => {
    const periods = [
      { id: 1, startDate: '2022-01-01', endDate: 'not-a-date', qualification: 'Pflegekraft' },
      { id: 2, startDate: '2022-01-02', endDate: null, qualification: 'Fachkraft' },
    ];

    expect(contiguousEmploymentStart(periods, 2, '2022-01-02')).toBe('2022-01-02');
  });
});

