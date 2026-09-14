# Prüfung des optionalen Serverbetriebs

Stand: 14.09.2026, Branch feature/server-mode. Diese Seite trennt die Prüfung des neuen Protokoll-2-Standes von der historischen Evidenz des vorherigen v1-Snapshot-Servers.

## Aktueller Prüfstatus

Der aktuelle vollständige v2-Lauf ist für den geprüften Client- und Serverumfang bestanden. Er umfasst 610 erfolgreiche Desktoptests in 92 Dateien; `npx tsc --noEmit` und `npm run lint` sind erfolgreich. `npm test` im Serverpaket meldete neun bestandene und zwei übersprungene Tests; `npm run test:integration` gegen reales PostgreSQL war mit zwei von zwei Fällen erfolgreich. Der Docker-Image-Build war ebenfalls erfolgreich.

Der native Electron-Lauf mit 1.405 synthetischen Zeilen bestätigte Bootstrap mit Revision 1, die lokale Änderung von 36 auf 37 über App-Neustart und ausdrückliches `Offline öffnen`, den Reconnect mit Revision 2 sowie einen echten CAS-Konflikt zwischen Serverwert 38 und lokalem Wert 39. Die ausstehende Änderung blieb bis zur Entscheidung erhalten. Nach dem Neustart bestand die Cache-Validierung; der Login lud weiterhin ausstehende Änderung 1 mit Wert 39. Die Auswahl der Serverversion stellte 38 wieder her, zeigte `Synchronisiert` und erzeugte zuvor eine verschlüsselte Recovery-Kopie mit Zeitstempel und UUID. Der bestätigte Rückwechsel zum lokalen Bestand zeigte wieder den ursprünglichen Wert 36.

Der Admin-Bootstrap wurde zusätzlich gegen einen separaten leeren PostgreSQL-Server geprüft. Die Desktop-App wies einen Editor vor dem Datenupload mit der Admin-Anforderung ab; der separate API-Test bestätigte die entsprechende 403-Antwort. PostgreSQL blieb bei `initialized=false`, Revision 0. Mit dem initialen Admin-Konto übertrug die App anschließend 1.405 synthetische Zeilen erfolgreich; der Server stand danach auf `initialized=true`, Revision 1. Das Admin-Konto behält dabei die normalen Editor- und Reader-Rechte. Die anschließende Nutzung kann mit persönlichen Editor- und Reader-Konten erfolgen.

## Abgedeckte Fälle im v2-Lauf

Der aktuelle Lauf deckte mindestens diese Fälle ab:

- Schema 23 und Protokoll-2-Login mit Geräte-ID und eindeutigem Geräteslot,
- leeren Server erkennen, Admin-Bootstrap ausdrücklich übertragen und Nicht-Admins vor dem Datenupload abweisen,
- lesbare Datensätze, Deltas, Cursor und Tombstones synchronisieren,
- lokale SQLite-Arbeitskopie und Outbox für Serveradresse und Benutzername verschlüsselt und atomar speichern,
- lokale Änderungen sofort anzeigen, bei Netzwerkfehlern erhalten und ohne Datenbank-Sperre synchronisieren,
- Admin-, Editor- und Reader-Rechte bei jeder Synchronisierung prüfen,
- Offline öffnen nur nach ausdrücklicher Aktion mit dem Passwortnachweis der letzten Online-Anmeldung,
- per-Datensatz-CAS, atomare Mehrzeilen-Transaktionen, idempotente UUIDs und eindeutige Geräte-ID-Bereiche,
- Konflikte mit Erhalt aller wartenden Änderungen, Recovery-Kopie vor der Entscheidung und den beiden aktuellen UI-Aktionen prüfen,
- einen alten v1-Server ohne Überschreiben ablehnen,
- HTTP-401 ohne automatischen Offline-Fallback behandeln.

Die anschließende Anmeldung mit persönlichen Editor- und Reader-Konten wurde nach dem Admin-Bootstrap verwendet; ein Admin kann zusätzlich wie ein Editor lesen und schreiben.

## Geprüfte aktuelle UI

Die überarbeiteten Verbindungen stehen unter Einstellungen → Verbindungen. Ein einzelner Status-Tag zeigt den Synchronisierungszustand; Offline, Konflikt, abgelaufene Anmeldung und Fehler erscheinen zusätzlich als Hinweis. Die Aktion, die der Zustand verlangt, steht jeweils zuerst:

- Lokal: Serverbestand öffnen…, Lokalen Bestand auf Server übertragen…
- Verbunden: Jetzt synchronisieren (offline und bei Fehlern: Erneut versuchen), Anmeldung ändern…
- Konflikt: Serverversion übernehmen…, für editor und admin zusätzlich Lokale Änderungen erneut senden…
- Anmeldung abgelaufen: Erneut anmelden…, bei wartenden Änderungen zusätzlich Serverversion übernehmen…
- Immer: Zum lokalen Bestand wechseln… mit Hinweis auf wartende Änderungen

