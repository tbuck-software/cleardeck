# Jahresnachweis mit Monatsenddurchschnitt

Browser-Vorschau des echten Berichtsdialogs bei 1280 × 900 mit synthetischen Summen für 2025. `monatsenden.png` zeigt den neuen Standard, `taggewichtet.png` die weiterhin auswählbare taggenaue Alternative. Auch der Wechsel zum Stichtag wurde im Browser bedient.

Die Browser-Vorschau prüft Darstellung und Moduswechsel. Die Berechnung und der Excel-Export sind separat durch Repository-Tests gegen eine SQLite-Datenbank geprüft, einschließlich Stundenwechsel, Monatsendgrenzen, Schaltjahr, Qualifikationswechsel und unbekannter Stellenanteile. Ein vollständiger nativer Electron-Durchlauf wurde hierfür nicht durchgeführt.
