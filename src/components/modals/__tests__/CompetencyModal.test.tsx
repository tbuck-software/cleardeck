import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CompetencyModal from '../CompetencyModal';

it('edits several source groups without replacing the selection or an unknown local rule', () => {
  const onChange = vi.fn();
  const state = { open: true, id: 1, code: '032201', value: 'Blutdruckmessung', category: 'SGB V', relevance: 'HKP G1; HKP G3; Betriebsgruppe', note: 'Nachweis', reviewStatus: 'pending' as const };
  const { rerender } = render(<CompetencyModal state={state} onChange={onChange} onClose={vi.fn()} onSave={vi.fn()} />);
  fireEvent.click(screen.getByLabelText('HKP G2: Krankenpflegehilfe / Krankenpflegeassistenz / MFA'));
  expect(onChange).toHaveBeenLastCalledWith({ relevance: 'HKP G1; HKP G3; Betriebsgruppe; HKP G2' });
  fireEvent.change(screen.getByLabelText('Prüfstatus der Vorlage'), { target: { value: 'reviewed' } });
  expect(onChange).toHaveBeenLastCalledWith({ reviewStatus: 'reviewed' });
  rerender(<CompetencyModal state={{ ...state, relevance: 'HKP G1' }} onChange={onChange} onClose={vi.fn()} onSave={vi.fn()} />);
  fireEvent.click(screen.getByLabelText('HKP G1: Pflegefachkräfte / Notfallsanitäter'));
  expect(onChange).toHaveBeenLastCalledWith({ relevance: 'Keine Vorlage' });
});
