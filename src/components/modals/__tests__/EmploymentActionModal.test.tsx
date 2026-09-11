/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmploymentActionModal from '../EmploymentActionModal';
import type { EmployeeWithPeriod, QualificationType } from '../../../shared/types';

const employee: EmployeeWithPeriod = {
  id: 11,
  periodId: 21,
  name: 'Synthetic Action',
  qualification: 'Einarbeitung',
  startDate: '2024-01-01',
  endDate: null,
  weeklyHours: 18,
  fte: 0.5,
  hoursVerified: false,
  status: 'active',
};
const qualifications: QualificationType[] = [
  { id: 1, name: 'Einarbeitung' },
  { id: 2, name: 'Pflegefachkraft' },
];

it('previews the closed previous period and new qualification start', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <EmploymentActionModal
      open
      mode="qualification"
      employee={employee}
      periods={[{ id: 21, employeeId: 11, startDate: '2024-01-01', endDate: null, qualification: 'Einarbeitung' }]}
      qualifications={qualifications}
      onClose={vi.fn()}
      onSave={onSave}
    />,
  );

  fireEvent.change(screen.getByLabelText('Wechsel ab'), { target: { value: '2025-02-01' } });
  fireEvent.change(screen.getByLabelText('Neue Qualifikation'), { target: { value: 'Pflegefachkraft' } });
  expect(screen.getByRole('status')).toHaveTextContent('bis 31.01.2025');
  expect(screen.getByRole('status')).toHaveTextContent('ab 01.02.2025');
  expect(screen.getByText(/bestätigt keine Altdaten/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    mode: 'qualification', periodId: 21, effectiveFrom: '2025-02-01', qualification: 'Pflegefachkraft',
  }));
});
