# Bereinigung vor der Veröffentlichung

Stand: 14.09.2026. Das Repository bleibt privat. Es gibt keine Umbenennung, keine öffentliche Veröffentlichung und keinen neuen Release. Die Änderung der Sichtbarkeit nimmt der Eigentümer zuletzt selbst vor, nachdem die verbliebenen Schritte abgeschlossen sind.

## Inhalt und Build

- Eine interne Personalaufstellung und die ungeprüfte Quelldatei des Logos sind aus dem Git-Bestand und seiner Historie entfernt. Die Originaldateien und eine Sicherung des früheren Verlaufs liegen außerhalb des Repositorys in einem privaten Archiv; dieses Archiv darf nicht veröffentlicht oder zurückgepusht werden. Die exportierten Markenbilder bleiben erhalten.
- Personenbezüge in Review-Texten sind neutralisiert. Private Arbeitsplatzpfade wurden durch portable Verweise ersetzt.
- Der Build bettet kein GitHub-Zugriffstoken mehr ein. Ein Regressionstest kompiliert mit einem synthetischen Token und prüft, dass dessen Wert nicht im Ergebnis steht.
- Das betroffene Token wurde zur Sperrung an GitHub übermittelt; GitHub hat die Anfrage angenommen. Das Repository-Secret für diesen Buildweg ist gelöscht.
- Die sechs betroffenen Releases ab 1.7.1 sind als Entwürfe zurückgezogen; ihre 63 Assets und sechs zugehörige CI-Paketartefakte wurden entfernt. Für den nativen Upgrade-Test wurde der archivierte originale Windows-Installer 2.2.0 anschließend wieder in den privaten Entwurf geladen und gegen seinen früheren SHA-256-Digest geprüft.
- Automatische Veröffentlichung und Wiederverwendung des alten Mac-Pakets sind aus dem neuen Workflow entfernt. Kandidaten werden auf Tokens geprüft, einschließlich der unkomprimierten App-Bundles.

## Windows-Updates

