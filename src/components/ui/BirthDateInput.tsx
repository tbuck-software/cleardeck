import React, { useMemo } from 'react';

type BirthDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

/**
 * Birth date input that allows entering just month/day without a year.
 * When year is empty, stores as "0000-MM-DD".
 * When full date is known, stores as "YYYY-MM-DD".
 */
const BirthDateInput = ({ value, onChange, id }: BirthDateInputProps) => {
  // Parse the current value
  const parsed = useMemo(() => {
    if (!value) return { year: '', month: '', day: '' };

    const parts = value.split('-');
    if (parts.length !== 3) return { year: '', month: '', day: '' };

    const [year, month, day] = parts;
    // Year 0000 means unknown
    const displayYear = year === '0000' ? '' : year;

    return {
      year: displayYear,
      month,
      day,
    };
  }, [value]);

  const buildDate = (day: string, month: string, year: string): string => {
    if (!day || !month) return '';
    const yearVal = year || '0000';
    return `${yearVal.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const handleDayChange = (newDay: string) => {
    onChange(buildDate(newDay, parsed.month, parsed.year));
  };

  const handleMonthChange = (newMonth: string) => {
    onChange(buildDate(parsed.day, newMonth, parsed.year));
  };

  const handleYearChange = (newYear: string) => {
    // Only allow numeric input
    const cleaned = newYear.replace(/\D/g, '').slice(0, 4);
    onChange(buildDate(parsed.day, parsed.month, cleaned));
  };

  // Generate month options
  const months = [
    { value: '01', label: 'Jan' },
    { value: '02', label: 'Feb' },
    { value: '03', label: 'Mär' },
    { value: '04', label: 'Apr' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' },
    { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' },
    { value: '10', label: 'Okt' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dez' },
  ];

  // Generate day options (1-31)
  const days = Array.from({ length: 31 }, (_, i) => {
    const day = (i + 1).toString().padStart(2, '0');
    return { value: day, label: (i + 1).toString() };
  });

  return (
    <div className="birth-date-input">
      <div className="birth-date-fields">
        <select
          id={id ? `${id}-day` : undefined}
          value={parsed.day}
          onChange={(e) => handleDayChange(e.target.value)}
          className="birth-date-day"
        >
          <option value="">Tag</option>
          {days.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          id={id ? `${id}-month` : undefined}
          value={parsed.month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="birth-date-month"
        >
          <option value="">Monat</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          id={id ? `${id}-year` : undefined}
          type="text"
          inputMode="numeric"
          placeholder="Jahr"
          value={parsed.year}
          onChange={(e) => handleYearChange(e.target.value)}
          className="birth-date-year"
        />
      </div>
    </div>
  );
};

export default BirthDateInput;