Der Verbindungsdialog fragt Serveradresse, Benutzername und Passwort in einem Schritt ab und prüft die Adresse vor dem Serverkontakt. Ein Datenschlüssel wird nicht abgefragt. Der Sperrbildschirm im Serverbetrieb nennt Server und wartende Änderungen, fragt nur Benutzername und Passwort ab und bietet darunter Offline öffnen (nur für das gemerkte Konto), Anderer Server… und Zum lokalen Bestand wechseln. Die lokale Bestandsübertragung weist auf das erforderliche Admin-Konto hin; ein Nicht-Admin darf vor dem Datenupload nicht initialisieren.

## Historische Evidenz des v1-Snapshot-Servers

Die folgenden Ergebnisse stammen aus Läufen vom 13.09.2026 vor der Umstellung auf Protokoll 2. Sie prüften einen verschlüsselten SQLite-Gesamtsnapshot mit gemeinsamem Datenschlüssel. Sie bleiben als historische Nachweise erhalten und gelten nicht als Validierung der neuen Row-Transaction-API.

### Historische Desktopchecks vom 13.09.2026

- npx tsc --noEmit war erfolgreich.
- npm run lint war erfolgreich.
- npm test -- --run --silent meldete 83 Testdateien und 530 erfolgreiche Tests.

Die damaligen Tests prüften unter anderem falsche Schlüssel und Passwörter, lokale Dateitrennung, ausdrückliche Erstübertragung, Reader-Schreibschutz, Revisionskonflikte, fehlgeschlagene Konfigurationsspeicherung sowie wartende Datenaktionen beim Wechsel oder Neuladen.

Für die damalige Überarbeitung der Einstellungsoberfläche waren TypeScript, Lint und 578 Desktoptests in 88 Dateien erfolgreich. Die Komponententests prüften den direkten Formulareinstieg vom Anmeldebildschirm, das Zurücksetzen nach Abbruch, die Rückwechselbestätigung und Fehlermeldungen beim Speichern der Update-Quelle. Auch diese Zahlen gehören zum v1-Snapshot-Stand.

### Historische Serverchecks vom 13.09.2026

Neun HTTP- und Passworttests, der separat gestartete PostgreSQL-Integrationslauf, der Docker-Image-Build und die Caddy-Konfigurationsprüfung waren damals erfolgreich. Der damalige Integrationslauf prüfte konkurrierende Snapshot-Schreibvorgänge, Persistenz, Rollen, Widerruf und die Sperre alter Sitzungen nach Erneuerung der Instanz-ID. npm audit --omit=dev im damaligen Serverpaket meldete keine bekannten Schwachstellen.

### Historischer Electron-Lauf vom 13.09.2026

Der Lauf nutzte ein getrenntes Demo-Profil mit synthetischen Daten und einen temporären lokalen PostgreSQL-16-Container. Er prüfte:

1. Die App startet lokal und verbindet den Server erst nach Eingabe und Bestätigung.
2. Der lokale Demobestand lässt sich ausdrücklich auf einen leeren Server übertragen.
3. Nach einem App-Neustart bleiben Adresse und Benutzername erhalten; Passwort und gemeinsamer Datenschlüssel müssen erneut eingegeben werden.
4. Eine Änderung der Bezugswochenstunden von 36 auf 37 wird als neuer verschlüsselter Snapshot gespeichert. Die lokale Datenbankdatei bleibt während der Serverbearbeitung bytegleich.
5. Ein zweiter HTTP-Client schreibt mit derselben Ausgangsrevision. Der anschließende Schreibversuch des ersten Clients wird wegen seines veralteten Snapshots abgewiesen. Nach explizitem Neuladen zeigt die App den gültigen Wert 37.
6. Ein Reader-Konto kann den Bestand öffnen. Sein Schreibversuch wird abgewiesen; die Serverrevision bleibt unverändert.
7. Nach dem Rückwechsel zum lokalen Betrieb zeigt die App wieder den ursprünglichen Wert 36. Serveränderungen wurden nicht lokal übernommen.

Die temporären Testdienste wurden danach beendet und der Testcontainer entfernt. Für diesen historischen Lauf wurden keine produktiven Daten oder externen Hostingkonten verwendet.

## Noch offene Nachweise

Die operative TLS- und Zertifikatserneuerungsprüfung, PostgreSQL-Dump und Restore, die unabhängige Sicherheitsprüfung sowie die Richtlinie für Offline-Kopien nach Kontowiderruf sind noch nicht abgenommen. Der [Hosting- und Launch-Plan](hosting-launch-plan.md) führt diese Schritte.
