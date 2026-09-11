import type { PeriodBounds } from '../employment';
import {
  MIGRATED_PERIOD_NOTE,
  contiguousEmploymentStart,
  hasReversedDates,
  looksMigrated,
  orderPeriods,
  periodsAdjacent,
  periodsOverlap,
} from '../employment';

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


describe('period checks', () => {
  it('erkennt vertauschte Daten und wertet sie nicht als Überschneidung', () => {
    const reversed = { startDate: '2024-05-01', endDate: '2024-01-31' };

    expect(hasReversedDates(reversed)).toBe(true);
    expect(periodsOverlap(reversed, { startDate: '2024-02-01', endDate: '2024-06-30' })).toBe(false);
  });

  it('erkennt Überschneidungen mit offenem Ende', () => {
    expect(
      periodsOverlap({ startDate: '2024-01-01', endDate: null }, { startDate: '2024-03-01', endDate: '2024-06-01' }),
    ).toBe(true);
    expect(
      periodsOverlap({ startDate: '2024-01-01', endDate: '2024-02-29' }, { startDate: '2024-03-01', endDate: null }),
    ).toBe(false);
  });

  it('erkennt unmittelbar angrenzende Abschnitte in beliebiger Reihenfolge', () => {
    const first: PeriodBounds = { startDate: '2024-01-01', endDate: '2024-06-30' };
    const second: PeriodBounds = { startDate: '2024-07-01', endDate: null };

    expect(periodsAdjacent(second, first)).toBe(true);
    expect(orderPeriods(second, first)[0]).toBe(first);
    expect(periodsAdjacent(first, { startDate: '2024-07-02', endDate: null })).toBe(false);
  });
});

describe('looksMigrated', () => {
  it('erkennt die Notiz der Datenübernahme', () => {
    expect(looksMigrated(MIGRATED_PERIOD_NOTE)).toBe(true);
    expect(looksMigrated('Übernahme aus der Altsoftware')).toBe(true);
    expect(looksMigrated('Migration 2019')).toBe(true);
  });

  it('meldet keine beliebige Notiz mit „prüfen“', () => {
    expect(looksMigrated('Vertrag prüfen')).toBe(false);
    expect(looksMigrated('Altbestand der Station')).toBe(false);
    expect(looksMigrated(null)).toBe(false);
  });
});
