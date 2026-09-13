# Bereinigung vor der Veröffentlichung

Stand: 13.09.2026. Das Repository bleibt privat. Die Änderung auf öffentlich nimmt der Eigentümer selbst vor, nachdem die verbliebenen Schritte abgeschlossen sind.

## Inhalt und Build

- Eine interne Personalaufstellung und die ungeprüfte Quelldatei des Logos werden aus dem Git-Bestand und seiner Historie entfernt. Die Originaldateien sind außerhalb des Repositorys privat gesichert; die exportierten Markenbilder bleiben erhalten.
- Personenbezüge in Review-Texten sind neutralisiert. Private Arbeitsplatzpfade wurden durch portable Verweise ersetzt.
- Der Build bettet kein GitHub-Zugriffstoken mehr ein. Ein Regressionstest kompiliert mit einem synthetischen Token und prüft, dass dessen Wert nicht im Ergebnis steht.
- Das betroffene Token wurde zur Sperrung an GitHub übermittelt; GitHub hat die Anfrage angenommen. Das Repository-Secret für diesen Buildweg ist gelöscht.
- Die sechs betroffenen Releases ab 1.7.1 sind als Entwürfe zurückgezogen; ihre 63 Assets und sechs zugehörige CI-Paketartefakte wurden entfernt.
- Automatische Veröffentlichung und Wiederverwendung des alten Mac-Pakets sind aus dem neuen Workflow entfernt. Kandidaten werden auf Tokens geprüft, einschließlich der unkomprimierten App-Bundles.

Der alte private Auto-Update-Zugriff benötigt einen neuen Verteilungsweg. Ein neues gemeinsames Token darf nicht wieder in App-Pakete eingebaut werden. Vor einem neuen Release sind saubere Pakete und ein neuer Ausgangsstand für native Upgrade-Prüfungen erforderlich. Diese Bereinigung veröffentlicht keine neue App-Version.

## Bilder für den Serverbetrieb

Die [sechs Aufnahmen des Serverablaufs](reviews/assets/server-mode/README.md) stammen aus einer getrennten Electron-Demo mit synthetischen Daten. Passwort und Datenschlüssel sind in den Aufnahmen nicht sichtbar.

## Git-Historie und verbleibende Schritte

Die Bereinigung ändert Commit- und Tag-IDs. Alte Arbeitskopien dürfen den früheren Verlauf nicht wieder hineinmergen; sie müssen auf den bereinigten Stand umgestellt oder neu geklont werden.

Auch nach dem Ersetzen aller beschreibbaren Branches und Tags kann GitHub frühere Inhalte über interne PR-Referenzen oder zwischengespeicherte Commitansichten vorhalten. Diese verbleibende Entfernung muss GitHub Support vornehmen. Die dafür benötigten Informationen werden separat und lokal vorbereitet. [GitHub-Anleitung zur vollständigen Entfernung](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

Vor dem öffentlichen Start müssen die serverseitige Entfernung bestätigt, andere bestehende Klone bereinigt und die Rechte an den verbleibenden Vorlagen geprüft sein. Die [übrigen Hosting- und Freigabeschritte](hosting-launch-plan.md) gelten weiterhin.
