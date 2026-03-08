import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

type PackagedUpdateConfig = {
  provider?: string;
  owner?: string;
  repo?: string;
  private?: boolean;
};

export type UpdateSource =
  | { kind: 'generic'; url: string }
  | { kind: 'github'; owner: string; repo: string; private: boolean; token?: string }
  | { kind: 'packaged' }
  | { kind: 'unavailable'; reason: string };

const MANUAL_UPDATE_REASON =
  'Auto-Updates sind fuer private Releases ohne Zugriffstoken nicht verfuegbar. Bitte die neue Version manuell installieren.';

export const getPackagedUpdateConfig = (
  resourcesPath: string,
): PackagedUpdateConfig | null => {
  const configPath = path.join(resourcesPath, 'app-update.yml');
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, 'utf8');
    return (parse(raw) as PackagedUpdateConfig) ?? null;
  } catch {
    return null;
  }
};

export const resolveUpdateSource = (input: {
  updateFeedUrl?: string;
  ghToken?: string;
  packagedConfig?: PackagedUpdateConfig | null;
}): UpdateSource => {
  if (input.updateFeedUrl) {
    return { kind: 'generic', url: input.updateFeedUrl };
  }

  if (input.ghToken) {
    const owner = input.packagedConfig?.owner || 'Rasalas';
    const repo = input.packagedConfig?.repo || 'employee-db';
    return {
      kind: 'github',
      owner,
      repo,
      private: input.packagedConfig?.private ?? true,
      token: input.ghToken,
    };
  }

  if (!input.packagedConfig) {
    return {
      kind: 'unavailable',
      reason: 'Kein Update-Feed konfiguriert. Bitte die neue Version manuell installieren.',
    };
  }

  if (input.packagedConfig.provider === 'github' && input.packagedConfig.private) {
    return { kind: 'unavailable', reason: MANUAL_UPDATE_REASON };
  }

  return { kind: 'packaged' };
};

export const manualUpdateReason = MANUAL_UPDATE_REASON;
