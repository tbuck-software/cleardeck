/** Electron stellt abgelehnten IPC-Aufrufen den Namen der Fernmethode voran. */
const remoteMethodPrefix = /^Error invoking remote method\s+["']?[^"']+["']?:\s*(?:Error:\s*)?/i;

/** Convert transport details into a useful message for the person using the app. */
export const userFacingErrorMessage = (error: unknown, fallback = 'Unbekannter Fehler'): string => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.replace(remoteMethodPrefix, '').trim() || fallback;
};
