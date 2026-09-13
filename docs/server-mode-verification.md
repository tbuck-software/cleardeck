# Prüfung des optionalen Serverbetriebs

Stand: 13.09.2026, Branch `feature/server-mode`.

## Desktopchecks

- `npx tsc --noEmit`: erfolgreich.
- `npm run lint`: erfolgreich.
- `npm test -- --run --silent`: 83 Testdateien, 530 Tests erfolgreich.

Die neuen Tests prüfen unter anderem falsche Schlüssel und Passwörter, lokale Dateitrennung, explizite Erstübertragung, Reader-Schreibschutz, Revisionskonflikte, fehlgeschlagene Konfigurationsspeicherung sowie wartende Datenaktionen beim Wechsel oder Neuladen.

## Überarbeitete Einstellungen

Die Datenablage und Update-Quelle folgen den bestehenden Formularen ohne zusätzliche Karten oder Statusuntertitel. Beim Verbinden stehen vorhandener Serverbestand und lokale Erstübertragung als getrennte Optionen am Anfang. Abbrechen löscht die eingegebenen Geheimnisse und die Bestätigung zur Schlüsselsicherung. Der Rückwechsel zum lokalen Bestand erklärt vor der Bestätigung, dass Serveränderungen nicht übernommen werden.

Für diese Überarbeitung sind TypeScript, Lint und 578 Desktoptests in 88 Dateien erfolgreich. Die Komponententests prüfen auch den direkten Formulareinstieg vom Anmeldebildschirm, das Zurücksetzen nach Abbruch, die Rückwechselbestätigung und bereinigte Fehlermeldungen beim Speichern der Update-Quelle.

## Laufender Electron-Client mit PostgreSQL

Die Serverchecks liefen zusätzlich erfolgreich: neun HTTP-/Passworttests, der separat gestartete PostgreSQL-Integrationslauf, Docker-Image-Build und Caddy-Konfigurationsprüfung. Der Integrationslauf prüft konkurrierende Schreibvorgänge, Persistenz, Rollen, Widerruf und die Sperre alter Sitzungen nach Erneuerung der Instanz-ID. `npm audit --omit=dev` im Serverpaket meldete keine bekannten Schwachstellen.

Mit dem getrennten synthetischen Demo-Profil und einem temporären lokalen PostgreSQL-16-Container geprüft:

1. Die App startet lokal. Der Server wird erst nach Eingabe und Bestätigung verbunden.
2. Der lokale Demobestand lässt sich ausdrücklich auf einen leeren Server übertragen.
3. Nach einem App-Neustart bleiben Adresse und Benutzername erhalten; Passwort und Datenschlüssel müssen erneut eingegeben werden.
4. Eine Änderung der Bezugswochenstunden von 36 auf 37 wird als neuer verschlüsselter Snapshot gespeichert. Die lokale Datenbankdatei bleibt während der Serverbearbeitung bytegleich.
5. Ein zweiter HTTP-Client schreibt mit derselben Ausgangsrevision. Ein anschließender Schreibversuch des ersten Clients wird wegen seines veralteten Bestands abgewiesen. Nach explizitem Neuladen zeigt die App den gültigen Wert 37.
6. Ein Reader-Konto kann den Bestand öffnen. Sein Schreibversuch wird abgewiesen; die Serverrevision bleibt unverändert.
7. Nach dem Rückwechsel zum lokalen Betrieb zeigt die App wieder den ursprünglichen Wert 36. Serveränderungen wurden nicht lokal übernommen.

Die temporären Testdienste wurden anschließend beendet und der Testcontainer entfernt. Für diesen Lauf wurden keine produktiven Daten oder externen Hostingkonten verwendet.

## Grenzen dieser Prüfung

Der Lauf nutzt HTTP ausschließlich auf Loopback. Öffentliche TLS-Konfiguration, Zertifikatserneuerung, vollständiger Dump/Restore und ein unabhängiger Sicherheitsreview sind dadurch nicht nachgewiesen. Die entsprechenden Schritte stehen im [Hosting- und Launch-Plan](hosting-launch-plan.md). Bestehende Hinweise der Entwicklungsumgebung zur Electron-CSP und zum blockierten Google-Fonts-Import sind dort ebenfalls berücksichtigt.
