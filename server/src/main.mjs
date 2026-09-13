import { openStore } from './store.mjs';
import { createApp } from './http.mjs';

const store = await openStore(process.env.DATABASE_URL);
const server = createApp(store);
server.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? '127.0.0.1', () => {
  console.log('ClearDeck-Server gestartet.');
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(async () => { await store.close(); process.exit(0); });
});
