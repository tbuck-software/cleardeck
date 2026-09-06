import Checkbox from './Checkbox';
import React, { useId, useState } from 'react';
import { localDate } from '../../utils/calendarDate';

type BirthDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

/** A normal date field; existing birthdays with an unknown year remain editable. */
const BirthDateInput = ({ value, onChange, id }: BirthDateInputProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [unknownYear, setUnknownYear] = useState(value.startsWith('0000-'));
  const [dayMonth, setDayMonth] = useState(
    value.startsWith('0000-') ? `${value.slice(8, 10)}.${value.slice(5, 7)}` : '',
  );
  return (
    <div>
      {unknownYear ? (
        <input
          id={inputId}
          aria-label="Geburtstag ohne Jahr"
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="TT.MM."
          value={dayMonth}
          onChange={(event) => {
            const text = event.target.value;
            setDayMonth(text);
            const parts = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(text);
            onChange(
              parts ? `0000-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : text,
            );
          }}
        />
      ) : (
        <input
          id={inputId}
          aria-label="Geburtsdatum"
          className="input"
          type="date"
          min="0001-01-01"
          max={localDate()}
          value={value.startsWith('0000-') ? '' : value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <Checkbox
        checked={unknownYear}
        onChange={(event) => {
          const unknown = event.target.checked;
          setUnknownYear(unknown);
          if (unknown && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            setDayMonth(`${value.slice(8, 10)}.${value.slice(5, 7)}`);
            onChange(`0000-${value.slice(5)}`);
          } else {
            setDayMonth('');
            onChange('');
          }
        }}
      >
        Jahr unbekannt
      </Checkbox>
    </div>
  );
};
export default BirthDateInput;
