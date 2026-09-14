export type ServerRole = 'reader' | 'editor' | 'admin';

export type SyncStatus =
  | 'synced'
  | 'pending'
  | 'offline'
  | 'syncing'
  | 'conflict'
  | 'auth-required'
  | 'error';

export type ServerConnection = {
  mode: 'local' | 'server';
  url?: string;
  username?: string;
  instanceId?: string;
  /** The local workspace is unlocked; network availability is reported separately. */
  connected?: boolean;
  role?: ServerRole;
  syncStatus?: SyncStatus;
  pendingChanges?: number;
  lastSyncedAt?: string;
  syncError?: string;
  hasOfflineCopy?: boolean;
  dataVersion?: number;
};

export type ConnectServerInput = {
  url: string;
  username: string;
  password: string;
  initialize: boolean;
  /** Explicitly unlock the previously authenticated local copy without contacting the server. */
  offline?: boolean;
};
