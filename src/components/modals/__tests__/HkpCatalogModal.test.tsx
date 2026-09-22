import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HkpCatalogModal from '../HkpCatalogModal';
import { hkpCatalog } from '../../../shared/hkpCatalog';
const importHkp = vi.hoisted(() => vi.fn());
vi.mock('../../../services/api', () => ({ default: { competencies: { importHkp } } }));
beforeEach(() => { vi.clearAllMocks(); importHkp.mockResolvedValue([]); });

it('requires a selection and excludes existing definitions from import', async () => {
  const onImported = vi.fn();
  const existing = { ...hkpCatalog[0], id: 99, name: 'Eigene Blutdruckmessung' };
  render(<HkpCatalogModal definitions={[existing]} onImported={onImported} onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: '0 ergänzen' })).toBeDisabled();
  expect(screen.getByLabelText(/032201.*auswählen/)).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Alle neuen auswählen' }));
  fireEvent.click(screen.getByRole('button', { name: '49 ergänzen' }));
  await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
  expect(importHkp).toHaveBeenCalledWith(hkpCatalog.slice(1).map((row) => row.templateKey));
});

it('clears hidden selections when changing group and retains errors for retry', async () => {
  importHkp.mockRejectedValue(new Error('Verbindung fehlt'));
  const onClose = vi.fn();
  render(<HkpCatalogModal definitions={[]} onImported={vi.fn()} onClose={onClose} />);
  fireEvent.click(screen.getByLabelText(/032201.*auswählen/));
  fireEvent.change(screen.getByLabelText('Berufsgruppe'), { target: { value: 'HKP G3' } });
  expect(screen.getByRole('button', { name: '0 ergänzen' })).toBeDisabled();
  expect(screen.queryByLabelText(/032591.*auswählen/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/032276.*auswählen/));
  fireEvent.click(screen.getByRole('button', { name: '1 ergänzen' }));
  await screen.findByText('Verbindung fehlt');
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/032276.*auswählen/)).toBeChecked();
});
