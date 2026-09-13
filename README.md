# ClearDeck

ClearDeck ist eine Electron-Desktop-App für Teamverwaltung, historische Arbeitszeiten und Vollzeitäquivalente sowie Patientenübersichten, Pflegevisiten und Nachweise.

## Datenablage

Der lokale Betrieb bleibt Standard. Die App unterstützt eine verschlüsselte lokale Datenbank und einen ausdrücklich wählbaren unverschlüsselten Betrieb. Entwicklung und installierte App verwenden getrennte Datenverzeichnisse. Der lokale Bestand bleibt vom Serverbestand getrennt.

Der optionale Serverbetrieb ist eine technische Vorschau für einen gemeinsamen Bestand auf mehreren Geräten. Protokoll 2 und Schema 23 synchronisieren lesbare Datensätze mit PostgreSQL. Der Server hält die aktuellen Zeilen, einen Änderungsverlauf und Tombstones für Löschungen. Er erhält keinen verschlüsselten SQLite-Gesamtsnapshot und keinen gemeinsamen Datenschlüssel.

Für eine ausdrückliche Rückmigration kann der Serverbestand als direkt lesbare SQLite-Datei exportiert werden. Eine portable verschlüsselte Client-Sicherung gibt es nicht, weil ihr lokaler Schlüssel an das Geräteprofil gebunden ist.

Jedes Konto und Gerät besitzt für die Kombination aus Serveradresse und Benutzername eine eigene verschlüsselte lokale Arbeitskopie. Sie enthält die lokale SQLite-Datenbank, den bestätigten Serverstand und die Outbox. Diese Teile werden atomar gespeichert. Ein vom Gerät erzeugter lokaler Schlüssel wird mit dem geschützten Betriebssystemspeicher (`safeStorage`) umschlossen. Es gibt weder ein gemeinsames `dataKey` noch ein manuelles Schlüsselfeld.

Der lokale verschlüsselte Cache ist auf 128 MiB begrenzt; v2-Synchronisationsanfragen sind auf 32 MiB begrenzt.

Änderungen werden lokal sofort wirksam und anschließend so schnell wie möglich übertragen. Zusätzlich fragt der Client ungefähr alle drei Sekunden neue Deltas ab. Netzwerkzugriffe halten die lokale Datenbank-Sperre nicht. Bei einem Konflikt bleiben die wartenden Änderungen erhalten, bis der Benutzer die Serverversion übernimmt oder alle lokalen Änderungen erneut sendet.

Unter **Einstellungen → Verbindungen** lassen sich `Serverbestand öffnen…` und `Lokalen Bestand auf Server übertragen…` getrennt starten. Nach einer erfolgreichen Online-Anmeldung ist `Offline öffnen` ausdrücklich möglich. Dafür prüft die App einen gespeicherten Passwortnachweis der letzten Online-Anmeldung. Bei einer fehlgeschlagenen Online-Anmeldung erfolgt kein automatischer Offline-Fallback. Passwort und Sitzungstoken bleiben nur im Speicher; eine Sitzung läuft nach acht Stunden ab.

Der Server kennt die Rollen `admin`, `editor` und `reader`. Ein `admin` darf einen leeren Server initialisieren und verfügt zusätzlich über die normalen Lese- und Schreibrechte eines `editor`; für den normalen Schreibbetrieb werden persönliche `editor`-Konten empfohlen, `reader`-Konten lesen. Das erste Admin-Konto wird bei der Serverbereitstellung über die Server-CLI angelegt. Eine Admin-Oberfläche, MFA und mandanten- oder datensatzfeine Rechte sind noch nicht vorhanden. Ein von ClearDeck betriebener Hosted-Dienst und ein produktiver Server sind nicht eingerichtet.

Das persönliche ClearDeck-Konto dient der Anmeldung in der Desktop-App. Der Verbindungsdialog zeigt `Benutzername` und `Passwort`; die `Serveradresse` wird über `Server einrichten…` beziehungsweise `Server ändern…` gesetzt. PostgreSQL- und andere SQL-Zugangsdaten werden ausschließlich auf dem Server verwaltet und nie in der App eingegeben. Einen voreingestellten Hosted-Dienst gibt es nicht. Nach der Erstinitialisierung meldet sich der normale Betrieb mit einem persönlichen `editor`- oder `reader`-Konto an; eine Selbstregistrierung gibt es nicht.

- [Server einrichten und bedienen](docs/server-mode.md)
- [Hosting und nächste Schritte](docs/hosting-launch-plan.md)
- [Datenübernahme und Sicherung](docs/betrieb/datenuebernahme-und-sicherung.md)

