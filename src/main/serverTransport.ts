export const MAX_SERVER_SNAPSHOT = 32 * 1024 * 1024;

export function normalizeServerUrl(value: string): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Bitte nur die Serveradresse ohne Pfad, Zugangsdaten oder Parameter eingeben.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Der Server benötigt HTTPS. HTTP ist nur auf diesem Gerät erlaubt.');
  }
  return url.origin;
}

export async function serverRequest(url: string, route: string, options: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${normalizeServerUrl(url)}${route}`, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Server nicht erreichbar. Es wird nicht auf lokale Daten ausgewichen. Bei einer unterbrochenen Speicherung den Serverbestand neu laden und das Ergebnis prüfen.');
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Anmeldung fehlgeschlagen oder Sitzung abgelaufen. Bitte erneut verbinden.',
      403: 'Dieses Konto hat keine Berechtigung für diese Aktion.',
      409: 'Der Serverbestand wurde geändert. Bitte neu laden und die Änderung erneut ausführen.',
      413: 'Der Datenbestand überschreitet die Grenze von 32 MiB.',
      429: 'Zu viele Anmeldeversuche. Bitte eine Minute warten.',
    };
    await response.body?.cancel();
    throw new Error(messages[response.status] ?? 'Der Server konnte die Anfrage nicht verarbeiten.');
  }
  return response;
}

export async function readBoundedResponse(response: Response, limit = MAX_SERVER_SNAPSHOT): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      const { value } = chunk;
      size += value.length;
      if (size > limit) throw new Error('Die Serverantwort ist zu groß.');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel(); }
}
