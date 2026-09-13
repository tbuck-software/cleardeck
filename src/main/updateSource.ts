import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

export type PackagedUpdateConfig = {
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

export type UpdateSourceInput = {
  updateFeedUrl?: string;
  /** Legacy environment token. It can authenticate an explicitly private package. */
  ghToken?: string;
  /** A token supplied deliberately for this local installation. */
  runtimeToken?: string;
  /** Saved owner/repository settings for this local installation. */
  runtimeOwner?: string;
  runtimeRepo?: string;
  /** Equivalent grouped form for callers that read the local settings once. */
  runtimeCredentials?: { owner: string; repo: string; token?: string } | null;
  packagedConfig?: PackagedUpdateConfig | null;
};

const MANUAL_UPDATE_REASON =
  'Auto-Updates sind fuer private Releases ohne Zugriffstoken nicht verfuegbar. Bitte die neue Version manuell installieren.';

const DEFAULT_GITHUB_OWNER = 'Rasalas';
const DEFAULT_GITHUB_REPO = 'employee-db';

/**
 * Keep a generic feed usable while making credentials safe for UI and log
 * messages. Diagnostic URLs do not need query strings or fragments. The
 * source itself is not changed; this is only for display.
 */
export const redactUpdateFeedUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    let changed = false;
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
      changed = true;
    }
    if (parsed.search || parsed.hash) {
      parsed.search = '';
      parsed.hash = '';
      changed = true;
    }
    return changed ? parsed.toString() : value;
  } catch {
    return '[redacted update feed URL]';
  }
};

export const getPackagedUpdateConfig = (
  resourcesPath: string,
): PackagedUpdateConfig | null => {
  const configPath = path.join(resourcesPath, 'app-update.yml');
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = (parse(raw) as PackagedUpdateConfig) ?? null;
    return config ? { ...config, private: config.private ?? false } : null;
  } catch {
    return null;
  }
};

export const resolveUpdateSource = (input: UpdateSourceInput): UpdateSource => {
  if (input.updateFeedUrl) {
    return { kind: 'generic', url: input.updateFeedUrl };
  }

  // The packaged declaration is the release owner's decision about whether
  // this feed is public. A normal GH_TOKEN must not change that decision.
  // A local token is an explicit request to try the same repository with
  // authentication. The updater can fall back to the anonymous source if it
  // cannot use that token.
  const savedOwner = input.runtimeCredentials?.owner?.trim() || input.runtimeOwner?.trim();
  const savedRepo = input.runtimeCredentials?.repo?.trim() || input.runtimeRepo?.trim();
  const runtimeToken = (input.runtimeCredentials?.token || input.runtimeToken)?.trim();
  const runtimeConfigProvided = input.runtimeCredentials != null
    || input.runtimeOwner !== undefined
    || input.runtimeRepo !== undefined
    || input.runtimeToken !== undefined;
  const owner = savedOwner || input.packagedConfig?.owner || DEFAULT_GITHUB_OWNER;
  const repo = savedRepo || input.packagedConfig?.repo || DEFAULT_GITHUB_REPO;
  const packagedGithub = input.packagedConfig?.provider === 'github';
  if (packagedGithub && (input.packagedConfig?.private === true || runtimeToken || savedOwner || savedRepo)) {
    // An inherited environment token is valid only when the packaged feed
    // explicitly opts into private GitHub releases and no local source
    // settings were supplied. Saved owner/repository settings alone select
    // an anonymous feed, even if the packaged declaration was private.
    const token = runtimeToken || (!runtimeConfigProvided && input.packagedConfig?.private === true
      ? input.ghToken?.trim()
      : undefined);
    if (input.packagedConfig?.private === true && !runtimeConfigProvided && !token) {
      return { kind: 'unavailable', reason: MANUAL_UPDATE_REASON };
    }

    return {
      kind: 'github',
      owner,
      repo,
      private: Boolean(token),
      ...(token ? { token } : {}),
    };
  }

  if (runtimeToken || savedOwner || savedRepo) {
    return {
      kind: 'github',
      owner,
      repo,
      private: Boolean(runtimeToken),
      ...(runtimeToken ? { token: runtimeToken } : {}),
    };
  }

  if (!input.packagedConfig) {
    return {
      kind: 'unavailable',
      reason: 'Kein Update-Feed konfiguriert. Bitte die neue Version manuell installieren.',
    };
  }

  return { kind: 'packaged' };
};

export const manualUpdateReason = MANUAL_UPDATE_REASON;
