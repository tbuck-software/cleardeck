/**
 * The update source shown in settings. Keep this type free of credentials so
 * it can cross the preload boundary safely.
 */
export type UpdatePreferences = {
  repositoryUrl: string;
  hasToken: boolean;
};

/** Values accepted by the settings form. An omitted token keeps a saved one. */
export type SaveUpdatePreferencesInput = {
  repositoryUrl: string;
  token?: string;
};

/** Main-process-only credentials consumed by the updater. */
export type UpdateCredentials = {
  owner: string;
  repo: string;
  token?: string;
};

export const DEFAULT_UPDATE_OWNER = 'tbuck-software';
export const DEFAULT_UPDATE_REPO = 'cleardeck';
export const DEFAULT_UPDATE_REPOSITORY_URL =
  `https://github.com/${DEFAULT_UPDATE_OWNER}/${DEFAULT_UPDATE_REPO}`;
