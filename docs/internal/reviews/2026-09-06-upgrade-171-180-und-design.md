# Upgrade aus 1.7.1/1.8.0 und Designabgleich

Stand: 06.09.2026. Ergänzung zum [Behebungsbericht F01–F30](2026-09-06-cleardeck-behebung.md). Unveröffentlichter Arbeitsstand mit Datenbankschema 21; Paketversion weiterhin 1.8.0.

Die automatische Weiterführung vorhandener Daten aus beiden Ausgangsversionen wurde erfolgreich geprüft. Dafür sind kein manueller Export, Import oder vorheriges manuelles Backup erforderlich. Ein vollständiges automatisches Update einschließlich Installation des neuen Programms ist damit noch nicht für beide Betriebssysteme belegt. Insbesondere bleibt der bekannte Mac-Signaturfehler eine eigene Grenze.

## Identität und vorhandene Dateien

| Ausgangsversion | Geprüfter Release-Commit | Ausgangsschema | Produkt / Paket |
| --- | --- | ---: | --- |
| 1.7.1 | `ace153b4df531ae70a907750646b10fd02889e15` | 10 | ClearDeck / cleardeck |
| 1.8.0 | `844c934473ad7dbff4fae8b47c72a94692f23110` | 13 | ClearDeck / cleardeck |

Beide veröffentlichten Tags verwenden bereits dieselbe Produktidentität. Die Produktionsdateien liegen unter `userData/data`: `config.json`, `employee.db.enc` beziehungsweise `employee.db`. Auch der neue Stand verwendet diese Pfade. Die gesonderte Profilwahl in `appPaths.ts` betrifft ausschließlich den Entwicklungsmodus. Ein Transfer in eine neue App-Datenablage ist für diese beiden Versionen nicht erforderlich.

Das alte AES-GCM-Snapshotformat und die Passwort-/Schlüsselkonfiguration bleiben lesbar. Die native Testmatrix verwendet die Konfiguration, die die jeweilige Altversion selbst angelegt hat; sie erstellt beim Upgrade keinen Ersatzschlüssel. Die Konfigurationsdatei blieb bytegleich. Die bereits vorhandenen Einstellungen, einschließlich des bisherigen VZÄ-Bezugswerts, werden beibehalten.

Quellennachweise im Repository: `src/main/appPaths.ts`, `src/main/crypto.ts`, `src/main/ipc/auth.ts`, `src/main/database/connection.ts` und dieselben Dateien aus den genannten Tags. Die tatsächlichen Release-Einträge und Assetnamen wurden zusätzlich über GitHub gelesen.

## Ergänzte Korrekturen

- Auch eine unverschlüsselte Datenbank wird zunächst in einer getrennten SQLite-Instanz migriert. Eine fehlgeschlagene Migration schreibt keine teilweise umgestellte Originaldatei zurück.
- Vor einer Schemaänderung entsteht automatisch `data/backups/before-migration-<UUID>.cdb`. Diese Sicherung liegt außerhalb der regulären Aufbewahrungsbereinigung. Scheitert ihre Erstellung, wird nicht weiter migriert.
- Eine vorhandene Arbeitsdatei aus der alten verschlüsselten Speicherung wird mit ihrem SQLite-Zustand eingelesen. Nach erfolgreichem Speichern der neuen verschlüsselten Datei werden alte Klartext-Arbeitsdateien entfernt.
- Fehlt bei vorhandener Konfiguration die Datenbank, erscheint ein Fehler. Die App erzeugt keinen leeren Ersatzbestand und keine Demopersonen.
- Nach einem Fehler beim verschlüsselten Öffnen bleiben Anmeldung und Schlüssel gesperrt. Ein erneuter Versuch ist möglich.
- Frühere QPR-Einstufungen und Visitenbewertungen bleiben über `legacyQprStatus` und `legacyQprRating` auch in der Oberfläche sichtbar. Sie werden nicht automatisch als neue Stichprobeneinstufung ausgegeben.

## Native Upgrade-Matrix

Die Altprofile wurden mit dem unveränderten Registrierungscode und den Migrationen der jeweiligen Release-Tags erzeugt. Die Ausführung nutzte Electron 39.2.4 und natives better-sqlite3. Für Profilpfade und IPC-Registrierung gab es einen isolierten Testadapter mit gesetztem Produktionsmodus. Die Profile enthielten ausschließlich synthetische Daten.

