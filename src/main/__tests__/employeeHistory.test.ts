/// <reference types="vitest/globals" />

import { buildEmployeeChangeEvents } from '../employeeHistory';

describe('buildEmployeeChangeEvents', () => {
  it('erstellt getrennte Events fuer VZÄ und Wochenstunden', () => {
    expect(
      buildEmployeeChangeEvents({
        previous: { fte: 0.9, weeklyHours: 32.4 },
        next: { fte: 1, weeklyHours: 36 },
        eventDate: '2026-03-08',
      }),
    ).toEqual([
      {
        eventDate: '2026-03-08',
        type: 'fte-change',
        title: 'VZÄ-Änderung',
        previousValue: '0.90',
        newValue: '1.00',
      },
      {
        eventDate: '2026-03-08',
        type: 'weekly-hours-change',
        title: 'Wochenstundenänderung',
        previousValue: '32.4 h',
        newValue: '36.0 h',
      },
    ]);
  });

  it('erstellt keine Events ohne echte Aenderung', () => {
    expect(
      buildEmployeeChangeEvents({
        previous: { fte: 1, weeklyHours: 36 },
        next: { fte: 1, weeklyHours: 36 },
        eventDate: '2026-03-08',
      }),
    ).toEqual([]);
  });
});
