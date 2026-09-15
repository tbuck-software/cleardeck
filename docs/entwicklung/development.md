# ClearDeck Dev

Nach `npm install` startet `make dev` die echte App aus diesem Repository. Gleichwertig ist `npm start`. Die installierte ClearDeck-App kann parallel geöffnet bleiben.

Für die Arbeit am Update-Bereich:

```sh
make dev-updates
```

Dieser Einstieg verwendet denselben Quellcode und die echten Datenbank- und IPC-Funktionen. Ein eigenes Testprofil bekommt bei der ersten Einrichtung synthetische Beispieldaten aus dem vorhandenen Datenbank-Seed. Der Update-Hinweis ist sofort verfügbar. Der Demo-Download dauert fünf Sekunden und zeigt Fortschritt und Restzeit. Der Installationsknopf zeigt im Dev-Modus eine Fehlermeldung, weil dort kein echter Installer gestartet wird. Es gibt weder einen Release-Download noch einen Neustart der Alltags-App. Ein erneuter Start des Befehls stellt den verfügbaren Demo-Updatezustand wieder her.

Bestehende Konfigurationen und Daten werden nicht überschrieben. Ist das Testprofil bereits verschlüsselt eingerichtet, bleibt die Anmeldung erforderlich.

## Live-Aktualisierung

Änderungen am Renderer und an CSS erscheinen über den vorhandenen Forge/Webpack-Dev-Server im laufenden Fenster. Das Fenster heißt „ClearDeck Dev“, die Sidebar zeigt „Eigene Daten · Live“. Der Update-Status lebt im Main-Prozess und bleibt bei einem Renderer-Neuladen erhalten. Ein erneutes Zusammenklicken des Updatezustands ist dafür nicht nötig.

Für Änderungen am Main-Prozess im Startterminal `rs` und Enter eingeben. Mit Strg+C wird der Dev-Start beendet. `CLEARDECK_DEVTOOLS=1 npm start` öffnet die Entwicklerwerkzeuge zusätzlich. Unter PowerShell zuerst `$env:CLEARDECK_DEVTOOLS='1'` setzen.

Die Dev-App wird über diese Befehle gestartet. Sie ist keine weitere veröffentlichte Installationsversion. Auf macOS liegt ihr lokaler Electron-Host unter `.dev-runtime/Electron.app`; für einen vollständigen Start einschließlich Dev-Server bitte den Make- oder npm-Befehl verwenden.

## Getrennte App und Daten

Auf macOS erstellt der Start eine lokale Kopie des installierten Electron-Entwicklungsruntimes mit dem vorhandenen ClearDeck-Symbol, Namen „ClearDeck Dev“ und Bundle-ID `com.electron.cleardeck.dev`. Diese Kopie wird lokal signiert und geprüft. Weder `/Applications/ClearDeck.app` noch der Electron-Runtime unter `node_modules/electron` werden dafür geändert. Unter Windows bekommt das Dev-Fenster eine eigene AppUserModelID.

| Profil | macOS | Windows |
| --- | --- | --- |
| Alltags-App | `~/Library/Application Support/ClearDeck` | `%APPDATA%\ClearDeck` |
| `make dev` | `~/Library/Application Support/dev-ClearDeck` | `%APPDATA%\dev-ClearDeck` |
| `make dev-updates` | `~/Library/Application Support/dev-ClearDeck-updates` | `%APPDATA%\dev-ClearDeck-updates` |

Datenbank und Konfiguration liegen jeweils im Unterordner `data`. Session-Daten, Browser-Cache und Logs des Dev-Starts liegen ebenfalls im jeweiligen Dev-Profil. Unter Linux werden die entsprechenden Profilordner unter dem von Electron bestimmten AppData-Verzeichnis verwendet.

Die Pfade werden vor der Registrierung der Datenbankzugriffe gesetzt. Die Dev-Auswahl wird in gepackten Apps ignoriert. Produktionsdaten werden weder importiert noch kopiert.

## Geprüft

Die vollständige Testsuite benötigt Node.js 26.1 oder neuer für `DatabaseSync.serialize()` und `deserialize()` im SQLite-Testadapter. Der CI-Prüfjob verwendet dafür Node.js 26.8.1. Mit dieser Version führt `npx vitest run` auch die Sicherungs- und Migrationstests aus. Die Funktionen wurden laut [Node.js-Dokumentation](https://nodejs.org/api/sqlite.html#databaseserializedbname) in 26.1 eingeführt. Installerbau und Windows-Installationsprüfung verwenden weiterhin Node.js 22; die ausgelieferte App nutzt `better-sqlite3` im Electron-Runtime.

- Nativer macOS-Start mit eigener Bundle-ID, gültiger lokaler Signatur und Fenstertitel „ClearDeck Dev“.
- Installierte ClearDeck-App und Dev-App liefen gleichzeitig als getrennte Prozesse.
- Der Dev-Prozess hielt `dev-ClearDeck-updates/data/employee.db` und die Caches des Testprofils geöffnet.
- Eine geänderte Sidebar-Beschriftung erschien im laufenden nativen Fenster ohne Main-Prozess-Neustart.
- Tests decken die Profiltrennung, den Schutz gepackter Apps, den Umgang mit vorhandenen Testdaten und den Hover-Übergang ins Update-Popover ab.
- TypeScript, ESLint und Tests laufen fehlerfrei. Der Dev-Build verwendet TypeScript 5.9.3; die beiden zuvor uneindeutigen Kalender-Ereignistypen sind explizit angegeben.

Der native Dev-Start wurde hier auf macOS geprüft. Der Windows-Update-Test betrifft die veröffentlichten Originalinstaller und ist separat in `windows-update-repair.md` dokumentiert.
