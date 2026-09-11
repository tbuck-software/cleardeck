/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import PatientModal from '../PatientModal';
import type { PatientModalState } from '../../../types/ui';
import type { ServiceDefinition } from '../../../shared/types';

const definitions: ServiceDefinition[] = [
  { id: 1, name: 'Große Grundpflege', serviceType: 's36-care', active: true },
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

describe('PatientModal Leistungsumfang', () => {
  it('zeigt verständliche Mehrfachauswahl und leitet den Grund ab', () => {
    const onChange = vi.fn();
    render(
      <PatientModal
        modal={modal()}
        serviceDefinitions={definitions}
        onChange={onChange}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Welche Leistungen erbringt euer Dienst für diese Person?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Große Grundpflege'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ serviceDefinitionIds: [1], serviceScopeSource: 'services' }),
    );
  });

  it('lässt Leistungen unbekannt und zeigt keinen erfundenen Einschluss', () => {
    render(
      <PatientModal
        modal={modal()}
        serviceDefinitions={definitions}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Ungeklärt')[0]).toBeInTheDocument();
    expect(screen.getByText('Leistungen noch nicht erfasst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leistungen noch unbekannt' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('zeigt eine alte Auswahl als übernommene Entscheidung', () => {
    render(
      <PatientModal
        modal={modal({ mode: 'edit', serviceScope: 'eligible', serviceScopeSource: 'legacy' })}
        serviceDefinitions={definitions}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/Übernommene frühere Entscheidung/)).toBeInTheDocument();
  });

  it('öffnet Treffer bei der Suche und erklärt inaktive historische Zuordnungen', () => {
    render(
      <PatientModal
        modal={modal({ mode: 'edit', serviceDefinitionIds: [4] })}
        serviceDefinitions={definitions}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Historische Körperpflege (inaktiv)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Welche Leistungen erbringt euer Dienst für diese Person?'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Haushalt' } });
    const householdGroup = screen
      .getByLabelText('Hilfe bei der Haushaltsführung')
      .closest('details');
    expect(householdGroup).toHaveAttribute('open');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'gibt es nicht' } });
    expect(screen.getByText('Keine Leistungen gefunden.')).toBeInTheDocument();
  });
});
