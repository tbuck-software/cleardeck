import { createServer } from 'node:http';

const MAX_SNAPSHOT = 32 * 1024 * 1024;
const MAX_LOGIN = 8192;
const ENCRYPTED_HEADER = /^CLEARDECK-BACKUP-1:[a-f0-9]{64}\n/;
const ENCRYPTED_HEADER_BYTES = 'CLEARDECK-BACKUP-1:'.length + 64 + 1;

async function body(request, limit, collect = true) {
  const contentLength = Number(request.headers['content-length']);
  if (Number.isSafeInteger(contentLength) && contentLength > limit) {
    request.resume();
    throw Object.assign(new Error('Anfrage zu groß.'), { status: 413 });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) {
      request.resume();
      throw Object.assign(new Error('Anfrage zu groß.'), { status: 413 });
    }
    if (collect) chunks.push(bytes);
  }
  return collect ? Buffer.concat(chunks) : null;
}

export function createApp(store) {
  // A single instance is deliberately bounded; configure additional throttling at the proxy.
  const attempts = new Map();
  let activeLogins = 0;
  function rateLimited(key) {
    const now = Date.now();
    for (const [entry, value] of attempts) if (value.until < now) attempts.delete(entry);
    const previous = attempts.get(key) ?? { count: 0, until: now + 60_000 };
    previous.count++;
    if (attempts.size >= 2000 && !attempts.has(key)) return true;
    attempts.set(key, previous);
    return previous.count > 10;
  }
  const server = createServer(async (request, response) => {
    const send = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (request.headers.origin) {
        let limit = null;
        if (request.method === 'PUT') limit = MAX_SNAPSHOT;
        else if (request.url === '/v1/login' && request.method === 'POST') limit = MAX_LOGIN;
        if (limit) await body(request, limit, false);
        return send(403, { error: 'Browserzugriff wird nicht unterstützt.' });
      }
      if (request.url === '/health' && request.method === 'GET') return send(200, { ok: true });
      if (request.url === '/v1/login' && request.method === 'POST') {
        if (activeLogins >= 4 || rateLimited(request.socket.remoteAddress ?? 'unknown')) {
          response.setHeader('Retry-After', '60');
          return send(429, { error: 'Zu viele Anmeldeversuche. Bitte eine Minute warten.' });
        }
        activeLogins++;
        try {
          const input = JSON.parse((await body(request, MAX_LOGIN)).toString());
          if (!input || typeof input.username !== 'string' || input.username.length > 120 || typeof input.password !== 'string') {
            return send(400, { error: 'Ungültige Anmeldung.' });
          }
          const session = await store.login(input.username, input.password);
          return session ? send(200, { protocol: 1, ...session }) : send(401, { error: 'Anmeldung fehlgeschlagen.' });
        } finally { activeLogins--; }
      }
      const authorization = request.headers.authorization ?? '';
      const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)?.[1];
      const account = token ? await store.authenticate(token) : null;
      // Drain PUT bodies through the cap even when auth or write permission
      // fails. The discard path keeps rejected uploads out of memory and
      // leaves persistent HTTP/1.1 connections in a clean parser state.
      if (!account) {
        if (request.method === 'PUT') await body(request, MAX_SNAPSHOT, false);
        return send(401, { error: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
      }
      let payload = null;
      if (request.method === 'PUT') {
        if (request.url !== '/v1/snapshot' || account.role !== 'editor') {
          await body(request, MAX_SNAPSHOT, false);
          if (request.url === '/v1/snapshot' && account.role !== 'editor') {
            return send(403, { error: 'Dieses Konto darf nur lesen.' });
          }
        } else {
          payload = await body(request, MAX_SNAPSHOT);
        }
      }
      if (request.url === '/v1/session' && request.method === 'DELETE') {
        await store.logout(token);
        return send(200, { ok: true });
      }
      if (request.url !== '/v1/snapshot') return send(404, { error: 'Unbekannter Endpunkt.' });
      if (request.method === 'HEAD' || request.method === 'GET') {
        const snapshot = request.method === 'HEAD' ? await store.metadata() : await store.read();
        response.setHeader('ETag', `"${snapshot.revision}"`);
        response.setHeader('X-ClearDeck-Instance', snapshot.instanceId);
        response.writeHead(snapshot.revision === 0 ? 204 : 200, { 'Content-Type': 'application/octet-stream' });
        return response.end(request.method === 'HEAD' ? undefined : snapshot.payload);
      }
      if (request.method === 'PUT') {
        const match = /^"(\d{1,9})"$/.exec(request.headers['if-match'] ?? '');
        if (!match) return send(428, { error: 'Die Version des Datenbestands fehlt.' });
        const metadata = await store.metadata();
        if (request.headers['x-cleardeck-instance'] !== metadata.instanceId) {
          return send(409, { error: 'Die Serverinstanz hat sich geändert. Bitte neu verbinden.' });
        }
        if (request.headers['content-type'] !== 'application/octet-stream') return send(415, { error: 'Verschlüsselter Datenbestand erwartet.' });
        if (!ENCRYPTED_HEADER.test(payload.subarray(0, ENCRYPTED_HEADER_BYTES).toString()) || payload.length < 128) {
          return send(400, { error: 'Verschlüsselter ClearDeck-Datenbestand erwartet.' });
        }
        const result = await store.write(Number(match[1]), payload, account.username, metadata.instanceId, token);
        if (result?.forbidden) return send(403, { error: 'Schreibzugriff wurde entzogen.' });
        if (!result) return send(409, { error: 'Der Bestand wurde auf einem anderen Gerät geändert. Neu laden und Änderung erneut ausführen.' });
        return send(200, result);
      }
      return send(405, { error: 'Methode nicht erlaubt.' });
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        send(error instanceof SyntaxError ? 400 : error.status ?? 500, {
          error: error.status === 413 ? 'Anfrage zu groß.' : 'Die Anfrage konnte nicht verarbeitet werden.',
        });
      }
      // Never log request bodies, database errors, passwords or patient data.
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 100;
  return server;
}
