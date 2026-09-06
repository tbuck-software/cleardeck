/** Dates in the domain are calendar days, never UTC instants. */
export const localDate = (date = new Date()): string =>
  `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
};

export const requireDate = (value: string, label = 'Datum'): void => {
  if (!validDate(value)) throw new Error(`${label} ist ungültig.`);
};

export const shiftDays = (value: string, days: number): string => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
};

/** Year 0000 records a known month/day without inventing an age. */
export const requireBirthDate = (value?: string | null): void => {
  if (!value) return;
  const check = value.startsWith('0000-') ? `2000-${value.slice(5)}` : value;
  if (!validDate(check) || (!value.startsWith('0000-') && value > localDate()))
    throw new Error('Geburtsdatum ist ungültig oder liegt in der Zukunft.');
};
