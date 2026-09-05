import React from 'react';
import UpdatePopover from '../ui/UpdatePopover';
import type { UpdateStatus } from '../../shared/types';

type AuthUpdatesProps = {
  status: UpdateStatus;
  version?: string;
  onCheck: () => Promise<void>;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
};

/**
 * The lock screen's corner. Same popover as in the app, opening upward — so an
 * update reads the same before and after unlocking.
 */
const AuthUpdates = ({ status, version, onCheck, onDownload, onInstall }: AuthUpdatesProps) => (
  <div className="auth-updates">
    {version && <span className="cd-muted-13">ClearDeck {version}</span>}
    <UpdatePopover
      status={status}
      placement="corner"
      currentVersion={version}
      onCheck={onCheck}
      onDownload={onDownload}
      onInstall={onInstall}
    />
  </div>
);

export default AuthUpdates;