Die Korrektur ist Teil des gemeinsamen [PRs #45](https://github.com/Rasalas/employee-db/pull/45), der als Ready markiert ist. Der zusätzliche Draft #46 wurde nach dem Zusammenführen geschlossen. Die Windows-Prüfung vom 13.09.2026 bezog sich auf den damaligen UI- und v1-Snapshot-Stand des Commits d3309bf. Sie prüft den aktuellen Protokoll-2-Stand nicht. Version 2.2.1 enthält unter Einstellungen → Verbindungen → Update-Quelle ändern… ein Feld für den GitHub-Link, vorbelegt mit `https://github.com/Rasalas/employee-db`. Öffentliche Releases benötigen keinen Token. Für private Releases kann auf dem jeweiligen Gerät ein persönlicher Token mit Leserechten geschützt gespeichert werden. Ein abgewiesener Token erlaubt einen erneuten Versuch ohne Anmeldung. Ein gemeinsames Geheimnis wird nicht mehr im Paket ausgeliefert.

GitHub bleibt der Downloadort. Ein separates öffentliches Repository oder ein zusätzlicher Webserver ist dafür nicht erforderlich. Über eine Umbenennung und die spätere Veröffentlichung entscheidet weiterhin ausschließlich der Eigentümer.

Bestehende Windows-Installationen benötigen einmalig den korrigierten Installer über ihrer bisherigen Version. Die ursprünglichen Pakete enthalten den inzwischen zur Sperrung eingereichten Token im Klartext innerhalb von `app.asar`. Verbliebene lokale Paketkopien bleiben für die Upgrade-Prüfung erhalten.

Die nativen Windows-Prüfungen waren für den damaligen Commit d3309bf und den v1-Snapshot-Stand bestanden. Geprüft wurden die direkte Installation über einen aus dem Release-Tag rekonstruierten Stand 2.1.0, über den ursprünglichen Installer 2.2.0 und ein anschließendes In-App-Update von 2.2.1 auf einen ausschließlich für den Test gebauten Nachfolger. Paket- und Upgrade-Prüfungen sind im [Windows-Testbericht](reviews/2026-09-13-windows-update-recovery.md) dokumentiert. Die aktuelle Protokoll-2-Implementierung ist unter Windows noch nicht nativ geprüft. Ein neuer Release ist noch nicht veröffentlicht. Das gebaute 2.2.2-Paket bleibt ausschließlich ein Testnachfolger.

## Bilder für den Serverbetrieb

Die [sechs Aufnahmen des Serverablaufs](reviews/assets/server-mode/README.md) stammen aus einer getrennten Electron-Demo mit synthetischen Daten vom 13.09.2026. Sie zeigen die UI des damaligen v1-Snapshot-Servers mit Serverpasswort und gemeinsamem Datenschlüssel. Beide Geheimnisse sind in den Aufnahmen nicht sichtbar. Die Aufnahmen sind historische UI-Evidenz und kein Nachweis für den aktuellen Protokoll-2-Server mit lesbaren Datensätzen.

## Aktueller Serverstand

Die Dokumentation beschreibt jetzt Protokoll 2 und Sync-Schema 23. Die aktuelle v2-Prüfung umfasst 610 erfolgreiche Desktoptests in 92 Dateien, erfolgreiche TypeScript- und Lint-Prüfungen, neun bestandene und zwei übersprungene Servertests, zwei von zwei Fälle gegen ein echtes PostgreSQL und einen erfolgreichen Docker-Image-Build. Der native Electron-Lauf mit 1.405 synthetischen Zeilen bestätigte Bootstrap, Offline öffnen über Neustart, Reconnect, echten CAS-Konflikt, verschlüsselte Recovery-Kopie, Serverversionsentscheidung und den bestätigten Rückwechsel zum lokalen Bestand. Im zusätzlichen Rollenlauf wies die Desktop-App einen Editor vor dem Datenupload ab; PostgreSQL blieb bei `initialized=false`, Revision 0. Ein separater API-Test bestätigte die serverseitige Ablehnung mit HTTP 403; der Admin-Lauf übertrug 1.405 Zeilen und bestätigte `initialized=true`, Revision 1. [Prüfung des optionalen Serverbetriebs](server-mode-verification.md) trennt diese Ergebnisse von den historischen v1-Nachweisen. Ein von ClearDeck betriebener Hosted-Dienst und ein produktiver Server sind nicht eingerichtet; einen voreingestellten Hosted-Dienst gibt es nicht.

Die Desktop-App verwendet persönliche ClearDeck-Konten mit Benutzername und Passwort. Die Rollen sind `admin`, `editor` und `reader`: Ein Admin initialisiert leere Server und hat zusätzlich die normalen Lese- und Schreibrechte, während der normale Betrieb mit persönlichen Editor- oder Reader-Konten erfolgt. Die Serveradresse wird über Server einrichten… oder Server ändern… gesetzt; PostgreSQL- und andere SQL-Zugangsdaten bleiben ausschließlich auf dem Server. Konten werden derzeit vollständig über die Server-CLI verwaltet; eine grafische Benutzerverwaltung ist eine nächste Produktpriorität.

Vor einer Veröffentlichung bleiben die operative TLS- und Zertifikatserneuerungsprüfung, eine geprüfte PostgreSQL-Backup- und Restore-Strecke, eine unabhängige Sicherheitsprüfung sowie eine Richtlinie für Offline-Kopien nach Kontowiderruf offen. Der [Hosting- und Launch-Plan](hosting-launch-plan.md) führt die Abnahmeevidenz. Die aktuelle Protokoll-2-Implementierung ist unter Windows noch nicht nativ geprüft; die Windows-Evidenz vom 13.09.2026 gehört zum Commit d3309bf und zum v1-Snapshot-Stand.

## Git-Historie und verbleibende Schritte

Die Bereinigung ändert Commit- und Tag-IDs. Alte Arbeitskopien dürfen den früheren Verlauf nicht wieder hineinmergen; sie müssen auf den bereinigten Stand umgestellt oder neu geklont werden.

Alle 21 beschreibbaren Remote-Branches und 34 Tags sind gegen die bereinigte Zuordnung geprüft und bei Änderungen ersetzt. Die neun lokalen Arbeitskopien wurden umgestellt, alte Reflogs und nicht mehr erreichbare Git-Objekte entfernt. Die Prüfung der bereinigten Objekte findet weder die entfernten Dateien noch die gezielt bereinigten Personenbezüge und Arbeitsplatzpfade. Gitleaks meldet im bereinigten Verlauf keinen Fund. Diese Prüfungen sind kein Beweis dafür, dass jeder beliebige Inhalt zur Veröffentlichung freigegeben ist.

Auch nach dem Ersetzen aller beschreibbaren Branches und Tags kann GitHub frühere Inhalte über interne PR-Referenzen oder zwischengespeicherte Commitansichten vorhalten. Eine vollständige Entfernung dieser internen Referenzen könnte nur GitHub Support vornehmen. Auf Wunsch des Eigentümers wird keine Support-Anfrage gestellt; der lokale Entwurf wurde gelöscht. [GitHub-Anleitung zur vollständigen Entfernung](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

23 PRs sind von der Umschreibung betroffen. Eine serverseitige vollständige Entfernung alter PR-Referenzen und zwischengespeicherter Ansichten ist nicht bestätigt. Das Repository bleibt privat; über die spätere Veröffentlichung entscheidet weiterhin der Eigentümer.

Andere bestehende Klone und die Rechte an den verbleibenden Vorlagen sind vor dem öffentlichen Start noch zu prüfen. Die mögliche Erreichbarkeit alter Inhalte über GitHub-interne Referenzen bleibt dabei als offener Punkt dokumentiert. Die [übrigen Hosting- und Freigabeschritte](hosting-launch-plan.md) gelten weiterhin.
