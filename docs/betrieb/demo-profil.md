# Demo-Profil zum Ausprobieren

Im Projektordner starten:

```sh
npm run demo
```

Der Befehl startet die Electron-Forge-Entwicklungsumgebung und eine echte Electron-Instanz mit dem Fenstertitel „ClearDeck Demo · synthetische Daten“. Er bleibt im Terminal aktiv und übernimmt gespeicherte Codeänderungen automatisch. Beim ersten Start entsteht ein eigener, umfangreicher Bestand. Weitere Starts öffnen denselben Bestand und erhalten Änderungen. Personennamen haben kein künstliches Demo-Präfix. Der Fenstertitel kennzeichnet den synthetischen Bestand; Angaben, Belegverweise und Kontakte sind frei erfunden.

Das Profil benötigt **kein Passwort**. Es enthält ausschließlich synthetische Daten und speichert sie unverschlüsselt. Falls der Bildschirm verdeckt wurde, lässt er sich ohne Passwort wieder öffnen.

Die Daten liegen ausschließlich im ignorierten Projektverzeichnis `.cache/cleardeck-demo-profile/dev-ClearDeck/data/`. Die Datei `.cache/cleardeck-demo-profile/demo-profile.json` kennzeichnet dieses Profil. Produktivprofil, normales Entwicklungsprofil und vorherige temporäre Testprofile werden nicht überschrieben. Automatisches Seeding im normalen App-Betrieb bleibt ausgeschaltet.

## Entwickeln mit automatischer Aktualisierung

Datei speichern und das Demo-Fenster beobachten. Ein erneuter Aufruf von `npm run demo` ist für Änderungen an Anwendungscode nicht nötig.

| Geänderte Datei | Verhalten nach erfolgreicher Kompilierung |
| --- | --- |
| Renderer, etwa React-Komponenten | Forge aktualisiert die Oberfläche automatisch; bei JavaScript-Änderungen kann die Seite neu laden. |
| CSS | Der Entwicklungsserver übernimmt die Styles im laufenden Fenster. |
| Main-Prozess und seine eingebundenen Module | Electron führt die bestehende Datensicherung und Datenbankschließung aus und startet anschließend mit demselben Demo-Profil neu. |
| Preload und seine eingebundenen Module | Electron startet ebenfalls geordnet neu, damit die neue Preload-Brücke aktiv wird. |

Gespeicherte Formulareingaben bleiben in der Datenbank erhalten. Noch nicht gespeicherte Eingaben können bei einem Reload oder Neustart verloren gehen. Der Neustart setzt den Bestand nicht zurück und erzeugt keine neuen Demo-Personen.

Änderungen an Forge-/Webpack-Konfiguration, Startskripten oder installierten Abhängigkeiten erfordern einen neuen Terminalstart. Dafür den laufenden Befehl mit **Strg+C** beenden und danach `npm run demo` aufrufen. Strg+C beendet die Demo nach der Datenspeicherung und räumt Entwicklungsserver, Watcher und die eigene Startdatei auf.

Die Demo verwendet die lokalen Ports 3137 und 9137. Ein zweiter Demo-Aufruf meldet die bereits laufende Entwicklung. `npm start` und `npm run dev:updates` werden währenddessen abgewiesen, weil beide Forge-Konfigurationen das Build-Verzeichnis `.webpack` nutzen. Die Startbefehle legen ihre Prozessdateien vor dem Build an und prüfen gegenseitig auf einen laufenden Start. So wird auch die Zeit vor dem Öffnen der Entwicklungsports berücksichtigt. Zusätzlich prüft der Demo-Start die normalen Entwicklungsports 3000 und 9000. Zuerst den anderen Entwicklungsbefehl beenden, dann den gewünschten Modus starten.

## Enthaltener Bestand

Erzeugt am 06.09.2026, ausgehend von der vorhandenen synthetischen Seed-Sammlung und ergänzt für Datenbankschema 21:

- 25 Beschäftigte mit 30 Beschäftigungsabschnitten und 57 zeitlich gültigen Stundenständen.
- 72 Patient:innen, darunter aktive, beendete und absichtlich noch zu klärende Versorgungsfälle.
- 250 Einweisungs-/Nachweiseinträge: 134 durchgeführt und 116 offen, einschließlich verknüpfter Folgetermine.
- 203 Kompetenzzuordnungen mit laufenden Stufen und bestätigtem Abschluss sowie vorherigen Lernständen.
- 161 Visiten: 50 durchgeführt und 111 geplant; 15 noch nicht erledigte Maßnahmen vor Filterung nach aktivem Versorgungsbestand.
- Zwei unbestätigte Prüfungsentwürfe.

