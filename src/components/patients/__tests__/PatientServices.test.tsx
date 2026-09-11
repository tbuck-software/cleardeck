/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, within } from '@testing-library/react';
import PatientModal from '../PatientModal';
import type { PatientModalState } from '../../../types/ui';
import type { ServiceDefinition } from '../../../shared/types';

const definitions: ServiceDefinition[] = [
  { id: 1, name: 'Große Grundpflege', serviceType: 's36-care', active: true },
  { id: 5, name: 'Kleine Grundpflege', serviceType: 's36-care', active: true },
  { id: 2, name: 'Hilfe bei der Haushaltsführung', serviceType: 'household', active: true },
  { id: 3, name: 'Beratungsbesuch', serviceType: 's37-consultation', active: true },
  { id: 4, name: 'Historische Körperpflege', serviceType: 's36-care', active: false },
];

const modal = (overrides: Partial<PatientModalState> = {}): PatientModalState => ({
  open: true,
  mode: 'create',
  name: 'Synthetische Person',
  birthDate: '',
  diagnosis: '',
  note: '',
  contact: '',
  admissionDate: '',
  cognitionImpaired: null,
  mobilityImpaired: null,
  hkpCode: null,
  intensiveCare: null,
  careLevel: null,
  serviceDefinitionIds: [],
  serviceScopeSource: 'services',
  ...overrides,
});

const renderModal = (state: PatientModalState, onChange = vi.fn()) => {
  render(
    <PatientModal
      modal={state}
      serviceDefinitions={definitions}
      onChange={onChange}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />,
  );
  return onChange;
};

describe('PatientModal Leistungsumfang', () => {
  it('zeigt alle Leistungen flach als Checkboxen und leitet den Grund ab', () => {
    const onChange = renderModal(modal());

    const list = screen.getByRole('group', { name: 'Vereinbarte Leistungen' });
    expect(list.querySelector('details')).toBeNull();
    expect(within(list).queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByLabelText('Große Grundpflege'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ serviceDefinitionIds: [1], serviceScopeSource: 'services' }),
    );
  });

  it('überschreibt nur Kategorien mit mehreren Einträgen und bündelt den Rest', () => {
    renderModal(modal());

    expect(screen.getByText('Körperbezogene Pflege nach § 36 SGB XI')).toBeInTheDocument();
    expect(screen.getByText('Weitere Leistungen')).toBeInTheDocument();
    expect(screen.queryByText('Hilfe bei der Haushaltsführung nach SGB XI')).toBeNull();
    expect(screen.queryByText('Beratungsbesuch nach § 37 Abs. 3 SGB XI')).toBeNull();
    expect(screen.getByLabelText('Hilfe bei der Haushaltsführung')).toBeInTheDocument();
  });

  it('lässt Leistungen unbekannt, ohne einen Einschluss zu erfinden', () => {
    renderModal(modal());

    expect(screen.getByText('MD-Personenliste: offen')).toBeInTheDocument();
    expect(screen.getByText('Leistungen sind noch nicht erfasst.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Als unbekannt führen' })).toBeNull();
  });

  it('bietet bei vorhandener Auswahl das Zurücksetzen auf unbekannt an', () => {
    const onChange = renderModal(modal({ serviceDefinitionIds: [1, 5] }));

    expect(screen.getByText('MD-Personenliste: ja')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Als unbekannt führen' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ serviceDefinitionIds: [], serviceScopeSource: 'services' }),
    );
  });

  it('zeigt eine alte Auswahl einmal als übernommene Entscheidung', () => {
    renderModal(modal({ mode: 'edit', serviceScope: 'eligible', serviceScopeSource: 'legacy' }));

    expect(screen.getByText('MD-Personenliste: ja')).toBeInTheDocument();
    expect(screen.getAllByText(/Übernommene Entscheidung/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Als unbekannt führen' })).toBeInTheDocument();
  });

  it('erklärt inaktive historische Zuordnungen und versteckt inaktive Einträge sonst', () => {
    renderModal(modal({ mode: 'edit', serviceDefinitionIds: [4] }));
    expect(screen.getByLabelText('Historische Körperpflege (inaktiv)')).toBeChecked();
  });

  it('blendet inaktive Einträge ohne Zuordnung aus', () => {
    renderModal(modal());
    expect(screen.queryByLabelText(/Historische Körperpflege/)).toBeNull();
  });
});
