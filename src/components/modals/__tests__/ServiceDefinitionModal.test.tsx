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
});
