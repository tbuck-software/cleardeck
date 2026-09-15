# Serverbetrieb – UI-Evidenz

Echte Electron-Aufnahmen aus dem Branch `feature/server-mode`, aufgenommen am 14.09.2026 bei 1400 × 868 CSS-Pixeln (schmale Ansicht 390 × 844). Das Demo-Profil enthält ausschließlich synthetische Daten.

Aufgenommen mit `CLEARDECK_DEMO_DEBUG=1 make dev-server` und CDP auf dem laufenden Electron-Fenster. Server und PostgreSQL liefen lokal auf Loopback mit den Entwicklungskonten `dev-admin` und `dev-editor`. Für den Konflikt wurde derselbe Einstellungsdatensatz auf dem Server geändert, während auf dem Gerät offline eine Änderung wartete.

Die Aufnahmen zeigen:

- [01 – lokale Datenablage](01-local.png)
- [02 – Serverbestand öffnen](02-open-server.png)
- [03 – derselbe Dialog als Bottom Sheet](03-open-server-narrow.png)
- [04 – lokalen Bestand mit Administratorkonto übertragen](04-transfer.png)
- [05 – synchronisierter Serverbestand](05-connected-synced.png)
- [06 – offline mit einer wartenden Änderung](06-offline-pending.png)
- [07 – Konflikt mit Entscheidung](07-conflict.png)
- [08 – Anmeldung im Serverbetrieb](08-server-sign-in.png)
- [09 – Update-Quelle](09-update-source.png)

Passwörter sind maskiert. Die URL ist ausschließlich eine lokale Loopback-Adresse; Patienten-, Konto- und Organisationsdaten sind synthetisch.
