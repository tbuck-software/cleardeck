/**
 * Format a date string (YYYY-MM-DD) to German format (DD.MM.YYYY)
 * If year is 0000 (unknown), only shows DD.MM.
 */
export const formatDateDE = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts;

  // If year is unknown (0000), show only day and month
  if (year === '0000') {
    return `${day}.${month}.`;
  }

  return `${day}.${month}.${year}`;
};
