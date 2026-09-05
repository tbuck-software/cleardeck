# Updates herunterladen und installieren

Die App prüft beim Start, stündlich und beim Aktivieren des Fensters auf Updates. Sie lädt ein gefundenes Update erst nach einem Klick auf „Update herunterladen“. Die Anzeige zeigt Prozent und eine geschätzte Restzeit. Bei unbekannter Geschwindigkeit wird keine Restzeit erfunden.

Nach dem Download startet „Update installieren und neu starten“ die Installation. Die App zeigt währenddessen „Neustart wird vorbereitet“. Ein erneuter Klick löst keine zweite Installation aus. Fensterwechsel überschreiben weder einen laufenden Download noch eine bereitliegende Installation oder deren Fehler. Fehler bleiben mit kopierbaren Details und einem Knopf zum Wiederholen des fehlgeschlagenen Schritts sichtbar. Sidebar, Einstellungen und Anmeldebildschirm verwenden dieselbe Anzeige.

## Änderungen seit der installierten Version

`CHANGELOG.md` enthält pro Release einen Abschnitt `## [1.8.0]`. `make release-patch`, `make release-minor` und `make release-major` übernehmen die Einträge aus `[Unreleased]` automatisch in den Abschnitt der neuen Paketversion und committen den Changelog mit. Bei manueller Versionierung erledigt `node scripts/release-notes.js --prepare` denselben Schritt. Die historischen Einträge wurden aus den Commit-Bereichen zwischen den Release-Tags rekonstruiert und auf Deutsch zusammengefasst.

Der Manifest-Generator schreibt die gesamte veröffentlichte Historie bis einschließlich der Paketversion als `releaseNotes`-Array in die Update-Metadaten. Der Client filtert semantisch auf `installierte Version < Eintrag <= angebotene Version` und sortiert neueste Versionen zuerst. Dadurch enthält die Anzeige auch die Änderungen übersprungener Zwischenversionen. Unveröffentlichte Änderungen und bereits installierte Versionen erscheinen nicht. Ältere Feeds mit einem einfachen Text bleiben lesbar; fehlende Notizen werden ausdrücklich angezeigt.

Der GitHub-Release-Text verwendet aus derselben Datei nur die Notizen der veröffentlichten Version. Es sind keine zusätzlichen GitHub-Aufrufe aus dem Renderer nötig. Die Notizen werden als Text dargestellt, nicht als ausführbares HTML. Hover, Tastaturfokus und der Infoknopf öffnen die scrollbar begrenzte Liste; Escape schließt sie.

## Grenzen der Prüfung

Die Regressionstests prüfen die Ereignisse des Updaters, die explizite Download-/Installationsfolge, doppelte Klicks, Fehler und Wiederholungen, Restzeitberechnung und die kumulative Versionsauswahl. Die Anzeige wurde zusätzlich in einer Browser-Vorschau mit simulierten Zuständen bedient. Das ersetzt keinen nativen Installationstest für jede Betriebssystemversion.

Auf dem lokalen Mac wurde bei `/Applications/ClearDeck.app`, Version 1.7.2, mit `codesign --verify --deep --strict` ein Signaturfehler festgestellt: `code has no resources but signature indicates they must be present`. Die installierte App wurde nicht verändert. Ohne Bestätigung des betroffenen Rechners und dessen nativen Installationsfehlers ist das noch kein Nachweis für die gemeldete Ursache. Die Windows-Metadatenreparatur und der frühere Installer-Test sind in `windows-update-repair.md` dokumentiert.
