# ClearDeck

ClearDeck ist eine Electron-Desktop-App für Teamverwaltung, historische Arbeitszeiten und Vollzeitäquivalente sowie Patientenübersichten, Pflegevisiten und Nachweise.

## Datenablage

Der lokale Betrieb bleibt Standard. Die App unterstützt eine verschlüsselte lokale Datenbank und einen ausdrücklich wählbaren unverschlüsselten Betrieb. Entwicklung und installierte App verwenden getrennte Datenverzeichnisse.

Der optionale Servermodus ist eine technische Vorschau für einen gemeinsamen Bestand auf mehreren Geräten. Er verwendet einen selbst betriebenen ClearDeck-Server mit PostgreSQL. Der Server speichert verschlüsselte Snapshots; der gemeinsame Datenschlüssel bleibt bei den Clients. Persönliche Konten erhalten Lese- oder Schreibrechte. Der Modus benötigt eine Verbindung zum Server und unterstützt Bestände bis 32 MiB.

Unter **Einstellungen → Allgemein → Datenablage** lässt sich der Server verbinden. Eine Übertragung des lokalen Bestands muss ausdrücklich bestätigt werden. Beim Rückwechsel bleiben lokale Daten und Serverdaten getrennt.

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

## Dokumentation

[docs/README.md](docs/README.md) führt zu Bedienhinweisen, Anforderungen, Architekturentscheidungen und Prüfberichten. Eine separate Dokumentationswebsite ist derzeit nicht eingerichtet.

Personen in Demo-Profilen und Test-Fixtures sind synthetisch. Private Originalunterlagen gehören außerhalb des Repositorys; sie dürfen auch nicht in dessen Git-Historie übernommen werden.

## Pakete und Updates

`npm run make` erstellt lokale Installationspakete. Der geprüfte Releaseablauf ist in der [Release-Anleitung](.agents/skills/cleardeck-release/SKILL.md) beschrieben.

Zugriffstokens dürfen nicht in App-Pakete eingebaut werden. Solange das Repository privat ist, erfolgt die Verteilung neuer Pakete manuell oder über einen separat eingerichteten Update-Feed. Der Stand der Bereinigung und die noch notwendigen Schritte werden im [Hosting- und Launch-Plan](docs/hosting-launch-plan.md) geführt.

## Lizenz

[MIT](LICENSE). Copyright-Hinweise und Lizenztext müssen bei der Weitergabe erhalten bleiben.
