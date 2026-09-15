# Datenübernahme, laufende Pflege und Sicherung

Stand: 06.09.2026. ClearDeck ist die Fortführung von Employee DB. Eine neue Einrichtung enthält keine Demopersonen.

## Normales Update auf demselben Gerät

Für ein Update aus ClearDeck 1.7.1 oder 1.8.0 sind kein manueller Datenexport, kein Import und kein vorher manuell erstelltes Backup erforderlich. Nach der Installation öffnet die neue App das vorhandene Profil. Bei verschlüsselter Speicherung gilt weiterhin das bisherige Passwort. Beim ersten Öffnen erstellt sie automatisch eine Sicherheitskopie und aktualisiert die Datenbankstruktur. Beschäftigungsperioden, Nachweise und Pflegevisiten bleiben erhalten.

Alte, fachlich nicht eindeutig zuordenbare Angaben werden erhalten und zur Prüfung angezeigt. Frühere globale Stundenwerte gelten beispielsweise nicht automatisch als bestätigte Stundenhistorie; alte QPR-Buchstaben werden nicht als neue Einstufung ausgegeben. Diese fachliche Nachprüfung ist keine erneute Datenübernahme.

Schlägt eine Migration fehl, wird der ursprüngliche Bestand nicht durch eine teilweise umgestellte Datenbank ersetzt. Fehlt zu einer vorhandenen Konfiguration die Datenbank, meldet die App einen Fehler und legt keinen leeren Ersatzbestand an.

Dieser Ablauf setzt voraus, dass die neue App tatsächlich installiert wurde. Für alte macOS-Releases besteht ein gesondertes Signaturproblem beim automatischen Installer. Die erfolgreiche Datenmigration behebt dieses Problem nicht.

## Gerätewechsel oder Wiederherstellung einer Sicherung

1. Auf dem bisherigen Gerät eine Sicherung erstellen. Den zugehörigen Recovery-Key getrennt verfügbar halten.
2. Auf dem Zielgerät die App einrichten und unter Einstellungen die Sicherung zur Wiederherstellung auswählen. Bei einem anderen Schlüssel den Recovery-Key der ursprünglichen Installation eingeben.
3. Die App erkennt verschlüsselte Sicherungen und SQLite-Dateien. Sie prüft den Inhalt vor dem Austausch und erstellt eine eigene Sicherheitskopie des aktuellen Bestands. Eine Ablehnung verändert den Bestand nicht.
4. Nach der Wiederherstellung die Gesamtliste, einen bekannten historischen Zeitraum und die Nachweise stichprobenartig vergleichen. Alte globale Stundenwerte bleiben zunächst ungeprüft.

Der ursprüngliche Recovery-Key wird zum Lesen der alten Sicherung benötigt. Nach erfolgreicher Übernahme gelten die Verschlüsselungseinstellungen des Zielgeräts. Die vollständige Wiederherstellung ersetzt den aktuellen Bestand; sie führt nicht zwei Bestände zusammen.

## Erstimport aus einer Personal-Tabelle

Dieser Import dient der Übernahme zusätzlicher Excel-/CSV-Bestände. Für ein normales ClearDeck-Update wird er nicht benötigt.

Unter Team „Mitarbeiterliste übernehmen“ wählen. Unterstützt werden Excel-Dateien und CSV mit einer erkennbaren Kopfzeile im ersten Tabellenblatt. Benötigt werden Name, Qualifikation, Beginn/Eintritt, gegebenenfalls Ende/Austritt und Wochenstunden. Datum und Zahl müssen eindeutig lesbar sein. Die Vorschau zeigt unklare Werte und erhält ihre Quellenzeile.

- Nur angekreuzte Zeilen werden übernommen. Gleiche Namen müssen ausdrücklich einer vorhandenen Person zugeordnet werden; sie werden nicht automatisch zusammengeführt.
- Stunden und VZÄ in der Vorschau prüfen. Der Vorschlag verwendet `min(Wochenstunden, 36) / 36`. Bereits taggewichtete Werte aus alten Tabellen werden nicht als konstanter Stellenanteil übernommen.
- Beschäftigungsabschnitte dürfen sich bei derselben Person nicht überschneiden. Mehrere Stundenstände mit unterschiedlichen Zeiträumen müssen getrennt nachgetragen werden.
- Die Übernahme wird als Ganzes gespeichert. Bei einem Fehler wird keine Teilmenge zurückgelassen. Vorher entsteht eine Sicherheitskopie.
- Importierte Stundenstände bleiben als ungeprüfte Altdaten gekennzeichnet. Unter „Bearbeiten“ die Stunden und den passenden Gültigkeitsbeginn eintragen. Geänderte Angaben gelten mit dem Speichern als bestätigt, ohne zusätzliche Checkbox.

