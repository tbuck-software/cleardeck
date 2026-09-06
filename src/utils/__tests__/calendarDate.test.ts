import { localDate, requireBirthDate, shiftDays, validDate } from '../calendarDate';

describe('calendar dates and optional birthdays', () => {
  it('validates actual days and leap days, including birthdays without a year', () => {
    expect(validDate('2024-02-29')).toBe(true);
    expect(validDate('2025-02-29')).toBe(false);
    for (const value of [null, '', '1940-02-29', '0000-02-29']) {
      expect(() => requireBirthDate(value)).not.toThrow();
    }
    for (const value of ['2025-02-29', '0000-04-31', '29.02', '9999-01-01']) {
      expect(() => requireBirthDate(value)).toThrow('Geburtsdatum');
    }
  });
  it('uses local days across month ends and daylight-saving changes', () => {
    expect(shiftDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(localDate(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});
