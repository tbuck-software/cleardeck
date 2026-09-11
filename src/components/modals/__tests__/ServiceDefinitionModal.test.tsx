/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import ServiceDefinitionModal from '../ServiceDefinitionModal';

describe('Leistungskatalog-Dialog', () => {
  it('erlaubt eigene Bezeichnung und Kategorie über die bestehende Formularauswahl', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <ServiceDefinitionModal
        state={{ open: true, name: 'Duschen', serviceType: 's36-care' }}
        onChange={onChange}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Neue Leistung' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Körperbezogene Pflege nach § 36 SGB XI' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kategorie für die MD-Personenliste'), {
      target: { value: 'household' },
    });
    fireEvent.change(screen.getByLabelText('Bezeichnung'), { target: { value: 'Wäsche' } });

    expect(onChange).toHaveBeenNthCalledWith(1, { serviceType: 'household' });
    expect(onChange).toHaveBeenNthCalledWith(2, { name: 'Wäsche' });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('schaltet eine gespeicherte Leistung aus dem Dialog ab', () => {
    const onToggleActive = vi.fn();
    render(
      <ServiceDefinitionModal
        state={{ open: true, id: 4, name: 'Duschen', serviceType: 's36-care' }}
        active
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggleActive={onToggleActive}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Deaktivieren' }));
    expect(onToggleActive).toHaveBeenCalledOnce();
  });

  it('bietet deaktivierten Leistungen die Reaktivierung an, neuen Leistungen nichts', () => {
    const { rerender } = render(
      <ServiceDefinitionModal
        state={{ open: true, id: 4, name: 'Duschen', serviceType: 's36-care' }}
        active={false}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggleActive={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Aktivieren' })).toBeInTheDocument();

    rerender(
      <ServiceDefinitionModal
        state={{ open: true, name: 'Duschen', serviceType: 's36-care' }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggleActive={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Aktivieren|Deaktivieren/ })).not.toBeInTheDocument();
  });
});
