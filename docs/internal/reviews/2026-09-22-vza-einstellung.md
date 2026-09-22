# Zentrale Berechnung der Jahres-VZÄ

Die Auswahl unter Einstellungen → Allgemein wird im Datenbestand gespeichert. Standard ist der Durchschnitt aus zwölf Monatsenden; alternativ bleibt der taggewichtete Jahresdurchschnitt verfügbar. Dashboard, Jahrestabelle und deren Excel-/CSV-Exporte verwenden die gewählte Methode. Der Jahresnachweis übernimmt sie beim Öffnen als Vorauswahl und erlaubt eine abweichende Auswahl für diesen Bericht.

Arbeitszeitstände und Jahresbeiträge bleiben getrennt. Die Jahrestabelle zeigt Qualifikation und Wochenstunden des letzten Stands im Jahr, daneben die Jahres-VZÄ pro Person. Dashboard und Jahresnachweis ordnen Qualifikationssummen historisch zu. Fehlende bzw. unbestätigte Jahreswerte werden als vorläufig gekennzeichnet.

Prüfung am 22.09.2026:

- 655 Tests in 98 Dateien bestanden, darunter persistierte Einstellung, Speichern/Fehlerfall, Stundenwechsel, Qualifikationswechsel, untermonatige Beschäftigung, historische Lücken, Export, Synchronisierung und unveränderte Arbeitszeitstände.
- TypeScript ohne Fehler; ESLint für alle geänderten TypeScript-Dateien ohne Meldungen; `git diff --check` ohne Fehler.
- Sichtprüfung der echten React-Komponenten im Browser mit synthetischen Daten. Umschalten zwischen beiden Methoden geprüft. Die Vorschau verwendet eine vereinfachte Navigation und keine native Electron-/IPC-Verbindung. Die Datenbankberechnung und Speicherung wurden separat in den Repository- und Hooktests geprüft.

Screenshots:

- [Einstellungen](assets/2026-09-22-vza-einstellung/einstellungen.png)
- [Dashboard mit Monatsenddurchschnitt](assets/2026-09-22-vza-einstellung/dashboard-monatsenden.png)
- [Jahrestabelle mit Monatsenddurchschnitt](assets/2026-09-22-vza-einstellung/team-monatsenden.png)
- [Dieselbe Jahrestabelle taggewichtet](assets/2026-09-22-vza-einstellung/team-taggewichtet.png)

Für synchronisierte Datenbestände gehört `annualFteMethod` zu den gemeinsamen Einstellungen. Der Server muss die mitgeänderte `syncSchema.json` verwenden; ältere Server kennen diesen Schlüssel noch nicht. Kein Release oder Serverdeployment durchgeführt. Keine neue Zuordnung von Kompetenzen zur fotografierten Vertragsmatrix und keine gesonderte SGB-XI-Aufteilung.
