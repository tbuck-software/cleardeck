import type { UpdateStatus } from '../../shared/types';
import UpdateControl from '../ui/UpdateControl';

type AuthUpdatesProps = {
  status: UpdateStatus;
  version?: string;
  onCheck: () => Promise<void>;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
};

const AuthUpdates = ({ status, version, onCheck, onDownload, onInstall }: AuthUpdatesProps) => (
  <div className="auth-updates">
    {version && <p>ClearDeck {version}</p>}
    <UpdateControl status={status} onCheck={onCheck} onDownload={onDownload} onInstall={onInstall} />
  </div>
);

export default AuthUpdates;
