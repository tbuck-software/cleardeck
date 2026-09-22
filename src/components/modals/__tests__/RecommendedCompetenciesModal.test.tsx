import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RecommendedCompetenciesModal from '../RecommendedCompetenciesModal';

const props = {
  state: { open: true, selectedDefinitionIds: [2] },
  definitions: [
    { id: 1, name: 'Hygiene', relevance: 'Alle' },
    { id: 2, name: 'Fachkompetenz', relevance: 'Nur PFK' },
    { id: 3, name: 'Hilfskompetenz', relevance: 'Nur PHK' },
  ],
  qualifications: ['Pflegefachkraft', 'Pflegehilfskraft'],
  employeeQualification: 'Pflegefachkraft',
  assignedIds: [1], busy: false,
  onQualificationChange: vi.fn(), onToggle: vi.fn(), onSelectAll: vi.fn(), onClose: vi.fn(), onSave: vi.fn(),
};
beforeEach(() => vi.clearAllMocks());

it('shows the suggested group, additions and immutable existing assignments together', () => {
  render(<RecommendedCompetenciesModal {...props} />);
  expect(screen.getByLabelText('Berufsgruppe / Qualifikation')).toHaveValue('Pflegefachkraft');
  expect(screen.getByLabelText('Hygiene auswählen')).toBeDisabled();
  expect(screen.getByLabelText('Fachkompetenz auswählen')).toBeChecked();
  expect(screen.queryByText('Hilfskompetenz')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 von 1 neuen Kompetenzen ausgewählt · 1 bereits zugeordnet');
  fireEvent.click(screen.getByRole('button', { name: '1 Kompetenz hinzufügen' }));
  expect(props.onSave).toHaveBeenCalledOnce();
});

it('allows reviewing another catalogue group without changing the employee qualification', () => {
  const { rerender } = render(<RecommendedCompetenciesModal {...props} />);
  fireEvent.change(screen.getByLabelText('Berufsgruppe / Qualifikation'), { target: { value: 'Pflegehilfskraft' } });
  expect(props.onQualificationChange).toHaveBeenCalledWith('Pflegehilfskraft');
  rerender(<RecommendedCompetenciesModal {...props} state={{ open: true, qualification: 'Pflegehilfskraft', selectedDefinitionIds: [] }} />);
  expect(screen.queryByText('Fachkompetenz')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Hilfskompetenz auswählen')).not.toBeChecked();
  expect(screen.getByRole('button', { name: '0 Kompetenzen hinzufügen' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Alle neuen auswählen' }));
  expect(props.onSelectAll).toHaveBeenCalledOnce();
});

it('still shows the complete template when all matching competencies are assigned', () => {
  render(<RecommendedCompetenciesModal {...props} assignedIds={[1, 2]} />);
  expect(screen.getByRole('status')).toHaveTextContent('0 von 0 neuen Kompetenzen ausgewählt · 2 bereits zugeordnet');
  expect(screen.getByRole('button', { name: 'Alle neuen auswählen' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '0 Kompetenzen hinzufügen' })).toBeDisabled();
});

it('prevents selection changes and duplicate saves while saving', () => {
  render(<RecommendedCompetenciesModal {...props} busy />);
  expect(screen.getByLabelText('Berufsgruppe / Qualifikation')).toBeDisabled();
  expect(screen.getByLabelText('Fachkompetenz auswählen')).toBeDisabled();
  fireEvent.click(screen.getByText('Fachkompetenz'));
  expect(props.onToggle).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Wird übernommen …' })).toBeDisabled();
});


it('offers the assistant template even when the qualification catalogue only has legacy default names', () => {
  render(<RecommendedCompetenciesModal
    {...props}
    employeeQualification="1-jährig examiniert"
    qualifications={['3-jährig examiniert', '1-jährig examiniert', 'Pflegekraft/-helfer']}
  />);
  expect(screen.getByRole('option', { name: 'Pflegefachassistenz' })).toBeInTheDocument();
  expect(screen.getByLabelText('Berufsgruppe / Qualifikation')).toHaveValue('1-jährig examiniert');
  fireEvent.change(screen.getByLabelText('Berufsgruppe / Qualifikation'), { target: { value: 'Pflegefachassistenz' } });
  expect(props.onQualificationChange).toHaveBeenCalledWith('Pflegefachassistenz');
});

it('keeps catalogue review visible without presenting a source group as permission', () => {
  render(<RecommendedCompetenciesModal {...props} definitions={[
    { id: 4, name: 'Stomaversorgung', relevance: 'HKP G1; HKP G2; HKP G3', reviewStatus: 'pending', templateKey: 'hkp-nrw:032276', note: 'Betriebliche Anwendbarkeit prüfen' },
    { id: 5, name: 'Wechsel s.c.-Infusion', relevance: 'HKP G1; HKP G2', reviewStatus: 'pending' },
  ]} employeeQualification="Pflegefachassistenz" assignedIds={[]} />);
  expect(screen.getByLabelText('Stomaversorgung auswählen')).toBeInTheDocument();
  expect(screen.queryByLabelText('Wechsel s.c.-Infusion auswählen')).not.toBeInTheDocument();
  expect(screen.getByText('Vorlage ungeprüft')).toHaveAttribute('title', 'Betriebliche Anwendbarkeit prüfen');
});