Makros werden nicht ausgeführt. Freitext zu Arbeitszeitverläufen wird nicht automatisch in rechtlich oder fachlich bestätigte Beschäftigungsperioden umgedeutet.

## Historische Änderungen und Jahresnachweise

Eintritt, Austritt und Wiedereintritt über Beschäftigungsperioden führen. Für eine Stundenänderung das Datum „gültig ab“ setzen. Eine Korrektur darf rückdatiert werden; bisherige Erfassungsstände bleiben in der Historie sichtbar. Die Bestätigung eines heutigen Wertes bestätigt keine früheren Zeiträume.

Die Gesamtliste enthält alle jemals Beschäftigten mit ihrem zuletzt erfassten Stand. Ein Jahresnachweis wird separat erstellt:

- **Stichtag 31.12.** zählt die an diesem Tag Beschäftigten mit dem dann gültigen Stellenanteil.
- **Taggewichteter Jahresdurchschnitt** zerlegt die Beschäftigung an Stunden- und Qualifikationswechseln. Je Abschnitt gilt Stellenanteil mal inklusive Kalendertage geteilt durch die Tage des Jahres.

Der Excel-Nachweis enthält Zusammenfassung und Einzelabschnitte. Fehlende oder unbestätigte Werte machen die Auswertung vorläufig. Das konkrete Formular des Empfängers muss der Dienst selbst prüfen.

## Nachweise und Einarbeitung

Bei Unterweisungen Durchführung, Inhalt, durchführende Person und Nachweisverweis erfassen. Der Verweis kann auf eine Schulungsplattform, eine Personalakte oder ein Dokument zeigen. Er ersetzt keine erforderliche Unterschrift. Eine automatische Wiedervorlage ist ein eigener offener Eintrag. Den Durchführungstag zu korrigieren passt den automatisch verknüpften Folgetermin an; ausdrücklich manuell gesetzte Termine bleiben bestehen.

Praktische Einarbeitung endet mit Stufe 6 sowie Bestätigungsdatum und bestätigender Person. Stufen 1 bis 5 gelten als laufend. Einen alten Stufenstand erst nach fachlicher Prüfung neu einstufen. Vertragliche Einsatzberechtigungen ergeben sich nicht allein aus der Stufe.

## Pflegevisiten und QPR-Liste

Versorgungsstatus und Leistungsumfang je Klient prüfen. Mobilität und Kognition benötigen eine nachvollziehbare Quelle; bei veraltetem Gutachten ausdrücklich eine eigene Einschätzung erfassen. Mehrere aufwändige HKP-Leistungen sind gleichzeitig auswählbar. AKI EV/MV und pHKP-Erstverordnung mit Beginn werden gesondert geführt.

Geplante Visiten bleiben geplant, bis ihre Durchführung bestätigt wird. Offene Maßnahmen erhalten eine zuständige Person und Frist; die Erledigung ausdrücklich am betreffenden Eintrag dokumentieren. Beenden der Versorgung archiviert die Person und erhält ihre Visiten.

Die MD-Seite exportiert die aktive, einbezogene Personenliste nach Anlage 7. Ungeklärter Leistungsumfang oder fehlende benötigte Angaben verhindern einen als vollständig ausgegebenen Export. Die angezeigten Merkmalsbestände sind keine Stichprobenziehung. Prüfergebnisse werden intern zusammengefasst und mit dem vollständigen Originalbericht verknüpft.

## Sicherungen im laufenden Betrieb

In den Einstellungen einen Backup-Ordner, Rhythmus und die gewünschte Anzahl regulärer Sicherungen wählen. Ein Fehler der automatischen Sicherung bleibt in den Einstellungen sichtbar. Sicherheitskopien vor Migration, Übernahme und Wiederherstellung liegen außerhalb der regulären Aufbewahrungsbereinigung.

Im verschlüsselten Betrieb arbeitet die Datenbank im Speicher. Erfolgreiche Datenoperationen werden vor der Bestätigung verschlüsselt gespeichert. Unverschlüsselte Exporte sind bewusst auswählbar und enthalten direkt lesbare Daten. Die App richtet keinen externen Sicherungsdienst ein.

Nach einer Änderung des Recovery-Keys bleiben ältere Sicherungen an ihren ursprünglichen Schlüssel gebunden. Die erste Wiederherstellung deshalb mit einer eigenen Kopie und verfügbaren Originalschlüsseln prüfen.
