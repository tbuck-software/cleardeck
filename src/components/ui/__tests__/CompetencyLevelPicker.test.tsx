import { render, screen } from '@testing-library/react';
import CompetencyLevelPicker from '../CompetencyLevelPicker';

it('explains the selected stage of the current model', () => {
  render(<CompetencyLevelPicker value={3} onChange={vi.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Stufe 3 · Selbstständig unter Nachkontrolle');
  expect(screen.getByRole('radio', { name: /^1/ })).toHaveAttribute('title', 'Stufe 1 · Gesehen / Erklärt');
});

it('keeps legacy stages without the new descriptions', () => {
  render(<CompetencyLevelPicker legacy value={3} onChange={vi.fn()} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