Je vollständigem Profil: eine Person, zwei Beschäftigungsabschnitte einschließlich Wiedereintritt und Qualifikationswechsel, Stunden/VZÄ, Geburtsdatum, Notizen, ein Fortbildungsnachweis, eine Patientin und eine historische Visite. 1.8.0 enthielt zusätzlich eine bestätigte alte Kompetenzstufe 5 und eine durchgeführte Einweisung.

| Ausgangspunkt | Fälle | Ergebnis |
| --- | ---: | --- |
| 1.7.1 verschlüsselt | Normalstart, Migrationsfehler, neuere alte Arbeitsdatei nach Abbruch, keine Beschäftigten bei vorhandenem Pflegebestand | 4 bestanden |
| 1.8.0 verschlüsselt | Dieselben vier Fälle | 4 bestanden |
| 1.8.0 unverschlüsselt | Normalstart, Migrationsfehler | 2 bestanden |

Alle zehn Fälle wurden nach den Korrekturen erneut mit frisch erzeugten Altprofilen ausgeführt. Jeder erfolgreiche Fall prüft Schema 21, Fremdschlüssel, Bestandserhalt, automatische Sicherheitskopie, unveränderte Konfiguration und erneutes Öffnen ohne eine weitere Migrationssicherung. Der Fehlerfall verändert im Migrationskandidaten absichtlich einen Namen und wirft anschließend einen Fehler. Originaldatenbank und Konfiguration bleiben bytegleich; der anschließende unveränderte Migrationslauf gelingt.

Der Abbruchfall bildet eine gegenüber dem verschlüsselten Snapshot neuere alte Arbeitsdatei ab. Er ist kein physischer Stromausfalltest und kein vollständiger Test aller SQLite-WAL-/Dateisystemzustände.

## Anmeldebildschirm und weiterer Start

Zusätzlich wurde die aktuelle Electron-Oberfläche mit je einem noch nicht migrierten Originalprofil aus 1.7.1 und 1.8.0 gestartet. Sie zeigte jeweils „ClearDeck entsperren“. Die Eingabe des bisherigen Passworts im Formular öffnete den Bestand ohne Einrichtungs- oder Importdialog. Die Datenabfrage über das tatsächliche Preload/IPC bestätigte Person, Beschäftigungsabschnitte, Fortbildung, Patientin und alte Visite.

Anschließend wurden beide Testprozesse beendet und jeweils mit demselben Profil erneut gestartet. Erneutes Entsperren und dieselben Bestandsprüfungen gelangen; je Profil blieb es bei genau einer Migrationssicherung.

Diese Läufe verwenden die echte Oberfläche und aktuelle Main-/Preload-Logik mit isoliertem `userData` und gesetztem Produktionsmodus. Es handelt sich um Starts in der lokalen Electron-Laufzeit, nicht um installierte oder signierte neue Release-Binärdateien. Deshalb zeigen Testhülle und Updater keine reguläre neue Produktversion; ein fehlender Updatefeed in dieser Hülle ist kein getesteter Installerfehler.

## Designabgleich

Der Abgleich umfasst die neu eingeführten fachlichen Bereiche aus F01–F30 sowie deren Formulare. Maßstab sind die vorhandenen `Dialog`, `Segmented`, `TaskRow`, `BirthDateInput`, `input`, `btn`, `tag`, `cd-table-wrap` und `ds-table` sowie die Farb-, Größen- und Fokusregeln aus `design-system.css`. Es wurde kein zweites Designsystem ergänzt.

