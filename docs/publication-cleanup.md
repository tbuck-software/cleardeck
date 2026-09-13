# Bereinigung vor der Veröffentlichung

Stand: 13.09.2026. Das Repository bleibt privat. Die Änderung auf öffentlich nimmt der Eigentümer selbst vor, nachdem die verbliebenen Schritte abgeschlossen sind.

## Inhalt und Build

- Eine interne Personalaufstellung und die ungeprüfte Quelldatei des Logos sind aus dem Git-Bestand und seiner Historie entfernt. Die Originaldateien und eine Sicherung des früheren Verlaufs liegen außerhalb des Repositorys in einem privaten Archiv; dieses Archiv darf nicht veröffentlicht oder zurückgepusht werden. Die exportierten Markenbilder bleiben erhalten.
- Personenbezüge in Review-Texten sind neutralisiert. Private Arbeitsplatzpfade wurden durch portable Verweise ersetzt.
- Der Build bettet kein GitHub-Zugriffstoken mehr ein. Ein Regressionstest kompiliert mit einem synthetischen Token und prüft, dass dessen Wert nicht im Ergebnis steht.
- Das betroffene Token wurde zur Sperrung an GitHub übermittelt; GitHub hat die Anfrage angenommen. Das Repository-Secret für diesen Buildweg ist gelöscht.
- Die sechs betroffenen Releases ab 1.7.1 sind als Entwürfe zurückgezogen; ihre 63 Assets und sechs zugehörige CI-Paketartefakte wurden entfernt. Für den nativen Upgrade-Test wurde der archivierte originale Windows-Installer 2.2.0 anschließend wieder in den privaten Entwurf geladen und gegen seinen früheren SHA-256-Digest geprüft.
- Automatische Veröffentlichung und Wiederverwendung des alten Mac-Pakets sind aus dem neuen Workflow entfernt. Kandidaten werden auf Tokens geprüft, einschließlich der unkomprimierten App-Bundles.

## Windows-Updates

Die Korrektur liegt im [Draft-PR #46](https://github.com/Rasalas/employee-db/pull/46) und ist auch in den Server-Branch übernommen. Version 2.2.1 enthält unter Einstellungen → Über ClearDeck → Update-Quelle ein Feld für den GitHub-Link, vorbelegt mit `https://github.com/Rasalas/employee-db`. Öffentliche Releases benötigen keinen Token. Für private Releases kann auf dem jeweiligen Gerät ein persönlicher Token mit Leserechten geschützt gespeichert werden. Ein abgewiesener Token erlaubt einen erneuten Versuch ohne Anmeldung. Ein gemeinsames Geheimnis wird nicht mehr im Paket ausgeliefert.

GitHub bleibt der Downloadort. Ein separates öffentliches Repository oder ein zusätzlicher Webserver ist dafür nicht erforderlich. Über eine Umbenennung und die spätere Veröffentlichung entscheidet weiterhin ausschließlich der Eigentümer.

Bestehende Windows-Installationen benötigen einmalig den korrigierten Installer über ihrer bisherigen Version. Die ursprünglichen Pakete enthalten den inzwischen zur Sperrung eingereichten Token im Klartext innerhalb von `app.asar`. Verbliebene lokale Paketkopien bleiben für die Upgrade-Prüfung erhalten.

Die nativen Windows-Prüfungen laufen noch. Geprüft werden die direkte Installation über einen aus dem Release-Tag rekonstruierten Stand 2.1.0, über den ursprünglichen Installer 2.2.0 und ein anschließendes In-App-Update von 2.2.1 auf einen ausschließlich für den Test gebauten Nachfolger. Erst erfolgreiche Paket- und Upgrade-Prüfungen erlauben die Veröffentlichung von 2.2.1. Der Test-Nachfolger 2.2.2 wird nicht veröffentlicht.

## Bilder für den Serverbetrieb

Die [sechs Aufnahmen des Serverablaufs](reviews/assets/server-mode/README.md) stammen aus einer getrennten Electron-Demo mit synthetischen Daten. Passwort und Datenschlüssel sind in den Aufnahmen nicht sichtbar.

## Git-Historie und verbleibende Schritte

Die Bereinigung ändert Commit- und Tag-IDs. Alte Arbeitskopien dürfen den früheren Verlauf nicht wieder hineinmergen; sie müssen auf den bereinigten Stand umgestellt oder neu geklont werden.

Alle 21 beschreibbaren Remote-Branches und 34 Tags sind gegen die bereinigte Zuordnung geprüft und bei Änderungen ersetzt. Die neun lokalen Arbeitskopien wurden umgestellt, alte Reflogs und nicht mehr erreichbare Git-Objekte entfernt. Die Prüfung der bereinigten Objekte findet weder die entfernten Dateien noch die gezielt bereinigten Personenbezüge und Arbeitsplatzpfade. Gitleaks meldet im bereinigten Verlauf keinen Fund. Diese Prüfungen sind kein Beweis dafür, dass jeder beliebige Inhalt zur Veröffentlichung freigegeben ist.

Auch nach dem Ersetzen aller beschreibbaren Branches und Tags kann GitHub frühere Inhalte über interne PR-Referenzen oder zwischengespeicherte Commitansichten vorhalten. Eine vollständige Entfernung dieser internen Referenzen könnte nur GitHub Support vornehmen. Auf Wunsch des Eigentümers wird keine Support-Anfrage gestellt; der lokale Entwurf wurde gelöscht. [GitHub-Anleitung zur vollständigen Entfernung](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

23 PRs sind von der Umschreibung betroffen. Eine serverseitige vollständige Entfernung alter PR-Referenzen und zwischengespeicherter Ansichten ist nicht bestätigt. Das Repository bleibt privat; über die spätere Veröffentlichung entscheidet weiterhin der Eigentümer.

Andere bestehende Klone und die Rechte an den verbleibenden Vorlagen sind vor dem öffentlichen Start noch zu prüfen. Die mögliche Erreichbarkeit alter Inhalte über GitHub-interne Referenzen bleibt dabei als offener Punkt dokumentiert. Die [übrigen Hosting- und Freigabeschritte](hosting-launch-plan.md) gelten weiterhin.