## Entwicklung

Die CI installiert die Abhängigkeiten mit Node.js 22. Docker wird zusätzlich für die PostgreSQL-Integrationstests benötigt.

```sh
npm ci
npm start
```

Für Aufnahmen und Bedienprüfungen gibt es ein getrenntes Profil mit vollständig synthetischen Daten:

```sh
npm run demo
```

Mit `make dev-server` startet dasselbe Demo-Profil zusammen mit einem lokalen ClearDeck-Server (PostgreSQL in Docker). Adresse, Konten und Passwort stehen im Terminal. `make dev-server-reset` leert den Server, damit eine Erstübertragung wieder möglich ist.

[Entwicklungsumgebung](docs/development.md) und [Demo-Profil](docs/betrieb/demo-profil.md) beschreiben Datenpfade, Start und Wiederverwendung.

## Prüfungen

```sh
npx tsc --noEmit
npm run lint
```

Die Desktoptests verwenden Nodes SQLite-Snapshot-API. Wie in der CI nach der Installation auf Node.js 26.8.1 wechseln:

```sh
npx vitest run
```

Servertests laufen separat unter Node.js 22 oder neuer:

```sh
npm --prefix server ci
npm --prefix server test
npm --prefix server run test:integration
```

Der aktuelle vollständige Prüfstand umfasst 610 erfolgreiche Desktoptests in 92 Dateien; `npx tsc --noEmit` und `npm run lint` waren erfolgreich. `npm test` im Serverpaket meldete neun bestandene und zwei übersprungene Tests; `npm run test:integration` gegen reales PostgreSQL war mit zwei von zwei Fällen erfolgreich. Der Docker-Image-Build war erfolgreich.

Der native Electron-Lauf mit 1.405 synthetischen Zeilen bestätigte Bootstrap mit Revision 1, die lokale Änderung von 36 auf 37 über Neustart und ausdrückliches `Offline öffnen`, den Reconnect mit Revision 2 sowie einen echten CAS-Konflikt zwischen 38 und 39. Die ausstehende Änderung blieb erhalten; die Recovery-Kopie wurde verschlüsselt mit Zeitstempel und UUID angelegt. Nach der Konfliktentscheidung zeigte die App wieder die Serverversion 38 mit Status `Synchronisiert`; der bestätigte Rückwechsel zum lokalen Bestand zeigte den ursprünglichen Wert 36. Zusätzlich wies die Desktop-App einen Editor vor dem Datenupload mit der Admin-Anforderung ab; der separate API-Test bestätigte die entsprechende 403-Antwort, und PostgreSQL blieb bei `initialized=false`, Revision 0. Der anschließende Admin-Lauf übertrug 1.405 Zeilen und bestätigte `initialized=true`, Revision 1.

Die v2-Client- und Serverläufe einschließlich Admin-Erstinitialisierung, Nicht-Admin-Sperre und persönlicher Editor-/Reader-Anmeldung sind damit dokumentiert. Vor einem breiteren Einsatz bleiben die operative TLS- und Zertifikatserneuerungsprüfung, eine geprüfte PostgreSQL-Backup- und Restore-Strecke, eine unabhängige Sicherheitsprüfung sowie eine verbindliche Richtlinie für Offline-Kopien nach Kontowiderruf offen.

## Dokumentation

[docs/README.md](docs/README.md) führt zu Bedienhinweisen, Anforderungen, Architekturentscheidungen und Prüfberichten. Eine separate Dokumentationswebsite ist derzeit nicht eingerichtet.

Personen in Demo-Profilen und Test-Fixtures sind synthetisch. Private Originalunterlagen gehören außerhalb des Repositorys; sie dürfen auch nicht in dessen Git-Historie übernommen werden.

## Pakete und Updates

`npm run make` erstellt lokale Installationspakete. Der geprüfte Releaseablauf ist in der [Release-Anleitung](.agents/skills/cleardeck-release/SKILL.md) beschrieben.

Zugriffstokens dürfen nicht in App-Pakete eingebaut werden. Solange das Repository privat ist, erfolgt die Verteilung neuer Pakete manuell oder über einen separat eingerichteten Update-Feed. Der Stand der Bereinigung und die noch notwendigen Schritte werden im [Hosting- und Launch-Plan](docs/hosting-launch-plan.md) geführt.

## Lizenz

[MIT](LICENSE). Copyright-Hinweise und Lizenztext müssen bei der Weitergabe erhalten bleiben.
