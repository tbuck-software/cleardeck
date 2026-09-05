/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import AuditModal from '../AuditModal';
import type { AuditSectionDefinition, PatientWithLatestVisit } from '../../../shared/types';
import type { AuditModalState } from '../../../types/ui';

const patients: PatientWithLatestVisit[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  name: `${['Adelheid', 'Bruno', 'Charlotte', 'Dieter'][index % 4]} ${['Busch', 'Ebert', 'Hoff', 'Keller', 'Lange'][index % 5]} ${index}`,
  cognitionImpaired: true,
  mobilityImpaired: false,
}));

const sections: AuditSectionDefinition[] = [
  { key: 'qb1', name: 'QB 1', scale: 'abcd' },
  { key: 'qb4', name: 'QB 4', scale: 'text' },
  { key: 'qb5', name: 'QB 5', scale: 'yesno' },
];

const baseModal: AuditModalState = {
  open: true,
  mode: 'create',
  auditDate: '2026-09-05',
  inspector: '',
  kind: 'regel',
  findings: '',
  results: { qb1: 'A', qb4: 'text', qb5: 'ok' },
  clientIds: [],
};

const noop = (): void => undefined;

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof AuditModal>> = {},
): ReturnType<typeof render> =>
  render(
    <AuditModal
      modal={baseModal}
      sections={sections}
      patients={patients}
      onChange={noop}
      onClose={noop}
      onSave={noop}
      {...overrides}
    />,
  );

describe('AuditModal · Klient:innen-Auswahl', () => {
  it('rendert nicht die gesamte Namensliste', () => {
    renderModal();

    patients.forEach((patient) => {
      expect(screen.queryByText(patient.name)).not.toBeInTheDocument();
    });
    expect(screen.getByText('Noch niemand gewählt — über die Suche hinzufügen.')).toBeInTheDocument();
  });

  it('zeigt Treffer erst beim Suchen und deckelt sie', () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Nach Name suchen und hinzufügen'), {
      target: { value: 'Adelheid' },
    });

    // 10 Personen heißen Adelheid, gezeigt werden höchstens 6.
    const hits = screen.getAllByRole('button', { name: /Adelheid/ });
    expect(hits).toHaveLength(6);
  });

  it('übernimmt einen Treffer und leert die Suche', () => {
    const onChange = vi.fn();
    renderModal({ onChange });

    const search = screen.getByPlaceholderText('Nach Name suchen und hinzufügen');
    fireEvent.change(search, { target: { value: patients[2].name } });
    // Der Name ist Präfix längerer Namen, daher der erste Treffer der Liste.
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(patients[2].name) })[0]);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clientIds: [3] }));
    expect(search).toHaveValue('');
  });

  it('zeigt Gewählte als entfernbare Chips mit Zähler', () => {
    renderModal({ modal: { ...baseModal, clientIds: [1, 2] } });

    expect(screen.getByText(/Geprüfte Klient:innen · 2 gewählt/)).toBeInTheDocument();
    expect(screen.getByText(patients[0].name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${patients[0].name} entfernen` })).toBeInTheDocument();
  });

  it('entfernt einen Gewählten wieder', () => {
    const onChange = vi.fn();
    renderModal({ modal: { ...baseModal, clientIds: [1, 2] }, onChange });

    fireEvent.click(screen.getByRole('button', { name: `${patients[0].name} entfernen` }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clientIds: [2] }));
  });

  it('bietet bereits Gewählte nicht erneut an', () => {
    renderModal({ modal: { ...baseModal, clientIds: [1] } });

    fireEvent.change(screen.getByPlaceholderText('Nach Name suchen und hinzufügen'), {
      target: { value: patients[0].name },
    });

    expect(screen.getByText('Keine weiteren Treffer.')).toBeInTheDocument();
  });

  it('kommt ohne Patient:innen klar', () => {
    renderModal({ patients: [] });

    expect(screen.getByText('Keine Patient:innen erfasst.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Nach Name suchen und hinzufügen')).not.toBeInTheDocument();
  });
});
