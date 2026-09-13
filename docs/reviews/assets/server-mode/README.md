# Serverbetrieb – UI-Evidenz

Echte Electron-Aufnahmen aus dem Branch `feature/server-mode`, aufgenommen am 13.09.2026 bei 1400 × 868 CSS-Pixeln. Das Demo-Profil enthält ausschließlich synthetische Daten.

Der Ablauf wurde mit `CLEARDECK_DEMO_DEBUG=1 npm run demo` und CDP auf dem laufenden Electron-Fenster geprüft. Für den Server lief ein eigener temporärer PostgreSQL-16-Container auf Loopback mit den synthetischen Konten `qa-editor` und `qa-reader`. Der Container und der lokale API-Prozess wurden nach der Aufnahme beendet und entfernt.

Die Aufnahmen zeigen:

- [01 – lokales Dashboard](01-local-dashboard.png)
- [02 – lokale Datenablage](02-local-settings.png)
- [03 – Verbindungsformular mit leeren Zugangsfeldern](03-connection-empty.png)
- [04 – verbundener Editor](04-connected-editor.png)
- [05 – verbundener Reader](05-connected-reader.png)
- [06 – Rückwechsel zum lokalen Bestand](06-return-local.png)

In den Review-Bildern ist kein Serverpasswort und kein Datenschlüssel sichtbar. Die URL ist ausschließlich eine lokale Loopback-Adresse; Patienten-, Konto- und Organisationsdaten sind synthetisch.
