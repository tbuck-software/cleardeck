# Windows: Ersteinrichtung bei vorhandenen Daten

Untersucht am 5. September 2026 anhand von Version 1.8.0 und der Repository-Historie. Der Nutzer hat die konkrete Ursache anschließend bestätigt: Auf dem Rechner waren die ältere App "Employee DB" und ClearDeck parallel installiert. Die Daten lagen im anderen AppData-Ordner. Nach Umbenennen des Ordners ließ sich der Bestand in ClearDeck 1.7.1 öffnen. Es lag kein belegter Datenbankdefekt vor. Die unten beschriebenen Fehler bei Konfigurationsverlust sind zusätzlich lokal reproduzierte Schutzlücken.

## Zuerst sichern

1. ClearDeck vollständig schließen. Kein neues Passwort setzen und die App nicht zurücksetzen.
2. Im Explorer `%APPDATA%\ClearDeck\data` öffnen. Normalerweise ist das `C:\Users\<Benutzer>\AppData\Roaming\ClearDeck\data`.
3. Den gesamten Ordner an einen anderen Ort kopieren und das Original unverändert lassen.

| Datei | Bedeutung |
| --- | --- |
| `employee.db.enc` | Verschlüsselte Datenbank, normalerweise nach ordentlichem Beenden vorhanden |
| `config.json` | Passwortprüfung und mit dem Passwort verschlüsselter, zufälliger Datenbankschlüssel |
| `employee.db` | Unverschlüsselte Arbeitsdatenbank; kann nach einem Absturz oder im unverschlüsselten Modus vorhanden sein |
| `employee.db-wal`, `employee.db-shm`, `employee.db-journal` | Mögliche SQLite-Begleitdateien; mit sichern |
| `backups`, `archived-resets`, weitere Dateien | Mit sichern; können ältere Daten oder Konfigurationen enthalten |

Die verschlüsselte DB zusammen mit dem Passwort reicht ohne passende Konfiguration oder Recovery Key nicht aus. Der Datenbankschlüssel wird zufällig erzeugt. Die DB lässt sich nicht einfach mit einem neu gesetzten Passwort öffnen.

Falls der Ordner fehlt oder leer ist: Windows-Benutzerprofil prüfen und in den betreffenden Profilen nach `employee.db*` suchen. Entwicklungsstarts nutzen seit der Trennung `%APPDATA%\dev-ClearDeck\data`. Der Produktionsname `ClearDeck` ist schon im ältesten vorhandenen Commit gleich; eine Umbenennung durch die untersuchten Releases ist nicht belegt.

