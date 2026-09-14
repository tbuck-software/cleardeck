import { createServer } from 'node:http';

const MAX_SNAPSHOT = 32 * 1024 * 1024;
const MAX_LOGIN = 8192;
const MAX_SYNC_BODY = 32 * 1024 * 1024;
const ENCRYPTED_HEADER = /^CLEARDECK-BACKUP-1:[a-f0-9]{64}\n/;
const ENCRYPTED_HEADER_BYTES = 'CLEARDECK-BACKUP-1:'.length + 64 + 1;
const canWrite = (role) => role === 'editor' || role === 'admin';

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
    const sendError = (error) => {
      const status = error instanceof SyntaxError ? 400 : error.status ?? 500;
      const value = {
        error: status === 413 ? 'Anfrage zu groß.' : status === 500 ? 'Die Anfrage konnte nicht verarbeitet werden.' : error.message,
      };
      if (error.details && typeof error.details === 'object') {
        if (error.details.instanceId) value.instanceId = error.details.instanceId;
        if (error.details.conflict) value.conflict = error.details.conflict;
      }
      send(status, value);
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const route = new URL(request.url ?? '/', 'http://cleardeck.invalid');
      if (request.headers.origin) {
        let limit = null;
        if (request.method === 'PUT') limit = MAX_SNAPSHOT;
        else if ((route.pathname === '/v1/login' || route.pathname === '/v2/login') && request.method === 'POST') limit = MAX_LOGIN;
        else if (route.pathname === '/v2/transactions' && request.method === 'POST') limit = MAX_SYNC_BODY;
        if (limit) await body(request, limit, false);
        return send(403, { error: 'Browserzugriff wird nicht unterstützt.' });
      }
      if (route.pathname === '/health' && request.method === 'GET') return send(200, { ok: true });
      if (route.pathname === '/v1/login' && request.method === 'POST') {
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
      if (route.pathname === '/v2/login' && request.method === 'POST') {
        if (activeLogins >= 4 || rateLimited(request.socket.remoteAddress ?? 'unknown')) {
          response.setHeader('Retry-After', '60');
          return send(429, { error: 'Zu viele Anmeldeversuche. Bitte eine Minute warten.' });
        }
        activeLogins++;
        try {
          const bytes = await body(request, MAX_LOGIN);
          if (request.headers['content-type']?.split(';', 1)[0].trim() !== 'application/json') {
            return send(415, { error: 'JSON-Anmeldung erwartet.' });
          }
          const input = JSON.parse(bytes.toString());
          const fields = input && typeof input === 'object' && !Array.isArray(input) ? Object.keys(input) : [];
          if (fields.length !== 3 || !fields.every((field) => ['username', 'password', 'deviceId'].includes(field)) ||
              typeof input.username !== 'string' || input.username.length > 120 ||
              typeof input.password !== 'string' || typeof input.deviceId !== 'string') {
            return send(400, { error: 'Ungültige Anmeldung.' });
          }
          const session = await store.loginV2(input.username, input.password, input.deviceId);
          return session ? send(200, session) : send(401, { error: 'Anmeldung fehlgeschlagen.' });
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
        else if (route.pathname === '/v2/transactions' && request.method === 'POST') await body(request, MAX_SYNC_BODY, false);
        return send(401, { error: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
      }
      let payload = null;
      if (request.method === 'PUT') {
        if (route.pathname !== '/v1/snapshot' || !canWrite(account.role)) {
          await body(request, MAX_SNAPSHOT, false);
          if (route.pathname === '/v1/snapshot' && !canWrite(account.role)) {
            return send(403, { error: 'Dieses Konto darf nur lesen.' });
          }
        } else {
          payload = await body(request, MAX_SNAPSHOT);
        }
      }
      if (route.pathname === '/v2/session' && request.method === 'DELETE') {
        await store.logoutV2(token);
        return send(200, { ok: true });
      }
      if (route.pathname === '/v2/changes' && request.method === 'GET') {
        const sinceText = route.searchParams.get('since') ?? '0';
        const limitText = route.searchParams.get('limit') ?? '1000';
        if (!/^\d{1,15}$/.test(sinceText) || !/^\d{1,5}$/.test(limitText)) return send(400, { error: 'Ungültiger Synchronisationszeiger.' });
        return send(200, await store.changesV2(token, Number(sinceText), Number(limitText)));
      }
      if (route.pathname === '/v2/transactions' && request.method === 'POST') {
        if (!canWrite(account.role)) {
          await body(request, MAX_SYNC_BODY, false);
          return send(403, { error: 'Dieses Konto darf nur lesen.' });
        }
        if (request.headers['content-type']?.split(';', 1)[0].trim() !== 'application/json') {
          await body(request, MAX_SYNC_BODY, false);
          return send(415, { error: 'JSON-Transaktion erwartet.' });
        }
        payload = JSON.parse((await body(request, MAX_SYNC_BODY)).toString());
        return send(200, await store.transactionV2(token, payload));
      }
      if (route.pathname === '/v1/session' && request.method === 'DELETE') {
        await store.logout(token);
        return send(200, { ok: true });
      }
      if (route.pathname !== '/v1/snapshot') return send(404, { error: 'Unbekannter Endpunkt.' });
      if (request.method === 'HEAD' || request.method === 'GET') {
        const snapshot = await store.read();
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
        if (result?.protocol2) return send(409, { error: 'Dieser Arbeitsbereich verwendet bereits das Protokoll 2. Bitte den v2-Datenbestand verwenden.' });
        if (!result) return send(409, { error: 'Der Bestand wurde auf einem anderen Gerät geändert. Neu laden und Änderung erneut ausführen.' });
        return send(200, result);
      }
      return send(405, { error: 'Methode nicht erlaubt.' });
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        sendError(error);
      }
      // Never log request bodies, database errors, passwords or patient data.
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 100;
  return server;
}
