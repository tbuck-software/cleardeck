# Beschäftigungsdaten prüfen und doppelte Abschnitte auflösen

Echte Electron-Aufnahmen unter macOS mit synthetischen Demodaten, 1440 × 1000 CSS-Pixel.

- Vorher: Basis `0a1ce1c`; das Team-Menü hat noch keine geführte Datenprüfung.
- Nachher: final geprüfte Implementierung `30873d4`. Zwei synthetische Abschnitte vom 01.01.2019 bis 31.12.2019 werden als Überschneidung erkannt.
- Die Vorschau zeigt den beibehaltenen und den zusammengeführten Zeitraum sowie zwei betroffene Arbeitszeitstände. Nach dem ausdrücklichen Speichern verschwindet die Überschneidung. Der Hinweis auf die ursprüngliche Übernahme bleibt sichtbar.
- Die erweiterten Reparaturaktionen sind standardmäßig eingeklappt. Vorschauen, Datumsgrenzen, Nachweisübernahme, Konflikte, Rückabwicklung und Personen ohne Beschäftigungsabschnitte sind zusätzlich durch Repository- und UI-Tests abgedeckt.

Die Bilder enthalten ausschließlich synthetische Personen. Windows und Linux wurden nicht visuell geprüft.
