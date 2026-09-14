import type { ConfirmState } from '../types/ui';

export const waitingChangesLabel = (count: number) =>
  count === 1 ? '1 Änderung wartet' : `${count} Änderungen warten`;

export const switchToLocalConfirm = (pendingChanges: number, onConfirm: () => void): ConfirmState => ({
  title: 'Zum lokalen Bestand wechseln?',
  message: [
    'Der lokale Bestand dieses Geräts wird geöffnet. Serverdaten werden nicht in den lokalen Bestand übertragen.',
    pendingChanges > 0 &&
      `${waitingChangesLabel(pendingChanges)} noch auf Übertragung und ${pendingChanges === 1 ? 'bleibt' : 'bleiben'} für die nächste Anmeldung mit diesem Konto gespeichert.`,
  ]
    .filter(Boolean)
    .join(' '),
  confirmLabel: 'Lokalen Bestand öffnen',
  onConfirm,
});
