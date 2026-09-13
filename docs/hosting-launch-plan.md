# Hosting- und Launch-Plan

Stand: 13.09.2026. Dieses Dokument beschreibt die Freigabegates für den selbst gehosteten Serverbetrieb. Es ist ein Arbeitsplan, keine Zertifizierung und keine Rechtsberatung.

## Ausgangslage

Die Desktop-App arbeitet lokal unverändert als Standard. Der optionale Servermodus nutzt pro Installation einen gemeinsamen, verschlüsselten SQLite-Snapshot bis 32 MiB. PostgreSQL enthält den Snapshot als undurchsichtige Nutzlast sowie Konten-, Sitzungs- und Änderungsmetadaten. Die Clients halten den 32-Byte-Datenschlüssel und geben ihn bei jeder Anmeldung ein. Der Server erhält den Schlüssel nicht.

Es gibt keinen von ClearDeck betriebenen Hosted-Dienst. Ein Betreiber verantwortet seine eigene VM oder seinen eigenen Container-Stack, seine TLS-Konfiguration, Konten, Backups, Logs und Datenschutzunterlagen.

## Freigabestatus

Der Servermodus darf als technische Vorschau in einem kontrollierten, privaten Setup getestet werden. Ein öffentlich erreichbarer oder produktiver Betrieb wartet auf die Gates unten. Das Repository bleibt bis zum Abschluss der Prüfungen privat.

## Technische Gates

### 1. Reproduzierbares Serverpaket

Vor der Freigabe müssen Docker-Image, Compose-Datei und Caddy-Konfiguration nachvollziehbar gebaut und betrieben werden können.

- Base-Images und Node-Abhängigkeiten auf konkrete, überprüfte Versionen festlegen.
- PostgreSQL und Caddy mit getrennten, dauerhaften Volumes betreiben; der App-Container bleibt zustandslos.
- Secrets ausschließlich über Secret-Management oder lokale, nicht eingecheckte Umgebungsdateien zuführen.
- Der interne Node-Port und PostgreSQL-Port dürfen nicht öffentlich gebunden sein.
- Health-Check, kontrolliertes Herunterfahren und Wiederanlauf mit erhaltenem Volume prüfen.
- Containerrechte, Dateirechte und Update-Rollback dokumentieren.

Abnahmeevidenz: ein frischer Compose-Start, ein Neustart mit unverändertem Bestand und die Ausgabe der relevanten `docker compose`-Prüfungen.

### 2. TLS und Transport

- Caddy mit gültigem Zertifikat, automatischer Erneuerung und dauerhaftem Zertifikats-Volume testen.
- Nur die HTTPS-Origin ohne Pfad in der App verwenden.
- HTTP nur für Loopback-Tests zulassen. Öffentliche HTTP-Anfragen müssen auf HTTPS umgeleitet oder abgewiesen werden.
- Alle externen Requests und Assets prüfen, insbesondere den Google-Fonts-`@import` in `src/styles/design-system.css`. Vor der Veröffentlichung lokal vendoren, entfernen oder die Datenschutzfreigabe dokumentieren. Die aktuelle CSP im Dev-Setup ersetzt diese Prüfung nicht.
- PostgreSQL auf demselben Host halten oder seine Verbindung zusätzlich mit TLS und Netzwerkregeln schützen.
- Zertifikatsablauf, DNS-Ausfall, Proxy-Neustart und fehlerhafte Upstreams in einem Testlauf prüfen.
- Browserzugriff, unerwartete `Origin`-Header und Redirects dürfen keine Daten ausliefern.

Abnahmeevidenz: TLS- und Proxy-Testbericht mit Zertifikatskette, Ablaufdatum, erreichbaren Ports und einem erfolgreichen Desktop-Login.

### 3. Externe Sicherheitsprüfung

Vor einem öffentlichen Launch ist eine unabhängige Prüfung erforderlich. Sie muss mindestens abdecken:

