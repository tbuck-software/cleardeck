# Hosting- und Launch-Plan

Stand: 14.09.2026. Dieser Plan beschreibt die noch offenen technischen Schritte für den selbst gehosteten Serverbetrieb. Die v2-Prüfung ist für den geprüften Client- und Serverumfang erfolgreich; die verbleibenden Betriebsnachweise stehen weiter unten.

## Ausgangslage

Die Desktop-App arbeitet lokal als Standard. Der lokale Bestand bleibt eine eigene, isolierte SQLite-Datenbank. Der optionale Serverbetrieb nutzt Protokoll 2 und Sync-Schema 23. PostgreSQL speichert lesbare Datensätze, Versionen, Tombstones und den Änderungsverlauf. Der Server speichert keinen verschlüsselten SQLite-Gesamtsnapshot und keinen gemeinsamen Datenschlüssel.

Für jede Kombination aus Serveradresse und Benutzername führt der Client eine verschlüsselte, dauerhaft gespeicherte lokale Arbeitskopie. Sie enthält SQLite, den bestätigten Serverstand und die Outbox. Ein erzeugter lokaler Schlüssel wird durch den geschützten Betriebssystemspeicher safeStorage umschlossen. SQLite und Outbox werden atomar geschrieben. Änderungen werden lokal sofort sichtbar, synchronisieren sich so schnell wie möglich und erhalten ungefähr alle drei Sekunden neue Deltas. Netzwerkzugriffe laufen außerhalb der Sperre für lokale Datenbankoperationen. Der lokale verschlüsselte Cache ist auf 128 MiB begrenzt; v2-Synchronisationsanfragen und einzelne Synchronisationsseiten sind auf 32 MiB begrenzt.

Der Server vergibt Geräte-IDs und eindeutige Bereiche für lokale numerische IDs. Transaktionen tragen idempotente UUIDs. Mehrzeilige Transaktionen verwenden einen atomaren Compare-and-Swap je Datensatz. Konflikte lassen alle wartenden Änderungen erhalten; der Benutzer entscheidet über die Serverversion oder das erneute Senden aller lokalen Änderungen. Vor dieser Entscheidung entsteht eine verschlüsselte Recovery-Kopie.

Der Server kennt die Rollen admin, editor und reader. Ein admin darf einen leeren Server initialisieren und verfügt zusätzlich über die normalen Lese- und Schreibrechte eines editor; für den normalen Schreibbetrieb laufen die persönlichen Konten vorzugsweise über editor, reader-Konten lesen. Das erste Admin-Konto wird bei der Serverbereitstellung über die Server-CLI angelegt. Eine Admin-Oberfläche, Selbstregistrierung, MFA und mandanten- oder datensatzfeine Rechte gibt es noch nicht. Ein persönliches ClearDeck-Konto dient der Anmeldung in der Desktop-App; Benutzername und Passwort werden dort eingegeben, während SQL-Zugangsdaten ausschließlich auf dem Server bleiben. Die Serveradresse ist das erste Feld im Verbindungsdialog. Ein von ClearDeck betriebener Hosted-Dienst ist nicht bereitgestellt, und es gibt keinen voreingestellten Hosted-Dienst. Ein produktiver Server ist nicht bekannt.

Die App-Administration umfasst derzeit das Anlegen, Deaktivieren und Ändern von Rolle oder Passwort sowie die einmalige Erstübertragung. Diese Kontenverwaltung läuft vollständig über die Server-CLI; es gibt weder eine grafische Benutzerverwaltung noch einen API-Endpunkt für Kontenverwaltung. Das erste Admin-Konto wird bei der Bereitstellung über die CLI angelegt. Die grafische Benutzerverwaltung ist eine nächste Produktpriorität. Der Serverbetreiber verantwortet Serverkonfiguration, automatische Sicherungen und Aufbewahrungsfristen, Restore, Updates sowie Speicher-, Fehler- und Ausfallalarme.

## Freigabestatus

