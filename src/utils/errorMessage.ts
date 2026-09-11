const operationPrefixes = [
  /^API\s+[\w.-]+\s+failed:\s*/i,
  /^IPC\s+[\w.-]+(?:\s+failed)?:\s*/i,
  /^Error invoking remote method\s+["']?[^"']+["']?:\s*/i,
  /^Error:\s*/i,
];

/** Convert transport details into a useful message for the person using the app. */
export const userFacingErrorMessage = (error: unknown): string => {
  let message = error instanceof Error ? error.message : String(error ?? '');
  for (const prefix of operationPrefixes) message = message.replace(prefix, '');
  return message.trim() || 'Unbekannter Fehler';
};