| Bereich | Geprüfte Darstellung und Anpassungen |
| --- | --- |
| Team, Gesamtliste, Personalformular | Importaktion in der vorhandenen Kopf-Aktionsleiste; gleiche Feldbeschriftungen und Datumseingabe; Bestätigung mit gestaltetem Kontrollkästchen |
| Beschäftigungshistorie | Bestehende Tabellengestaltung und horizontaler Überlauf; VZÄ mit deutschem Zahlenformat |
| Excel-/CSV-Vorschau | Bestehender Dialog, begrenzter Tabellenbereich, Eingaben und Auswahlkästchen; Quellen- und Fehlerhinweise bleiben sichtbar |
| Jahresnachweis | Vorhandene Segmentauswahl für Stichtag/Jahresmittel, Tabelle, Exportaktion und einklappbare Erläuterung |
| Einweisungen und Katalog | Gleiche Nachweisfelder, Wiedervorlage, Kontrollkästchen und einklappbare Erläuterung zur Jugend-Unterweisung |
| Kompetenzen | Stufen 0 bis 6 im bestehenden Stufenwähler; Bestätigungsfelder und Verlauf mit vorhandenen Text-/Statusstilen |
| Patientenstammdaten und QPR | Gleiche Feldgrößen und Geburtsdatumseingabe; HKP-Auswahl mit Abständen; Mobilität/Kognition jeweils über volle Breite |
| Pflegevisiten und Aufgaben | Datum, Status, Zuständigkeit, Frist und Erledigung in vorhandenen Formularen; offene Maßnahmen in vorhandenen Aufgabenzeilen |
| MD-Prüfung | Merkmalsbestand, Entwürfe, Berichtreferenz und Qualitätsbereiche mit vorhandenen Status-, Dialog- und Segmentkomponenten |
| Einstellungen, Backup, Anmeldung | Bestehende Einstellungszeilen, Auswahlkarten, Felder und Fehlerhinweise; eigenes Eingabefeld für den ursprünglichen Sicherungsschlüssel |

Konkrete visuelle Fehler wurden korrigiert: rohe Checkboxen, uneinheitliche neue Feldbeschriftungen, fehlende Abstände zwischen HKP-Optionen, eine zu breite Mobilitäts-/Kognitionsauswahl, ungestaltete Historien-/Importtabellen und eine über die gesamte Seite gezogene Importaktion. Hilfetexte verwenden die gemeinsame `FieldHelp`-Darstellung. Warnungen über fehlende Daten und das Ersetzen einer Datenbank bleiben direkt sichtbar.

Die Oberflächen wurden mit synthetischem Profil bei 1440 × 1000 in der nativen Electron-Laufzeit bedient und anhand von Screenshots geprüft. Im langen Patientendialog sind nach der Korrektur alle Auswahlgruppen innerhalb des Dialogs und die Speichern-Aktion durch Scrollen erreichbar. Das belegt die geprüften Ansichten; es ist keine vollständige Prüfung aller Fenstergrößen, Betriebssystem-Datumswähler oder Screenreader.

Ausgewählte Screenshots liegen unter [assets/2026-09-06-design](assets/2026-09-06-design/). Die maschinenlesbare [Prüfevidenz](2026-09-06-upgrade-171-180-evidence.json) enthält die einzelnen Upgrade-Ergebnisse und die geprüften Oberflächen.

## Automatisierte Regression und Build

- `npm test -- --run`: 297 Tests in 53 Dateien bestanden.
- Davon neun neue Upgrade-Regressionstests mit [Originalschema-Fixtures](../../../src/main/__tests__/fixtures/README.md), zusätzlich zu zehn vorhandenen Backup-Integritätstests.
- `npx tsc --noEmit` und `npm run lint`: bestanden.
- Renderer-/Preload-Webpack-Build: bestanden.
- `git diff --check`: bestanden.

## Grenzen des normalen Programmupdates

Die lokale Paketversion ist noch 1.8.0. Erst ein veröffentlichtes Release mit höherer Version kann installierten 1.8.0-Clients als Update angeboten werden. In dieser Arbeit wurden weder Version noch Release veröffentlicht.

Für Windows gibt es bereits einen [separaten erfolgreichen Test des alten Update-Knopfs von 1.7.1/1.7.2 nach 1.8.0](../vorfaelle/windows-update-repair.md). Er belegt den damaligen Installerwechsel und die reparierten Metadaten, nicht den nächsten Installer mit diesen neuen Datenbankänderungen. Dieser neue Installer wurde hier nicht gebaut und auf Windows installiert.

Für macOS ist ein [konkreter Signaturfehler der alten Auslieferung](../vorfaelle/mac-update-repair.md) dokumentiert. Ein Developer-ID-signierter neuer Release und dessen Kompatibilität mit den alten installierten Clients wurden nicht nachgewiesen. Ein ausschließlich automatischer Mac-Installationsweg kann deshalb aktuell nicht zugesagt werden. Falls für betroffene Clients einmalig eine manuelle Programminstallation nötig wird, bedeutet dies nicht, dass die Daten manuell exportiert oder importiert werden müssen.

Die [Betriebsanleitung](../../anleitung/datenuebernahme-und-sicherung.md) trennt daher normales Update, Gerätewechsel/Wiederherstellung und Erstimport einer Personal-Tabelle ausdrücklich.