Die [Bereinigung vor der Veröffentlichung](publication-cleanup.md) dokumentiert die abgeschlossene Entfernung privater Originalunterlagen, die Token-Bereinigung und die historischen Windows-Prüfungen. Die dort verlinkten Serveraufnahmen und der alte Serverprüfbericht beschreiben den v1-Snapshot-Stand vom 13.09.2026. Sie belegen die neue Row-Transaction-API nicht.

Das Repository bleibt privat. Es liegt seit dem 14.09.2026 unter `tbuck-software/cleardeck`. Es gibt in diesem Arbeitsstand keine Umbenennung des Produkts, keine öffentliche Veröffentlichung und keinen neuen Release. Die Änderung der Sichtbarkeit und ein späterer Release bleiben der letzte Schritt des Eigentümers.

## Offene Freigabegates

### Prüfgrundlagen

Vor einer Freigabe müssen Docker-Image, Compose-Datei und Caddy-Konfiguration nachvollziehbar gebaut und betrieben werden können. PostgreSQL und Caddy verwenden getrennte dauerhafte Volumes; der App-Container bleibt zustandslos. Secrets kommen ausschließlich aus dem Secret-Speicher oder aus lokalen, nicht eingecheckten Umgebungsdateien. Der interne Node-Port und der PostgreSQL-Port werden nicht öffentlich gebunden.

Health-Check, kontrolliertes Herunterfahren, Wiederanlauf mit erhaltenem Bestand, Containerrechte, Dateirechte und ein Update-Rollback gehören in den Prüfbericht. Die zugehörige Evidenz ist ein frischer Compose-Start, ein Neustart mit unverändertem Bestand und die Ausgabe der relevanten Compose-Prüfungen.

Die automatisierten Server- und Clienttests werden durch einen reproduzierbaren Integrationslauf ergänzt. Der aktuelle Lauf umfasst `npx tsc --noEmit`, `npm run lint`, 610 erfolgreiche Desktoptests in 92 Dateien, neun bestandene und zwei übersprungene Servertests, zwei von zwei Fälle gegen ein echtes PostgreSQL sowie einen erfolgreichen Docker-Image-Build. `npm run test:integration` gegen reales PostgreSQL war mit zwei von zwei Fällen erfolgreich. Geprüft wurden Protokoll-2-Login, Admin-Bootstrap eines leeren Servers, die Zurückweisung eines Nicht-Admins vor dem Datenupload durch die Desktop-App und die entsprechende API-403-Antwort, persönliche Editor- und Reader-Konten, abgelaufene Sitzung, Kontoänderung und Kontowiderruf, ungültige Zeilen, Cursor und Tombstones, Gerätebereiche, konkurrierende Transaktionen, Offline öffnen, HTTP-401 ohne automatischen Fallback und die lokale Outbox.

### 1. TLS und Transport prüfen

Für eine reale Serveradresse müssen folgende Punkte nachgewiesen werden:

- DNS zeigt auf den Reverse Proxy, und Caddy stellt ein gültiges Zertifikat aus.
- Zertifikatserneuerung, dauerhaftes Zertifikats-Volume und Proxy-Neustart funktionieren.
- Die Desktop-App verwendet ausschließlich die HTTPS-Origin ohne Pfad. HTTP bleibt auf Loopback-Tests beschränkt.
- Nur die Proxy-Ports 80 und 443 sind öffentlich erreichbar. PostgreSQL und der interne Node-Port bleiben intern.
- Ein Desktop-Login, eine Änderung und ein Delta-Abruf funktionieren hinter dem Proxy.
- Browseranfragen, falsche Origin-Header und Redirects liefern keine API-Daten.
- Alle externen Requests und Assets werden geprüft, insbesondere der Google-Fonts-@import in src/styles/design-system.css. Vor der Veröffentlichung wird er lokal vendort, entfernt oder ausdrücklich freigegeben. Die aktuelle CSP im Dev-Setup ersetzt diese Prüfung nicht.

Abnahmeevidenz: ein datierter TLS- und Proxy-Test mit Zertifikatskette, Ablaufdatum, erreichbaren Ports, Neustart und erfolgreichem Desktop-Sync.

### 2. Backup und Restore prüfen

