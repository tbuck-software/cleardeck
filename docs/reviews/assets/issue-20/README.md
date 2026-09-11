# Pflegegrad-Auswahl, Issue 20

Die Bilder stammen aus der echten Electron-Demo mit ausschließlich synthetischen Daten, aufgenommen am 11.09.2026 bei 1440 × 1000 CSS-Pixeln.

Vorher: `0a1ce1c2302176d02d54a04dc83fdcd79fa6ff6d`. Nachher: Anwendungscode aus `0e12f9c`; `9e721d4` ergänzt ausschließlich einen Test.

Die ursprüngliche Auswahl bietet nur 1–5. Die neue Auswahl speichert ausdrücklich „Kein Pflegegrad“. Nach dem Anlegen einer synthetischen Person zeigen die Detailansicht und der erneut geöffnete Editor weiterhin diesen Wert. Der gespeicherte Wert ist `0`; unbekannte Angaben bleiben `NULL`.

Geprüft: Auswahl, Speichern, Detailansicht, erneutes Öffnen sowie Unterscheidung in beiden Listenlayouts. Unabhängiges Code-Review ohne offene Fehler; ergänzte Testabdeckung für die kompakte Liste. 52 Tests in sechs gezielt geprüften Dateien bestanden, anschließend erneut 13 Listentests für den ergänzten Fall. TypeScript und ESLint bestanden. Keine Änderungen an der MD-Zuordnung.

Start: `CLEARDECK_DEMO_DEBUG=1 npm run demo`, eigenes synthetisches Demo-Profil, Zugriff auf das echte Electron-Fenster über CDP. Die Aufnahmen wurden visuell geprüft. Windows und Linux wurden für diese UI-Änderung nicht separat gestartet.
