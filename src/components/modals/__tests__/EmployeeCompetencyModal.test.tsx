/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import EmployeeCompetencyModal from '../EmployeeCompetencyModal';
import type { CompetencyDefinition } from '../../../shared/types';

const definitions: CompetencyDefinition[] = [
  { id: 1, code: 'P01', name: 'Ganzwaschung', category: 'SGB XI' },
  { id: 2, code: 'BPf 22', name: 'Kompressionsstrümpfe Klasse I-III anlegen', category: 'SGB V' },
  { id: 3, code: 'QM-01', name: 'Toursoftware sicher bedienen', category: 'Digital' },
];

const renderModal = (onChange = vi.fn()) => {
  render(
    <EmployeeCompetencyModal
      state={{
        open: true,
        competencyDefinitionId: null,
        competencyName: '',
        level: null,
        approvedAt: '',
        approvedBy: '',
        note: '',
      }}
      employeeName="Anna Berger"
      availableDefinitions={definitions}
      onChange={onChange}
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return onChange;
};

describe('Kompetenz hinzufügen', () => {
  it('sucht im Katalog und meldet die gewählte Kompetenz', () => {
    const onChange = renderModal();
    const field = screen.getByLabelText('Kompetenz');

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'strumpfe' } });
    fireEvent.click(screen.getByRole('option'));

    expect(onChange).toHaveBeenCalledWith({
      competencyDefinitionId: 2,
      competencyName: 'Kompressionsstrümpfe Klasse I-III anlegen',
    });
  });

  it('gruppiert die Vorschläge nach Kategorie', () => {
    renderModal();

    fireEvent.focus(screen.getByLabelText('Kompetenz'));

    expect(screen.getAllByRole('option')).toHaveLength(3);
    ['SGB XI', 'SGB V', 'Digital'].forEach((group) => {
      expect(screen.getByText(group)).toBeInTheDocument();
    });
  });
});