Eine PostgreSQL-Sicherung enthält lesbare fachliche Zeilen, Tombstones, den Änderungsverlauf, Konten und technische Metadaten. Der Dump muss deshalb verschlüsselt oder auf einem zugriffsgeschützten Ziel abgelegt werden. Lokale Arbeitskopien und Recovery-Kopien liegen nicht im Serverdump. Der Client bietet für eine ausdrückliche Rückmigration nur einen direkt lesbaren unverschlüsselten .db-Export. Eine portable verschlüsselte Client-Sicherung gibt es nicht, weil der lokale Schlüssel an das Geräteprofil gebunden ist.

Der Restore-Test muss eine isolierte PostgreSQL-Instanz verwenden und diese Fälle zeigen:

- Dump erstellen und den Inhalt in einer frischen Instanz wiederherstellen.
- Vor dem Neustart Sitzungen invalidieren und eine neue Serverinstanz-ID setzen.
- Mit einem persönlichen Editor und einem Reader online anmelden; das initiale Admin-Konto kann ebenfalls lesen und schreiben, bleibt für den normalen Betrieb aber vorzugsweise dem Bootstrap und der Administration vorbehalten.
- Einen bestehenden Cursor fortsetzen, eine neue Transaktion übertragen und ein Tombstone per Delta lesen.
- Eine wiederholte Transaktions-UUID nur einmal anwenden.
- Nach dem Restore vorhandene lokale Caches sicher neu anmelden oder den geänderten Instanzstand sauber ablehnen.

Abnahmeevidenz: Dump, Restore-Protokoll und ein kurzer Clientlauf mit den genannten Fällen. Die konkrete Restore-Anleitung gehört zusätzlich in das Serverpaket.

Als nächste Betriebsarbeiten sind automatische PostgreSQL-Sicherungen mit festgelegten Aufbewahrungsfristen, ein regelmäßig wiederholter Restore-Test und Alarme für ausgefallene oder fehlerhafte Server- und Speicherprozesse einzurichten. Diese Betriebsfunktionen sind noch nicht bereitgestellt.

### 3. Unabhängige Sicherheitsprüfung

Eine unabhängige Prüfung muss den aktuellen Protokoll-2-Stand abdecken:

- Login, achtstündige Sitzung, Token-Widerruf und Rollenprüfung für admin, editor und reader bei jeder Synchronisierung,
- lesbare Serverzeilen, per-Datensatz-CAS, atomare Mehrzeilen-Transaktionen, Tombstones und idempotente UUIDs,
- Geräte-IDs und eindeutige ID-Bereiche,
- sichere lokale Cache-Datei, safeStorage-Umschließung und atomaren SQLite-/Outbox-Schreibvorgang,
- Konfliktzustand, Erhalt aller wartenden Transaktionen und Recovery-Kopie vor der Benutzerentscheidung,
- TLS, Request-Limits, Browser-Sperre, Fehlerantworten und PostgreSQL-Rechte.

Abnahmeevidenz: datierter Bericht mit Befunden, Schweregrad, Verantwortlichem und nachprüfbarer Behebung. Ein offener kritischer oder hoher Befund blockiert den Launch.

### 4. Richtlinie für Offline-Kopien und Kontowiderruf

Offline öffnen ist eine ausdrückliche Aktion mit dem Passwortnachweis der letzten erfolgreichen Online-Anmeldung. Der Server akzeptiert nach einer Kontosperre oder Rollenänderung keine weiteren Synchronisierungen. Bereits geladene lokale Daten, Outboxen und Recovery-Kopien kann er nicht remote löschen.

Vor einem Launch muss der Betreiber dafür eine verbindliche Ablaufbeschreibung festlegen und testen:

1. Konto deaktivieren oder Passwort ändern und alle Sitzungen widerrufen.
2. Verhalten einer bereits offline geöffneten Arbeitskopie und ihrer wartenden Änderungen festhalten.
3. Verhalten bei der nächsten Online-Anmeldung und beim Zurückweisen der Outbox dokumentieren.
4. Benutzerseitige Hinweise für Offline öffnen, Anmeldung erforderlich und verbleibende lokale Daten festlegen.

