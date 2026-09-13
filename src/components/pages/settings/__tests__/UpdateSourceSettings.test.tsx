/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  updates: {
    getPreferences: vi.fn(),
    savePreferences: vi.fn(),
  },
}));

vi.mock('../../../../services/api', () => ({ api: apiMock, default: apiMock }));

import UpdateSourceSettings from '../UpdateSourceSettings';

const defaultPreferences = {
  repositoryUrl: 'https://github.com/Rasalas/employee-db',
  hasToken: false,
};

const openSettings = async (preferences = defaultPreferences) => {
  apiMock.updates.getPreferences.mockResolvedValue(preferences);
  render(<UpdateSourceSettings />);
  await waitFor(() => expect(apiMock.updates.getPreferences).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByText('Update-Quelle'));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpdateSourceSettings', () => {
  it('loads the repository URL and keeps the token value hidden', async () => {
    await openSettings({ ...defaultPreferences, hasToken: true });

    expect(screen.getByLabelText('GitHub-Repository')).toHaveValue(defaultPreferences.repositoryUrl);
    expect(screen.getByLabelText('Persönlicher Zugriffstoken')).toHaveValue('');
    expect(screen.getByLabelText('Persönlicher Zugriffstoken')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Gespeicherten Token entfernen' })).toBeInTheDocument();
  });

  it('saves the URL and optional token, then clears the token field', async () => {
    await openSettings();
    apiMock.updates.savePreferences.mockResolvedValue({
      repositoryUrl: 'https://github.com/example/private-app',
      hasToken: true,
    });

    fireEvent.change(screen.getByLabelText('GitHub-Repository'), {
      target: { value: 'https://github.com/example/private-app' },
    });
    fireEvent.change(screen.getByLabelText('Persönlicher Zugriffstoken'), {
      target: { value: 'synthetic-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update-Quelle speichern' }));

    await waitFor(() => expect(apiMock.updates.savePreferences).toHaveBeenCalledWith({
      repositoryUrl: 'https://github.com/example/private-app',
      token: 'synthetic-token',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Update-Quelle gespeichert.');
    expect(screen.getByLabelText('Persönlicher Zugriffstoken')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Gespeicherten Token entfernen' })).toBeInTheDocument();
  });

  it('omits an empty token so an existing token stays saved', async () => {
    await openSettings({ ...defaultPreferences, hasToken: true });
    apiMock.updates.savePreferences.mockResolvedValue({ ...defaultPreferences, hasToken: true });

    fireEvent.click(screen.getByRole('button', { name: 'Update-Quelle speichern' }));

    await waitFor(() => expect(apiMock.updates.savePreferences).toHaveBeenCalledWith({
      repositoryUrl: defaultPreferences.repositoryUrl,
    }));
  });

  it('removes a saved token explicitly', async () => {
    await openSettings({ ...defaultPreferences, hasToken: true });
    apiMock.updates.savePreferences.mockResolvedValue(defaultPreferences);

    fireEvent.click(screen.getByRole('button', { name: 'Gespeicherten Token entfernen' }));

    await waitFor(() => expect(apiMock.updates.savePreferences).toHaveBeenCalledWith({
      repositoryUrl: defaultPreferences.repositoryUrl,
      token: '',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeicherten Token entfernt.');
    expect(screen.queryByRole('button', { name: 'Gespeicherten Token entfernen' })).not.toBeInTheDocument();
  });

  it('keeps the optional token control concise without exposing credentials', async () => {
    await openSettings();

    expect(screen.getByLabelText('Persönlicher Zugriffstoken')).toHaveAttribute(
      'placeholder',
      'Optional für private Repositories',
    );
    expect(screen.queryByText('synthetic-token')).not.toBeInTheDocument();
  });

  it('shows cleaned API errors when saving fails', async () => {
    await openSettings();
    apiMock.updates.savePreferences.mockRejectedValue(
      new Error(
        'Error invoking remote method "updates.savePreferences": Error: Die Repository-URL ist ungültig.',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update-Quelle speichern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Repository-URL ist ungültig.');
  });
});
