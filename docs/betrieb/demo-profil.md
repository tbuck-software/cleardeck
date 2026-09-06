# Demo-Profil zum Ausprobieren

Im Projektordner starten:

```sh
npm run demo
```

Der Befehl baut die aktuelle Oberfläche und startet eine echte Electron-Instanz mit dem Fenstertitel „ClearDeck Demo · synthetische Daten“. Beim ersten Start entsteht ein eigener, umfangreicher Bestand. Weitere Starts öffnen denselben Bestand und erhalten Änderungen. Alle Personen tragen „Demo ·“ im Namen; Angaben, Belegverweise und Kontakte sind frei erfunden.

Das Profil benötigt **kein Passwort**. Es enthält ausschließlich synthetische Daten und speichert sie unverschlüsselt. Falls der Bildschirm verdeckt wurde, lässt er sich ohne Passwort wieder öffnen.

Die Daten liegen ausschließlich im ignorierten Projektverzeichnis `.cache/cleardeck-demo-profile/dev-ClearDeck/data/`. Die Datei `.cache/cleardeck-demo-profile/demo-profile.json` kennzeichnet dieses Profil. Produktivprofil, normales Entwicklungsprofil und vorherige temporäre Testprofile werden nicht überschrieben. Automatisches Seeding im normalen App-Betrieb bleibt ausgeschaltet.

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

Die Skripte `scripts/start-demo.cjs`, `scripts/demo-main.cjs` und `scripts/demo-data.cjs` gehören ausschließlich zu diesem ausdrücklichen Demo-Start. Es wurde keine neue App-Version veröffentlicht.
