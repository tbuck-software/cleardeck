import type { DiagnosticSnapshot } from './types';

export const formatDiagnostics = (snapshot: DiagnosticSnapshot): string => [
  'ClearDeck · lokale Diagnose',
  'Enthält nur App-Start und Update-Ereignisse. Keine Datenbankinhalte oder Zugangsdaten.',
  snapshot.storageError ?? '',
  ...snapshot.entries.map((entry) => `${entry.at} [${entry.level.toUpperCase()}] ${entry.source}: ${entry.message}`),
].filter(Boolean).join('\n');
