/// <reference types="vitest/globals" />

import { deriveFteFromWeeklyHours, deriveWeeklyHoursFromFte } from '../fte';

describe('FTE/WeeklyHours helpers (Modal-Logik)', () => {
  it('berechnet VZÄ aus Wochenstunden (gekoppelt)', () => {
    expect(deriveFteFromWeeklyHours(36, 36)).toBe(1);
    expect(deriveFteFromWeeklyHours(18, 36)).toBe(0.5);
    expect(deriveFteFromWeeklyHours(20, 40)).toBe(0.5);
    expect(deriveFteFromWeeklyHours(36, 40)).toBe(1); // Schwelle immer bei 36h
    expect(deriveFteFromWeeklyHours(50, 36)).toBe(1); // capped
  });

  it('berechnet Wochenstunden aus VZÄ (gekoppelt)', () => {
    expect(deriveWeeklyHoursFromFte(1, 36)).toBe(36);
    expect(deriveWeeklyHoursFromFte(0.5, 36)).toBe(18);
    expect(deriveWeeklyHoursFromFte(0.25, 40)).toBe(10);
    expect(deriveWeeklyHoursFromFte(2, 36)).toBe(36); // capped über 1.0
  });

  it('geht auf 0 bei ungültigen Werten', () => {
    expect(deriveFteFromWeeklyHours(NaN, 36)).toBe(0);
    expect(deriveWeeklyHoursFromFte(NaN, 36)).toBe(0);
  });
});
