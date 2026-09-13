# Windows-Updates mit einstellbarer GitHub-Quelle

Stand: 13.09.2026. Die Änderungen sind im privaten Draft-PR [#45](https://github.com/Rasalas/employee-db/pull/45) zusammengeführt. Der zusätzliche Draft #46 ist geschlossen. Die Veröffentlichung des Repositorys bleibt beim Eigentümer.

## Verhalten

Unter Einstellungen → Über ClearDeck → Update-Quelle steht ein GitHub-Link. Vorbelegt ist `https://github.com/Rasalas/employee-db`. Ein persönlicher Zugriffstoken ist optional; die App speichert ihn auf dem Gerät mit dem geschützten Speicher des Betriebssystems verschlüsselt. Der Renderer erhält nur die Information, ob ein Token hinterlegt ist. Ein Repository-Wechsel übernimmt den alten Token nicht ungefragt.

Öffentliche Releases lassen sich ohne Anmeldung prüfen. Private Releases benötigen einen Token mit Leserechten für das gewählte Repository. Nach einem abgewiesenen Token versucht die App den öffentlichen Zugriff einmal erneut. Ein fehlgeschlagener Speicherversuch erhält die bisherigen Einstellungen und den vorhandenen Updatestatus. Während eines laufenden oder bereitliegenden Updates kann die Quelle nicht geändert werden.

Die alten Windows-Apps senden weiterhin ihren eingebetteten, inzwischen zur Sperrung eingereichten Token. Sie brauchen deshalb einmalig den korrigierten Installer über ihrer bisherigen Installation. Der neue Build enthält keinen gemeinsamen Zugriffstoken.

## Prüfungen

Der erste Windows-Lauf deckte einen Fehler im Prüfsystem bei ASAR-Pfaden mit Backslashes auf. Dieser Fehler ist behoben und durch einen Regressionstest abgedeckt. Der zweite Lauf bestätigte die direkte Installation über 2.1.0 und das anschließende In-App-Update von 2.2.1 auf den Testnachfolger 2.2.2. Der Abruf des ursprünglichen 2.2.0-Installers aus dem privaten Release-Entwurf erforderte eine zusätzliche Berechtigung für den Testjob.

Der abschließende [Windows-Lauf](https://github.com/Rasalas/employee-db/actions/runs/34763861960) prüft den vollständigen PR-Stand `f93c26d1bd3076dbbf8b63a33ab978e42c492231`, einschließlich Servermodus. Alle Codeprüfungen, Paketprüfungen und drei nativen Upgrade-Jobs sind bestanden. Die heruntergeladenen 2.2.1-Dateien wurden lokal erneut mit demselben Verifier geprüft. [Ergebnisse und SHA-256-Prüfsummen](assets/windows-update-recovery/verification.json).

| Ausgangspunkt | Weg | Ziel | Status |
| --- | --- | --- | --- |
| 2.1.0, aus dem bereinigten Release-Tag gebaut | Installer über vorhandene Installation | 2.2.1 | Bestanden |
| Ursprünglicher 2.2.0-Installer | Installer über vorhandene Installation | 2.2.1 | Bestanden |
| 2.2.1 | Herunterladen und Installieren aus der App | 2.2.2, nur für den Test | Bestanden |

Die nativen Tests verwenden isolierte Windows-Runner und synthetische verschlüsselte Profile. Vor der Installation wird das alte Profil mit seinem Passwort geöffnet. Nach der Installation werden Passwort, verschlüsselte Konfiguration, Datenbankinhalt, Einstellungen und gespeicherte Kalenderansicht bei zwei Starts geprüft. Ein synthetischer Update-Token wird im Windows-Speicher geschützt abgelegt, nach einem Neustart geprüft und anschließend entfernt.

Der ursprüngliche 2.2.0-Installer wird gegen seinen archivierten SHA-256-Digest geprüft: `28f9eaf3fc82d1a7a1eff41065df3a6e3b3cdfbb323482c62737f92740e74784`. Für 2.1.0 ist kein ursprünglicher Installer mehr vorhanden; dieser Ausgangspunkt wird aus dem damaligen bereinigten Release-Tag rekonstruiert.

Die Paketprüfung kontrolliert Manifest, Installer-Referenz, Größen und Prüfsummen, Squirrel-Dateien sowie die Inhalte beider `app.asar`-Archive aus ZIP und NUPKG. Die tatsächlichen öffentlichen und privaten GitHub-Provider werden mit einem lokalen Testserver geprüft, einschließlich Dateiauswahl und der verwendeten Anmeldung. Die Ansicht wurde in der laufenden Electron-App bedient; die sieben PR-Bilder wurden als direkte GitHub-Anhänge hochgeladen und im angemeldeten Browser geladen.

## Verteilung und Grenzen

Ein Testlauf veröffentlicht keine App. Version 2.2.2 ist ausschließlich ein Testnachfolger und darf nicht veröffentlicht werden. Der vorbereitete Veröffentlichungsweg für 2.2.1 verlangt einen passenden Tag, erfolgreiche Windows-Prüfungen und die erneute Prüfung der aus dem Release-Entwurf heruntergeladenen Dateien. Ein neuer Release ist noch nicht veröffentlicht.

Die Tests wurden nicht auf dem Gerät des bestehenden Nutzers ausgeführt. Ein öffentlicher Live-Feed wird erst möglich, wenn der Eigentümer das Repository selbst öffentlich stellt. Der private Betrieb bleibt möglich; dafür muss der Nutzer nach der einmaligen Installation seinen Zugriffstoken in den Einstellungen hinterlegen. Ein neuer Mac- oder Linux-Installer ist nicht Teil dieses Windows-Nachweises.

Der optionale Serverbetrieb und seine noch offenen Betriebs- und Datenschutzaufgaben stehen im [Hosting- und Launch-Plan](../hosting-launch-plan.md). Die [Bereinigung vor der Veröffentlichung](../publication-cleanup.md) dokumentiert auch die verbleibenden GitHub-internen Altansichten.
