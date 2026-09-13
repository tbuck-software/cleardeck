export type ServerConnection = {
  mode: 'local' | 'server';
  url?: string;
  username?: string;
  instanceId?: string;
  connected?: boolean;
  role?: 'reader' | 'editor';
};

export type ConnectServerInput = {
  url: string;
  username: string;
  password: string;
  dataKey: string;
  initialize: boolean;
};
