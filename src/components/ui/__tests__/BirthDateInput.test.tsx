import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BirthDateInput from '../BirthDateInput';

const Form = ({ initial = '' }: { initial?: string }) => {
  const [date, setDate] = useState(initial);
  return (
    <>
      <BirthDateInput value={date} onChange={setDate} />
      <output data-testid="stored">{date}</output>
    </>
  );
};
describe('birth date editing', () => {
  it('accepts an old year through the styled date field and can be cleared', () => {
    render(<Form />);
    const field = screen.getByLabelText('Geburtsdatum');
    expect(field).toHaveAttribute('type', 'date');
    expect(field).toHaveClass('input');
    fireEvent.change(field, { target: { value: '1940-02-29' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('1940-02-29');
    fireEvent.change(field, { target: { value: '' } });
    expect(screen.getByTestId('stored')).toBeEmptyDOMElement();
  });
  it('preserves unknown years and allows entering day and month in separate keystrokes', () => {
    render(<Form initial="0000-02-29" />);
    const field = screen.getByLabelText('Geburtstag ohne Jahr');
    expect(field).toHaveValue('29.02');
    fireEvent.change(field, { target: { value: '3' } });
    fireEvent.change(field, { target: { value: '3.5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('0000-05-03');
    fireEvent.click(screen.getByLabelText('Jahr unbekannt'));
    expect(screen.getByLabelText('Geburtsdatum')).toHaveValue('');
  });
});