- Threat Model für Snapshot-Verlust, Schlüsselverlust, kompromittierte Konten und kompromittierte Clients,
- Passwort-Hashing, Sitzungsablauf nach acht Stunden, Token-Widerruf und Rollenprüfung,
- TLS, Header, CORS/Browser-Sperre, Redirects, Request-Limits, Rate-Limits und Fehlermeldungen,
- Snapshot-Verschlüsselung, Authentizität, Schlüssel-Fingerabdruck, 32-MiB-Grenze und Speicherfehler,
- Revisions- und Instanzprüfung bei konkurrierenden Geräten,
- PostgreSQL-Rechte, Logs, Backups, Wiederherstellung und Datenlöschung,
- npm- und Container-Abhängigkeiten sowie den Build- und Updateweg.

Befunde erhalten einen Schweregrad, eine verantwortliche Person und eine nachprüfbare Behebung. Ein offener kritischer oder hoher Befund blockiert den Launch. Eine Verschlüsselung allein ist kein Nachweis, dass das Gesamtsystem sicher oder rechtskonform ist.

### 4. Tests und Fehlerfälle

Die automatisierten Server- und Clienttests müssen durch einen reproduzierbaren Integrationslauf ergänzt werden. Der Lauf deckt mindestens ab:

- Erststart mit leerem PostgreSQL und Anlegen eines Editor-Kontos,
- Editor- und Reader-Login, abgelaufene Sitzung, Kontoänderung und Kontoentzug,
- falsche Passwörter, leere oder beschädigte Snapshots und ungültige Request-Köpfe,
- Reader-Schreibversuch, fehlende Revision, falsche Instanz-ID und 32-MiB-Grenze,
- Initialübertragung nur auf einen leeren Server, Abbruch bei nichtleerem Server und falschem Datenschlüssel,
- zwei Geräte mit konkurrierenden Schreibvorgängen und explizites Neuladen,
- Serverausfall ohne automatischen lokalen Fallback,
- App-Neustart mit erneut erforderlichem Datenschlüssel,
- PostgreSQL-Dump, Wiederherstellung und anschließendes Lesen und Schreiben.

Abnahmeevidenz: CI-Artefakte, Testprotokoll der Multi-Geräte-Szenarien und ein gespeicherter Restore-Test.

### 5. Backup, Schlüssel und Restore

- Für jede produktive Instanz einen Aufbewahrungsplan für verschlüsselte `pg_dump`-Dateien festlegen.
- Dumps zusätzlich verschlüsseln oder auf einem verschlüsselten, zugriffsgeschützten Ziel ablegen und mindestens eine Kopie räumlich getrennt halten.
- Den 32-Byte-Datenschlüssel getrennt von PostgreSQL, Dumps, Serverpasswort und Caddy-Host aufbewahren.
- Regelmäßig einen Restore in einer isolierten Umgebung durchführen und dokumentieren.
- Nach einem Restore vor dem App-Neustart alle Sitzungen löschen und die Instanz-ID erneuern. Danach Revision, Konten, Rollen und einen Test-Export prüfen.
- Caddy-Zertifikatsdaten und Compose-/Secret-Dokumentation in den Wiederanlauf einbeziehen.
- Aufbewahrung und Löschung von Dumps, Exportdateien und Logs festlegen. Retention muss mit fachlichen und gesetzlichen Pflichten abgestimmt werden.

Der Server kann den Datenschlüssel nicht wiederherstellen. Ein erfolgreicher PostgreSQL-Restore ohne den getrennten Schlüssel stellt nur verschlüsselte Bytes wieder her.

### 6. Incident Response

Vor dem Launch schriftlich festlegen:

1. Wer einen Sicherheitsvorfall entgegennimmt und wer außerhalb der Arbeitszeit erreichbar ist.
2. Wie der Server vom Netz genommen, ein Konto deaktiviert und Sitzungen widerrufen werden.
3. Wie Beweise gesichert werden, ohne Snapshot-Inhalte, Passwörter oder Datenschlüssel in Logs zu kopieren.
4. Wie Betreiber, Verantwortliche, Datenschutzbeauftragte, Auftragsverarbeiter und betroffene Personen informiert werden.
5. Wie die Entscheidung zu einer Meldung, deren Frist und die getroffenen Maßnahmen dokumentiert werden.
6. Wie nach einem Schlüsselverlust eine vollständige Schlüsselrotation technisch durchgeführt wird.

