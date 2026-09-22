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

## Native Windows-Prüfung

Der [Kandidatenlauf für 2.3.0](https://github.com/tbuck-software/cleardeck/actions/runs/35763010811) hat alle vier Installations- und Updatewege bestanden. Die Einstellung wurde dabei im installierten Programm mit verschlüsselten Testdaten geprüft, einschließlich Erhalt der taggewichteten Methode beim Folgeupdate. Die folgenden Aufnahmen ersetzen für die PR-Ansicht die frühere Komponenten-Vorschau:

- [Echte Einstellungen](assets/2026-09-22-release-2.3.0/einstellungen.png)
- [Echtes Dashboard](assets/2026-09-22-release-2.3.0/after-unlock.png)
- [Echte Jahrestabelle](assets/2026-09-22-release-2.3.0/team.png)

Die Aufnahmen zeigen synthetische Testdaten in der installierten Windows-App, mit ihrer echten Navigation. Die zugänglichen Namen der Symbolbuttons in der schmalen Einstellungsleiste wurden nach einem Fehler im ersten Kandidatenlauf ergänzt und anschließend erneut unabhängig geprüft.