Abnahmeevidenz: reproduzierbarer Test mit einem Editor- und einem Reader-Konto sowie die freigegebene Ablaufbeschreibung. Eine nachträgliche Löschung der Offline-Kopie durch den Server ist kein vorhandener Mechanismus.

### Incident Response

Vor dem Launch schriftlich festlegen:

1. Wer einen Sicherheitsvorfall entgegennimmt und wer außerhalb der Arbeitszeit erreichbar ist.
2. Wie der Server vom Netz genommen, ein Konto deaktiviert und Sitzungen widerrufen werden.
3. Wie Beweise gesichert werden, ohne Datensatzinhalte, Passwörter, Sitzungstoken oder lokale Schlüssel in Logs zu kopieren.
4. Wie Betreiber, Verantwortliche, Datenschutzbeauftragte, Auftragsverarbeiter und betroffene Personen informiert werden.
5. Wie die Entscheidung zu einer Meldung, deren Frist und die getroffenen Maßnahmen dokumentiert werden.
6. Wie nach einem Kontowiderruf bereits geladene Offline-Kopien, Recovery-Kopien und wartende Änderungen behandelt werden.

Das Deaktivieren eines Serverkontos verhindert neue Anmeldungen und Synchronisierungen. Es löscht keine bereits geladenen oder exportierten Daten. Die konkrete Behandlung der verbleibenden Offline-Kopie gehört in die Richtlinie aus Gate 4.

## Datenschutz und Recht

Die folgenden Punkte müssen der Betreiber, die verantwortliche Organisation und die zuständige Datenschutz- oder Rechtsberatung anhand des konkreten Betriebs klären. Die Verweise nennen die maßgeblichen Ausgangstexte:

