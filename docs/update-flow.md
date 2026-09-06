# Updates herunterladen und installieren

Die App prüft beim Start, stündlich und beim Aktivieren des Fensters auf Updates. Sie lädt ein gefundenes Update erst nach einem Klick auf „Update herunterladen“. Die Anzeige zeigt Prozent und eine geschätzte Restzeit. Bei unbekannter Geschwindigkeit wird keine Restzeit erfunden.

Nach dem Download startet „Update installieren und neu starten“ die Installation. Die App zeigt währenddessen „Neustart wird vorbereitet“. Ein erneuter Klick löst keine zweite Installation aus. Fensterwechsel überschreiben weder einen laufenden Download noch eine bereitliegende Installation oder deren Fehler. Fehler bleiben mit kopierbaren Details und einem Knopf zum Wiederholen des fehlgeschlagenen Schritts sichtbar. Sidebar, Einstellungen und Anmeldebildschirm verwenden dieselbe Anzeige.

## Änderungen seit der installierten Version

`CHANGELOG.md` enthält pro Release einen Abschnitt `## [1.8.0]`. `make release-patch`, `make release-minor` und `make release-major` übernehmen die Einträge aus `[Unreleased]` automatisch in den Abschnitt der neuen Paketversion und committen den Changelog mit. Bei manueller Versionierung erledigt `node scripts/release-notes.js --prepare` denselben Schritt. Die historischen Einträge wurden aus den Commit-Bereichen zwischen den Release-Tags rekonstruiert und auf Deutsch zusammengefasst.

Der Manifest-Generator schreibt die gesamte veröffentlichte Historie bis einschließlich der Paketversion als `releaseNotes`-Array in die Update-Metadaten. Der Client filtert semantisch auf `installierte Version < Eintrag <= angebotene Version` und sortiert neueste Versionen zuerst. Dadurch enthält die Anzeige auch die Änderungen übersprungener Zwischenversionen. Unveröffentlichte Änderungen und bereits installierte Versionen erscheinen nicht. Ältere Feeds mit einem einfachen Text bleiben lesbar; fehlende Notizen werden ausdrücklich angezeigt.

Der GitHub-Release-Text verwendet aus derselben Datei nur die Notizen der veröffentlichten Version. Es sind keine zusätzlichen GitHub-Aufrufe aus dem Renderer nötig. Die Notizen werden als Text dargestellt, nicht als ausführbares HTML. Hover, Tastaturfokus und der Infoknopf öffnen die scrollbar begrenzte Liste; Escape schließt sie. Beim Verlassen wartet sie 250 ms. Ein Wechsel vom Auslöser ins Popover bricht das Schließen ab, sodass die Liste dort scrollbar bleibt.

## Grenzen der Prüfung

Die Datenbank wird nach einem Update beim ersten Öffnen automatisch weitergeführt. Aus den Original-Tags 1.7.1 und 1.8.0 erzeugte Profile wurden einschließlich bisherigem Passwort, Historie, automatischer Migrationssicherung, Fehlerabbruch und erneutem Öffnen geprüft. Ein manueller Export, Import oder ein manuelles Backup ist dafür keine Voraussetzung. Die [Upgrade-Matrix und der Designabgleich vom 06.09.2026](reviews/2026-09-06-upgrade-171-180-und-design.md) dokumentieren Methode und Ergebnisse.

Der untersuchte Arbeitsstand trägt noch Paketversion 1.8.0 und ist nicht veröffentlicht. Ein späteres Update für bereits installierte 1.8.0-Clients muss eine höhere Versionsnummer erhalten. Die erfolgreichen Datenbanktests sind kein Nachweis eines neuen signierten Installers.

Die Regressionstests prüfen die Ereignisse des Updaters, die explizite Download-/Installationsfolge, doppelte Klicks, Fehler und Wiederholungen, Restzeitberechnung und die kumulative Versionsauswahl. Die Anzeige wurde zusätzlich in einer Browser-Vorschau mit simulierten Zuständen bedient. Das ersetzt keinen nativen Installationstest für jede Betriebssystemversion.

Der native Updateversuch der installierten Mac-Version 1.7.2 am 5. September 2026 ist inzwischen durch das macOS-Systemprotokoll bestätigt: Der Download endete, danach wurde die Ressourcensignatur mit OSStatus -67056 abgelehnt. Befund und Grenzen der Reparatur stehen in `mac-update-repair.md`. Die Windows-Metadatenreparatur und erfolgreichen nativen UI-Tests stehen in `windows-update-repair.md`.

## Lokale Diagnose und Feedback

Unter **Einstellungen → Logs & Diagnose** stehen App-Start und Update-Ereignisse mit lokaler Uhrzeit, Stufe (Info/Fehler) und Quelle. „Aktualisieren“ lädt den aktuellen Stand. Neueste Einträge erscheinen zuerst, die Liste scrollt innerhalb einer begrenzten Höhe. Der Menüpunkt **Info → Diagnose für Feedback** führt ebenfalls hierher.

Die App speichert höchstens 250 strukturierte Einträge in `userData/logs/diagnostics.json` und liest maximal 256 KiB. Unter Windows ist das normalerweise `%APPDATA%\ClearDeck\logs\diagnostics.json`, unter macOS `~/Library/Application Support/ClearDeck/logs/diagnostics.json`. Die Dev-App verwendet ihr eigenes Profil, das Update-Beispiel `dev-ClearDeck-updates`. Vor dieser Änderung installierte Versionen haben diese Protokollierung noch nicht; alte Versuche werden nicht rückwirkend eingelesen.

Gespeichert werden nur Zeitpunkt, App-/Update-Version, bekannte Update-Zustände, Fortschritt in 25-Prozent-Stufen und feste Fehlerkategorien. Kategorien unterscheiden unter anderem fehlende Installationsdateien, Netzwerkfehler, fehlende Ressourcen-Signaturen und unpassende Signaturidentitäten. Rohe Fehlermeldungen, URLs, Zugangsdaten, lokale Dateipfade, Mitarbeitenden- und Patientendaten werden nicht übernommen. Auch beim erneuten Lesen werden unbekannte Felder und Werte verworfen. Diese bewusste Begrenzung kann technische Einzelheiten eines unbekannten Fehlers auslassen; die Update-Anzeige behält ihre separaten Fehlerdetails.

„Diagnose kopieren“ kopiert genau die sichtbaren bereinigten Einträge. „Diagnosedatei speichern“ lädt beim Export den neuesten Stand und öffnet einen lokalen Speicherdialog. Abbrechen schreibt keine Datei. Die Person kann die Textdatei anschließend selbst an eine Nachricht über den vorhandenen Kontaktweg anhängen. Die App versendet weder Logs noch Feedback automatisch und ergänzt keine externe Integration.

Prüfung: automatisierte Tests für Persistenz, begrenzte Aufbewahrung, unterdrückte Geheimnisse, manipulierte Logdateien, Speicherfehler, Aktualisieren, Kopieren und expliziten/abgebrochenen Export. Zusätzlich wurde die Ansicht in der nativen ClearDeck Dev mit dem simulierten Download durchlaufen.
