/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import RecommendedCompetenciesModal from '../RecommendedCompetenciesModal';

describe('RecommendedCompetenciesModal', () => {
  it('kann alle Vorschlaege aktivieren und speichern', () => {
    const onSelectAll = vi.fn();
    const onSave = vi.fn();

    render(
      <RecommendedCompetenciesModal
        state={{ open: true, selectedDefinitionIds: [1] }}
        definitions={[
          { id: 1, code: 'P01', name: 'Grundpflege', category: 'SGB XI', relevance: 'Alle' },
          { id: 2, code: 'BPF2', name: 'Injektionen', category: 'SGB V', relevance: 'Nur PFK' },
        ]}
        onToggle={vi.fn()}
        onSelectAll={onSelectAll}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText('Alle aktivieren'));
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Auswahl übernehmen'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