Die Pfade ergeben sich aus `src/main/appPaths.ts` und den Electron-Vorgaben für [app.getPath und app.getName](https://www.electronjs.org/docs/latest/api/app).

## Kann ein veröffentlichtes Update das ohne Nutzeraktion lösen?

Der anschließend gemeldete Update-Fehler in 1.7.1 wurde separat untersucht und im veröffentlichten Release behoben. Siehe [Windows-Update-Reparatur](windows-update-repair.md). Die relevanten Eigenschaften des vorhandenen Auslieferungswegs sind:

- Die Prüfung läuft beim Laden, beim Fensterfokus und stündlich, auch vor der Anmeldung. Der Nutzer muss die App dafür geöffnet haben.
- Downloads sind automatisch aktiviert. Installation beim Beenden ist ausdrücklich deaktiviert. `quitAndInstall()` wird erst durch eine Nutzeraktion aufgerufen.
- Der bisherige Installationsknopf lag in der erst nach Anmeldung sichtbaren Sidebar. Der Screenshot hatte daher keinen erreichbaren Installationsknopf.
- `assets/app-update.yml` verweist auf private GitHub-Releases. `webpack.plugins.ts` bindet `GH_TOKEN` über `DefinePlugin` beim Build ein. Der Fehlerbericht belegt, dass der installierte Client auf die Release-Metadaten zugreifen konnte. Fehlende Berechtigungen waren hier nicht die Ursache.
- `forge.config.ts` baut mit `MakerSquirrel`. `electron-updater` wählt unter Windows dagegen `NsisUpdater`. Diese Kombination wird offiziell [nicht unterstützt](https://www.electron.build/docs/features/auto-update/). Der konkrete Sprung 1.7.1 auf 1.8.0 mit den vorhandenen Installern und den Parametern des alten Updaters wurde inzwischen auf einer temporären Windows-VM erfolgreich geprüft. Das ist keine allgemeine Kompatibilitätsgarantie für weitere Versionen.

Für diesen Rechner reicht nun ein erneuter Update-Check in 1.7.1, gefolgt von der Installationsaktion. Die Metadaten wurden direkt im bestehenden Release korrigiert. Die ergänzten Update-Steuerelemente verbessern erst eine künftige App-Version. Sie ändern den bereits installierten Client nicht.

## Reproduzierte Fehler und Änderungen

`npx vitest run src/main/__tests__/authStartup.test.ts` reproduzierte vor der Änderung vier Fehler: Leere und defekte Konfigurationen sowie fehlende Konfigurationen bei vorhandener verschlüsselter oder unverschlüsselter DB wurden als Neueinrichtung gemeldet.

- `readConfig()` behandelte alle Lese- und JSON-Fehler wie eine fehlende Einrichtung. Jetzt liefert nur ein neuer Datenordner ohne erkennbare aktive Daten oder Konfigurationsreste diesen Zustand. Zugriffsfehler, defekte und unvollständige Konfigurationen führen zu einem eigenen Fehlerzustand.
- Beide Registrierungswege prüfen denselben Zustand vor dem Schreiben. Eine vorhandene DB ohne Schlüsselkonfiguration wird nicht mehr neu eingerichtet.
- Ein Fehler der Startabfrage ließ im Renderer den anfänglichen Einrichtungszustand zurück. Die Oberfläche unterscheidet jetzt Laden, Fehler, Anmeldung und Ersteinrichtung. Die Fehlermeldung bleibt sichtbar.
- `writeConfig()` überschrieb die Schlüsseldatei direkt. Die neue Implementierung schreibt und synchronisiert zuerst eine temporäre Datei im selben Ordner und ersetzt dann die Zieldatei durch Umbenennen. Tests prüfen Schreibabbruch und fehlgeschlagenes Umbenennen. Das ersetzt kein Backup und ist kein Nachweis, dass ein Schreibabbruch beim Betroffenen passiert ist.
- Version, Update-Status und die Installationsaktion für bereits geladene Updates sind jetzt auch vor der Anmeldung und im Fehlerzustand sichtbar.

Die ältere Version bis einschließlich 1.7.2 nutzte für `app:state` nur die Dateiexistenz. Eine vorhandene, aber beschädigte JSON-Datei allein erklärt dort keine Ersteinrichtung. Dort sind insbesondere eine fehlende Datei, ein anderes Profil bzw. ein anderer Datenordner und eine fehlgeschlagene Startabfrage zu unterscheiden. Ein Reset älterer Versionen konnte Dateien löschen; neuere Versionen archivieren sie unter `archived-resets`.

## Vorgehen bei einem tatsächlichen Konfigurationsverlust

Benötigt werden zunächst nur die installierte Version, der vollständige Datenpfad sowie Dateinamen, Größen und Änderungszeiten. Keine Passwörter, Recovery Keys oder Konfigurationsinhalte in die Diagnoseübersicht aufnehmen.

- DB und passende Konfiguration vorhanden: JSON-Struktur und Leserechte prüfen, dann auf einer Kopie Anmeldung und Entschlüsselung testen.
- Nur verschlüsselte DB vorhanden: passende Konfiguration aus einer Sicherung bzw. einem anderen Datenordner suchen. Alternativ mit einem vorhandenen Recovery Key an einer Kopie arbeiten. Die aktuelle Recovery-Oberfläche setzt eine lesbare Konfiguration voraus.
- `employee.db` vorhanden: die gesicherte Arbeitsdatei samt Begleitdateien auf SQLite-Integrität und Datenbestand prüfen, bevor ein neuer Schlüssel oder ein Import erwogen wird.
- Keine aktive DB vorhanden: andere Profile, Datenordner und Sicherungen untersuchen. Ein Update kann fehlende Daten nicht erzeugen.

Validierung: 63 Tests bestanden, ESLint bestanden. Der reguläre TypeScript-4.5-Check scheitert an neueren Bibliothekstypen. Ein zusätzlicher Check mit TypeScript 5.9.3 meldet ausschließlich zwei Fehler in `useCalendar.ts`, die auf einem separat extrahierten unveränderten HEAD identisch auftreten.
