/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('meldet den Stand an die Barrierefreiheit', () => {
    render(<ProgressBar value={42} label="Update-Download" />);
    const bar = screen.getByRole('progressbar', { name: 'Update-Download' });

    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('42 %')).toBeInTheDocument();
  });

  it('begrenzt Ausreißer auf 0 bis 100', () => {
    const { rerender } = render(<ProgressBar value={140} label="x" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    rerender(<ProgressBar value={-5} label="x" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('lässt den Wert offen, solange die Gesamtgröße unbekannt ist', () => {
    render(<ProgressBar label="Update-Download" note="Restzeit wird berechnet …" />);

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText('Restzeit wird berechnet …')).toBeInTheDocument();
  });

  it('verwendet kein natives progress-Element', () => {
    const { container } = render(<ProgressBar value={10} label="x" />);

    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('.cd-bar-track')).not.toBeNull();
  });
});