Das Deaktivieren eines Serverkontos verhindert neue Anmeldungen. Es löscht keine bereits geladenen oder exportierten Daten und macht einen bekannten Datenschlüssel nicht ungültig. Bis eine Schlüsselrotation verfügbar ist, muss ein bekannt gewordener Datenschlüssel als kompromittiert behandelt werden.

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

Diese Funktionen sind noch nicht vorhanden und müssen als bewusste Einschränkung in die Betriebsentscheidung:

- feingranulare Berechtigungen je Patient,
- Offline-Bearbeitung mit Konfliktzusammenführung,
- Mehrfaktor-Anmeldung,
- serverseitige Rotation des gemeinsamen Datenschlüssels,
- ein automatisierter serverseitiger Backup- und Restore-Dienst,
- zentrale Aufbewahrungs-, Lösch- und Exportkontrollen für bereits verteilte Kopien.

## Veröffentlichung und privater Draft-PR

### Eigenen Hosting-Service vorbereiten

Nach dem privaten Selfhost-Pilot kann derselbe Server als betreuter Dienst angeboten werden. Dafür zusätzlich erledigen:

- Zunächst je Kundenorganisation einen getrennten Stack mit eigener Datenbank, Domain und eigenen Zugangsdaten provisionieren. Der aktuelle Server unterstützt genau einen Arbeitsbereich; gemeinsame Mandantenverwaltung wäre eine weitere Entwicklung.
- Einrichtung und Einladung vereinfachen: Serveradresse und persönliches Konto bereitstellen; den Datenschlüssel weiterhin getrennt durch die Organisation erzeugen und verteilen lassen.
- Betrieb mit überwachten Backups, getesteter Wiederherstellung, Updates, Alarmierung und benannter Vertretung organisieren.
- Leistungsumfang, Supportzeiten, Preise, Abrechnung, Kündigung und Datenrückgabe festlegen; Vertrags- und Datenschutzunterlagen dafür prüfen lassen.
- Einen Pilotkunden erst nach den für seinen konkreten Einsatz erforderlichen technischen und rechtlichen Freigaben aufnehmen.

Eine einfache Serveradresse in der App ersetzt diese Betriebsaufgaben nicht. Die MIT-Lizenz und ein späteres kostenpflichtiges Hosting-Angebot werden getrennt verwaltet.

### Repository zuletzt veröffentlichen

Der Draft-PR bleibt im privaten Repository. Vor der Veröffentlichung des Repositorys sind folgende Prüfungen abzuhaken:

- MIT-Lizenz, Copyright-Inhaber und Lizenzfelder in `package.json` und App-Info prüfen.
- Quellcode, Git-Historie, Artefakte, `.env`-Dateien, CI-Logs und Testdaten auf Passwörter, Tokens, Datenschlüssel und Patientendaten prüfen.
- Lizenz- und Notice-Prüfung für npm-Abhängigkeiten, Serverabhängigkeiten, Container-Images und mitgelieferte Dateien durchführen.
- Reproduzierbaren Build, Lint, Tests, Integrationslauf, TLS-Test, externen Security-Review und Restore-Test dokumentieren.
- Die Server- und Datenschutzdokumentation mit dem tatsächlich ausgelieferten Compose-/Caddy-Setup abgleichen.
- Einen Ansprechpartner, eine Sicherheitskontaktadresse und den Incident-Ablauf im privaten Betriebsplan festhalten.

Erst wenn diese Nachweise vorliegen, stellt Torben das Repository selbst öffentlich. Die Änderung der Sichtbarkeit bleibt ausschließlich bei ihm. Das ist der letzte Schritt und kein automatischer Teil eines Releases oder dieses Draft-PRs.