Fälligkeiten und Geburts-/Jubiläumstermine beziehen sich auf den ersten Erzeugungstag. Bei späteren Starts werden sie nicht automatisch verschoben. Fehlende Belege, ungeprüfte Stunden, veraltete Einstufungen und offene Maßnahmen sind absichtliche Testfälle. Sie lassen sich in den jeweiligen Formularen bearbeiten.

## Prüfung des ersten Starts

Die echte Oberfläche und das Preload/IPC melden 25 Beschäftigte, 72 Patient:innen und einen entsperrten unverschlüsselten Demo-Bestand. Team und Übersicht wurden sichtbar geprüft. Die Datenbankprüfung meldet `quick_check=ok`, keine ungültigen Fremdschlüssel, keine überlappenden Beschäftigungsabschnitte, keine Stundenstände außerhalb ihres Abschnitts und keine in der Zukunft als durchgeführt markierten Visiten. Durchführungs- und Bestätigungsdaten der Demo-Nachweise liegen innerhalb einer Beschäftigungsperiode. Eine erneute Demo-Erzeugung im bereits befüllten Bestand wird abgelehnt; erneutes Starten öffnet die bestehende Instanz beziehungsweise denselben Bestand.

Die Skripte `scripts/start-demo.cjs`, `scripts/demo-main.cjs`, `scripts/demo-data.cjs`, `scripts/demo-forge-hooks.cjs` und `scripts/demo-control.cjs` gehören ausschließlich zu diesem ausdrücklichen Demo-Start. Forge übernimmt Kompilierung und Renderer-Aktualisierung; die Demo-Ergänzung fordert bei Main-/Preload-Änderungen dessen Neustart an. Es wurde keine neue App-Version veröffentlicht.

## Prüfung des Entwicklungsmodus am 06.09.2026

Auf macOS wurden vorübergehende Änderungen an einer React-Überschrift, CSS, einem Main-Modul und der Preload-Brücke im echten Electron-Fenster geprüft und anschließend entfernt. Renderer und CSS wurden bei unveränderter Electron-Prozess-ID sichtbar. Main und Preload führten jeweils zu einer neuen Prozess-ID, mit bestätigter Datenbankschließung vor dem neuen Start. Die Preload-Testfunktion war nach dem Zurücknehmen wieder entfernt.

Der Vergleich aller Datenbanktabellen vor und nach diesen Neustarts war identisch. Danach wurden auf ausdrücklichen Wunsch die vom Generator gesetzten Namenspräfixe bei 25 Beschäftigten und 72 Patient:innen entfernt. Die Änderung war auf dieselben IDs und unveränderte ursprüngliche Namen beschränkt. Alle anderen Felder, Tabellen und Beziehungen blieben im vollständigen Vergleich identisch. Eine Sicherung vor dieser Änderung liegt innerhalb des Demo-Profils als `before-name-cleanup.db` vor. Team- und Patientenliste wurden anschließend sichtbar geprüft; insgesamt bleiben 25 Beschäftigte und 72 Patient:innen vorhanden, davon 69 aktive Patient:innen.

Strg+C wurde im Terminal geprüft. Electron bestätigte die Datenspeicherung, die Prozesse endeten, die Ports wurden frei und die Demo-Start-/Steuerdateien entfernt. Ein anschließender Start öffnete denselben entsperrten Bestand. Ein doppelter Demo-Start und der Konflikt mit dem normalen Entwicklungsstart wurden ebenfalls geprüft. Bei Konfigurations- oder Abhängigkeitsänderungen bleibt ein manueller Terminalneustart erforderlich. Windows und Linux wurden in diesem Durchlauf nicht praktisch geprüft.

Zusätzlich bestanden 300 Tests in 54 Testdateien, die TypeScript-Prüfung und ESLint für die geänderten Demo-Dateien. Eine separate Erzeugung in einer leeren In-Memory-Datenbank bestätigte den neuen Bestand ohne Namenspräfixe, gültige Fremdschlüssel, passende Beschäftigungsdaten und die Ablehnung einer erneuten Befüllung.