- Die [DSGVO, insbesondere Artikel 9, 28, 32, 33, 34 und 35](https://eur-lex.europa.eu/eli/reg/2016/679/deu), ist für Rollen, Gesundheitsdaten, technische und organisatorische Maßnahmen, Datenschutzverletzungen und eine mögliche Datenschutz-Folgenabschätzung zu prüfen.
- Wenn ein Serverbetreiber Daten im Auftrag einer Organisation verarbeitet, sind Verantwortlicher, Auftragsverarbeiter, Unterauftragsverarbeiter, Weisungen, Löschung/Rückgabe und Nachweise in einer AVV nach [Artikel 28 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/deu) zu klären. Ein externer Hostinganbieter kann zusätzlich Unterauftragsverarbeiter sein.
- Für die TOM sind Verschlüsselung, Zugriffstrennung, Schlüsselverwaltung, Verfügbarkeit, Wiederherstellung, Tests, Protokollierung, Löschfristen und der Umgang mit Exporten konkret zu beschreiben. [Artikel 32 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/deu) verlangt ein dem Risiko angemessenes Schutzniveau und regelmäßige Überprüfung.
- Patientendaten können besondere Kategorien personenbezogener Daten sein. Ob die konkrete Verarbeitung voraussichtlich ein hohes Risiko hat und eine Datenschutz-Folgenabschätzung verlangt, entscheidet die verantwortliche Stelle anhand des konkreten Umfangs und Zwecks nach [Artikel 35 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/deu).
- Für Berufsgeheimnisse im Gesundheitsbereich ist die Anwendung von [§ 203 StGB](https://www.gesetze-im-internet.de/stgb/__203.html) und die Verpflichtung mitwirkender Personen und Dienstleister konkret zu prüfen. Die technische Architektur beantwortet diese Prüfung nicht.
- Für Sicherheitsvorfälle müssen die Abläufe zu Aufsichtsbehörde und betroffenen Personen mit [Artikel 33 und 34 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/deu) abgeglichen werden. Die 72-Stunden-Regel aus Artikel 33 ist eine Frist für den jeweils Verantwortlichen, keine automatische Serverfunktion.

Vor einem produktiven Einsatz müssen mindestens Verantwortlichkeiten, Rechtsgrundlagen, Informationspflichten, Betroffenenrechte, Aufbewahrung und Löschung, Drittlandtransfers, Verzeichnis der Verarbeitungstätigkeiten, AVV, TOM, gegebenenfalls Datenschutz-Folgenabschätzung und ein Incident-Formular vorliegen.

Die konkreten Vertragsklauseln, AVV- und TOM-Vorlagen muss die verantwortliche Organisation mit ihrer Datenschutz- oder Rechtsberatung erstellen und freigeben. Dieser Plan liefert dafür Prüfpunkte, keine pauschale Vertragsvorlage und keine rechtliche Garantie.

Für das geplante kommerzielle Angebot zusätzlich den Anwendungsbereich des Cyber Resilience Act prüfen lassen. Eine MIT-Lizenz allein entscheidet nicht über die Ausnahme für nichtkommerzielles Open Source. Für erfasste Hersteller gelten Meldepflichten seit 11.09.2026, die wesentlichen weiteren Pflichten ab 11.12.2027. Ob und in welcher Rolle ClearDeck einschließlich seiner Serverkomponente erfasst ist, muss anhand des Angebots geklärt werden. [EU-Kommission zu Open Source](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source), [Anwendungsfristen](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act).

## Bekannte Produktlücken vor einem breiteren Einsatz

Diese Funktionen sind noch nicht vorhanden und müssen in der Betriebsentscheidung berücksichtigt werden:

- feingranulare Berechtigungen je Mandant, Patient oder Datensatz,
- eine grafische Benutzerverwaltung für Konten, Rollen, Passwörter und Einladungen,
- Mehrfaktor-Anmeldung,
- portable verschlüsselte Client-Sicherungen außerhalb des Geräteprofils,
- eine eigene Oberfläche zum Auffinden oder Wiederherstellen der gerätegebundenen Konflikt-Recovery-Kopien,
- ein automatisierter serverseitiger Backup- und Restore-Dienst mit Aufbewahrungsfristen und Ausfallalarmen,
- zentrale Aufbewahrungs-, Lösch- und Exportkontrollen für bereits verteilte Kopien.

Die Offline-Bearbeitung und die Konfliktentscheidungen sind im aktuellen Client vorgesehen. Die verbindliche Richtlinie für Offline-Kopien nach Kontowiderruf bleibt trotzdem ein offenes Freigabegate, weil der Server vorhandene Kopien nicht remote löschen kann.

## Validierung des Feature-Branches

Der aktuelle vollständige Desktop-Lauf umfasst 610 erfolgreiche Tests in 92 Dateien. `npx tsc --noEmit` und `npm run lint` sind erfolgreich. `npm test` im Serverpaket meldete neun bestandene und zwei übersprungene Tests; `npm run test:integration` gegen reales PostgreSQL war mit zwei von zwei Fällen erfolgreich. Der Docker-Image-Build war ebenfalls erfolgreich.

Der native Electron-Lauf mit 1.405 synthetischen Zeilen bestätigte Bootstrap mit Revision 1, die lokale Änderung von 36 auf 37 über App-Neustart und ausdrückliches `Offline öffnen`, den Reconnect mit Revision 2 sowie einen echten CAS-Konflikt zwischen Serverwert 38 und lokalem Wert 39. Die ausstehende Änderung blieb bis zur Entscheidung erhalten. Nach dem Neustart bestand die Cache-Validierung, und der Login lud weiterhin ausstehende Änderung 1 mit Wert 39. Die Auswahl der Serverversion stellte 38 wieder her, zeigte `Synchronisiert` und erzeugte zuvor eine verschlüsselte Recovery-Kopie mit Zeitstempel und UUID. Der bestätigte Rückwechsel zum lokalen Bestand zeigte wieder den ursprünglichen Wert 36.

Der zusätzliche Rollenlauf prüfte einen separaten leeren PostgreSQL-Server: Die Desktop-App wies einen Editor vor dem Datenupload ab, der API-Test bestätigte 403, und PostgreSQL blieb bei `initialized=false`, Revision 0. Mit dem initialen Admin-Konto wurden anschließend 1.405 synthetische Zeilen übertragen; der Server stand danach auf `initialized=true`, Revision 1.

Damit sind die v2-Client- und Serverläufe einschließlich Admin-Bootstrap dokumentiert. Vor einer Freigabe fehlen weiterhin die operative TLS- und Zertifikatserneuerungsprüfung, der geprüfte PostgreSQL-Dump und Restore, die unabhängige Sicherheitsprüfung sowie die verbindliche Richtlinie für Offline-Kopien nach Kontowiderruf.

Die historische Evidenz und ihre genaue Abgrenzung stehen in [Prüfung des optionalen Serverbetriebs](server-mode-verification.md). Ein bestandener v1-Snapshot-Lauf ist kein Nachweis für die neue Row-Transaction-API.

## Veröffentlichung und PR #45

### Eigenen Hosting-Service vorbereiten

Nach einem privaten Selfhost-Pilot kann ein betreuter Dienst separat geplant werden. Er ist nicht deployed. Dafür zusätzlich erledigen:

- Zunächst je Kundenorganisation einen getrennten Stack mit eigener PostgreSQL-Datenbank, Domain und eigenen Zugangsdaten provisionieren. Der aktuelle Server unterstützt genau einen Arbeitsbereich; eine Multi-DB-Provisionierungsoberfläche ist für den Start mit einer Organisation nicht erforderlich, gemeinsame Mandantenverwaltung wäre eine weitere Entwicklung.
- Einrichtung und Einladung vereinfachen: initiales Admin-Konto über die Betreiber-CLI anlegen, danach persönliche Editor- und Reader-Konten bereitstellen; den lokalen Geräteschlüssel erzeugt jedes Gerät selbst und bindet ihn an seinen geschützten Betriebssystemspeicher.
- Betrieb mit überwachten Backups, getesteter Wiederherstellung, Updates, Alarmierung und benannter Vertretung organisieren.
- Leistungsumfang, Supportzeiten, Preise, Abrechnung, Kündigung und Datenrückgabe festlegen; Vertrags- und Datenschutzunterlagen dafür prüfen lassen.
- Einen Pilotkunden erst nach den für seinen konkreten Einsatz erforderlichen technischen und rechtlichen Freigaben aufnehmen.

Eine einfache Serveradresse in der App ersetzt diese Betriebsaufgaben nicht. Die MIT-Lizenz und ein späteres kostenpflichtiges Hosting-Angebot werden getrennt verwaltet.

### Repository zuletzt veröffentlichen

Vor dem öffentlichen Start müssen die vier Freigabegates oben, die aktuelle v2-Testevidenz und der Abgleich von Desktop- und Serverdokumentation vorliegen. Zusätzlich sind folgende Prüfungen abzuhaken:

- MIT-Lizenz, Copyright-Inhaber und Lizenzfelder in package.json und App-Info prüfen.
- Quellcode, Git-Historie, Artefakte, .env-Dateien, CI-Logs und Testdaten auf Passwörter, Tokens, lokale Schlüssel und Patientendaten prüfen.
- Lizenz- und Notice-Prüfung für npm-Abhängigkeiten, Serverabhängigkeiten, Container-Images und mitgelieferte Dateien durchführen.
- Reproduzierbaren Build, Lint, Tests, Integrationslauf, TLS-Test, externen Security-Review und Restore-Test dokumentieren.
- Die Server- und Datenschutzdokumentation mit dem tatsächlich ausgelieferten Compose-/Caddy-Setup abgleichen.
- Einen Ansprechpartner, eine Sicherheitskontaktadresse und den Incident-Ablauf im privaten Betriebsplan festhalten.

Die Reihenfolge danach ist fest:

1. Die aktuellen Test- und Restore-Ergebnisse werden eingetragen.
2. Die Dokumentation wird gegen das tatsächlich ausgelieferte Protokoll-2- und Compose-Setup geprüft.
3. Der Eigentümer entscheidet über einen Release und eine mögliche Umbenennung des Produkts.
4. Der Eigentümer veröffentlicht das Repository zuletzt selbst.

Es gibt keinen automatischen Schritt, der einen Hosted-Dienst bereitstellt, das Repository umbenennt, es öffentlich schaltet oder einen Release veröffentlicht.
