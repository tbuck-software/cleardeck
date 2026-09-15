# Leistungsverwaltung und Patientenauswahl

Echte Electron-Aufnahmen mit synthetischen Demodaten, 1440 × 1000 CSS-Pixel.

- Vorher: Anwendung vor dieser Änderung, Basis `0a1ce1c`. Das Formular verlangt eine manuelle Entscheidung zum Leistungsumfang für Anlage 7.
- Nachher: Implementierung `7bca279`, aufgenommen im separaten Demo-Checkout `aa03166`. Verwaltung → Leistungen enthält den gemeinsamen Katalog. Das Patientenformular bietet eine kompakte Mehrfachauswahl und zeigt die abgeleitete MD-Einordnung.
- Geprüfter Ablauf: Katalogeintrag anlegen, umbenennen und deaktivieren; mehrere Leistungen auswählen; Patient speichern und erneut öffnen; zugeordneten Eintrag umbenennen und die aktualisierte Bezeichnung ohne Neustart prüfen.
- Die vier zusätzlichen SGB-V-Beispiele wurden im bereits migrierten Demoprofil über die Katalog-API ergänzt. Die Migration für eine reguläre Aktualisierung enthält diese Vorgaben ebenfalls.
- Bestehende inaktive Zuordnungen bleiben erhalten. Besondere HKP-Merkmale, Pflegegrad und Einschränkungen werden aus der Auswahl nicht automatisch gesetzt.

Die Bilder enthalten keine Daten aus dem ursprünglichen Nutzerfoto. Die Prüfung erfolgte unter macOS; Windows und Linux wurden nicht visuell geprüft.
