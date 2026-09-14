# Serverbetrieb

Stand: 14.09.2026. Der Serverbetrieb ist ein optionaler, selbst gehosteter Betriebsweg. Der lokale Betrieb bleibt die Voreinstellung und bleibt vom Serverbestand getrennt.

## Architektur des aktuellen Betriebs

Der aktuelle Serverbetrieb verwendet Protokoll 2 und das gemeinsame Sync-Schema 23. Die API nutzt dafür die Routen v2/login, v2/changes und v2/transactions; v2/session beendet eine Sitzung. PostgreSQL speichert fachliche Datensätze als lesbare Zeilen. Dazu kommen ein Änderungsverlauf, Konten, Sitzungen, Gerätezuordnungen und Quittungen für wiederholte Transaktionen. Löschungen werden als Tombstones im Änderungsverlauf weitergegeben.

Der Server erhält keinen verschlüsselten SQLite-Gesamtsnapshot und keinen gemeinsamen Datenschlüssel. Die Server-API liest die Datensätze, damit sie einzelne Änderungen prüfen und Deltas liefern kann. Eine Transaktion kann mehrere Zeilen enthalten. Der Server prüft die erwarteten Versionen aller betroffenen Datensätze atomar. Eine Änderung mit einer veralteten Version wird vollständig abgewiesen.

Jedes Gerät meldet sich mit einer Geräte-ID an. Der Server vergibt dafür einen eindeutigen Geräteslot. Der Client reserviert daraus einen eigenen Bereich für lokale numerische IDs, damit neue Datensätze auf mehreren Geräten nicht dieselben IDs erhalten. Jede Transaktion trägt eine UUID. Wiederholte Übertragungen derselben UUID sind idempotent.

Die Desktop-App hält für jede Kombination aus normalisierter Serveradresse und Benutzername eine eigene lokale Arbeitskopie. Der verschlüsselte, dauerhaft gespeicherte Cache enthält:

- die lokale SQLite-Datenbank,
- den zuletzt bestätigten Serverstand mit Cursor,
- die noch nicht bestätigten Transaktionen in der Outbox,
- die bekannte Rolle und den Zustand der Synchronisierung.

SQLite-Datenbank und Outbox werden in einem atomaren, authentifizierten Schreibvorgang gespeichert. Die App erzeugt den lokalen Schlüssel selbst. Der geschützte Betriebssystemspeicher (safeStorage) umschließt diesen Schlüssel. Ein gemeinsames dataKey oder ein manuelles Schlüsselfeld gibt es nicht. Das Passwort des ClearDeck-Kontos und das Sitzungstoken werden nicht gespeichert.

Eine erfolgreiche Online-Anmeldung legt zusätzlich einen gesalzenen Passwortnachweis in der verschlüsselten Arbeitskopie ab. Offline öffnen nutzt diesen Nachweis ausdrücklich und prüft damit das Passwort der letzten erfolgreichen Online-Anmeldung. Die App weicht nach einem HTTP-401-Fehler nicht automatisch auf die Offline-Kopie aus.

Der lokale verschlüsselte Cache ist auf 128 MiB begrenzt. Die v2-Synchronisationsanfragen und die einzelnen serverseitigen Synchronisationsseiten sind auf 32 MiB begrenzt.

## Server einrichten

Die App verbindet sich mit der ClearDeck-API. Ein persönliches ClearDeck-Konto dient der Anmeldung in der Desktop-App; Benutzername und Passwort werden im Verbindungsdialog eingegeben. SQL-Zugangsdaten gehören ausschließlich auf den Server und werden nie in der App eingegeben. PostgreSQL ist der derzeit unterstützte externe Speicher. Ein Firebase-Adapter ist nicht implementiert. Ein gewöhnliches Webhosting-Paket mit Datenbankzugang reicht für diesen Stack nicht aus. Einen voreingestellten Hosted-Dienst gibt es nicht.

### Voraussetzungen

Für einen dauerhaften Betrieb werden benötigt:

- ein Rechner oder eine VM mit Docker Engine und Docker Compose Plugin,
- PostgreSQL mit dauerhaftem Volume,
- ein DNS-Name für die Serveradresse,
- ein Reverse Proxy mit TLS, im vorgesehenen Setup Caddy,
- ein geschütztes Ziel für PostgreSQL-Sicherungen.

Die Compose-Datei server/docker-compose.yml und die Caddy-Konfiguration server/Caddyfile gehören zum Serverpaket. Die dort dokumentierten Service-Namen app, db und caddy sowie die Variablen aus server/.env.example sind maßgeblich. Zugangsdaten gehören in eine lokale .env-Datei oder in den Secret-Speicher des Betriebs. Sie dürfen nicht in Git eingecheckt werden.

### Start mit Docker Compose

Im Serververzeichnis starten:

    cd server
    cp .env.example .env
    # POSTGRES_PASSWORD, DATABASE_URL und SERVER_DOMAIN in .env setzen
    docker compose up -d --build
    docker compose ps

Der Server legt die benötigten Tabellen beim ersten Start an. Prüfen, ob die Adresse erreichbar ist:

    curl --fail https://cleardeck.example.de/health

Die Antwort muss ein JSON mit ok: true enthalten. Der Node-Port ist nur im privaten Compose-Netz erreichbar. Von außen wird nur die HTTPS-Adresse des Reverse Proxys verwendet.

### Caddy und TLS

Caddy nimmt Anfragen für den DNS-Namen an und leitet sie an den internen ClearDeck-Port weiter. Die öffentliche Adresse muss genau die Origin ohne Pfad sein, zum Beispiel https://cleardeck.example.de. In der App gehören keine Zugangsdaten, Query-Parameter oder zusätzlichen Pfade in das Feld Serveradresse.

Für eine öffentliche Adresse gilt:

1. DNS zeigt auf den Reverse Proxy.
2. Caddy kann die Zertifikatsvalidierung erreichen und sein Zertifikats-Volume dauerhaft speichern.
3. Die Firewall lässt für den Proxy nur die notwendigen Ports 80 und 443 zu. PostgreSQL und der interne Node-Port sind aus dem Internet nicht erreichbar.
4. Zertifikatserneuerung, Proxy-Neustart und ein fehlerhafter Upstream werden in einem Testlauf geprüft.

Die Desktop-App akzeptiert nur HTTPS. Unverschlüsseltes HTTP ist ausschließlich für localhost, 127.0.0.1 oder ::1 erlaubt, etwa für einen Test auf demselben Gerät. Browserzugriff auf die API ist nicht vorgesehen.

### Konten anlegen

Der Account-Befehl liest das Passwort aus stdin, speichert nur einen Hash und widerruft beim Setzen eines Kontos dessen bisherige Sitzungen. Es gibt die Rollen admin, editor und reader. Das erste Admin-Konto wird bei der Serverbereitstellung über die Server-CLI angelegt; eine Selbstregistrierung und eine Admin-Oberfläche gibt es nicht. Ein Admin darf einen leeren Protokoll-2-Server initialisieren und besitzt zusätzlich die normalen Lese- und Schreibrechte eines Editors. Für den normalen Betrieb werden anschließend persönliche editor- und reader-Konten angelegt.

Nach dem Compose-Start die folgenden Eingaben in Bash ausführen:

    cd server
    read -r -s -p 'Initiales Admin-Passwort: ' CLEARDECK_BOOTSTRAP_PASSWORD; printf '\n'
    printf '%s\n' "$CLEARDECK_BOOTSTRAP_PASSWORD" | \
      docker compose exec -T app npm run account -- set bootstrap-admin admin
    unset CLEARDECK_BOOTSTRAP_PASSWORD
    read -r -s -p 'Editor-Passwort: ' CLEARDECK_EDITOR_PASSWORD; printf '\n'
    printf '%s\n' "$CLEARDECK_EDITOR_PASSWORD" | \
      docker compose exec -T app npm run account -- set team-editor editor
    unset CLEARDECK_EDITOR_PASSWORD

Das Passwort muss 14 bis 256 Zeichen lang sein. Für ein Lesekonto reader statt editor angeben. Ein Konto deaktivieren:

    docker compose exec -T app npm run account -- disable team-reader

Das Deaktivieren löscht die Sitzungen des Kontos. Bereits heruntergeladene lokale Arbeitskopien und Recovery-Kopien bleiben auf den Geräten bestehen. Die Synchronisierung dieses Kontos wird beim nächsten Serverzugriff abgewiesen.

## Mit der Desktop-App verbinden

Der Verbindungsdialog fragt `Serveradresse`, `Benutzername` und `Passwort` ab. Die Adresse wird auf den Ursprung gekürzt; entfernte Server brauchen HTTPS. Der Sperrbildschirm zeigt die gemerkte Adresse und das Konto und bietet `Offline öffnen`, `Anderer Server…` und `Zum lokalen Bestand wechseln`. Die Zugangsdaten gehören zum persönlichen ClearDeck-Konto, nicht zum PostgreSQL-Betrieb.

### Einen lokalen Bestand übertragen

Die Übertragung ist ein bewusster Schritt und funktioniert nur von einem geöffneten lokalen Bestand auf einen leeren Protokoll-2-Server. Der Verbindungsdialog verlangt dafür ein Admin-Konto; die App weist vor dem Upload darauf hin. Nach der Erstinitialisierung werden die persönlichen editor- und reader-Konten für den normalen Betrieb verwendet:

1. Den lokalen Bestand anmelden und unter Einstellungen → Verbindungen Lokalen Bestand auf Server übertragen… wählen.
2. Im Dialog Lokalen Bestand übertragen öffnen.
3. Serveradresse, Benutzername und Passwort des initialen Admin-Kontos eingeben.
4. Übertragen und verbinden wählen.

Der Server darf noch keine initialisierten Datensätze enthalten. Ein nichtleerer oder alter Server wird nicht überschrieben. Die lokale Kopie bleibt auf dem Gerät erhalten. Die Übertragung erzeugt keine Zusammenführung zweier Bestände. Der erste Outbox-Eintrag enthält den lokalen Bestand als einzelne Datensatzänderungen. Ein editor- oder reader-Konto kann diesen Bootstrap-Schritt nicht ausführen.

### Einen vorhandenen Serverbestand öffnen

Auf jedem Gerät dieselbe ClearDeck-Version oder eine kompatible Version installieren. Unter Einstellungen → Verbindungen → Serverbestand öffnen… oder über Vorhandenen Server verwenden auf dem Sperrbildschirm die Serveradresse und das zugewiesene Konto eingeben. Danach Verbinden wählen.

Der Client lädt die Datensätze und den Änderungsverlauf in die lokale Arbeitskopie. Ein Datenschlüssel ist nicht erforderlich und wird nicht abgefragt. Die Konfiguration merkt sich Serveradresse, Benutzername und technische Instanz- und Geräteinformationen. Die lokale Arbeitskopie bleibt dem Konto zugeordnet.

### Eine alte v1-Serverinstallation

Ein Protokoll-2-Client erkennt einen alten v1-Server mit verschlüsseltem SQLite-Gesamtsnapshot und lehnt ihn ab, ohne ihn zu überschreiben. Für die Übernahme:

1. Mit dem alten Client den v1-Bestand exportieren.
2. Den Export im lokalen Betrieb des aktuellen Clients unter Sicherheit & Backup → Backup wiederherstellen importieren. Bei einem verschlüsselten v1-Export den damaligen Recovery-Key eingeben.
3. Einen neuen, leeren Protokoll-2-Server einrichten.
4. Den lokalen Bestand mit Lokalen Bestand auf Server übertragen… auf den neuen Server übertragen.

Der alte Server bleibt bis zur geprüften Übernahme unverändert. Ein tatsächlich produktiver v1- oder v2-Server ist derzeit nicht bekannt.

## Laufender Betrieb

Editoren schreiben zuerst in ihre lokale SQLite-Arbeitskopie. Die App erzeugt aus jeder Änderung eine Transaktion und legt sie in der verschlüsselten Outbox ab. Die Änderung ist sofort in der geöffneten Arbeitskopie sichtbar. Ein Synchronisierungsversuch startet so schnell wie möglich. Zusätzlich fragt der Client ungefähr alle drei Sekunden neue Deltas ab. Netzwerkzugriffe laufen außerhalb der Sperre für lokale Datenbankoperationen.

Der Server prüft die Rolle und die Sitzung für jede Synchronisierung. Ein admin darf einen leeren Server initialisieren und kann zusätzlich wie ein editor Änderungen als Servertransaktion übertragen. Ein editor kann Änderungen als Servertransaktion übertragen. Ein reader kann den Bestand öffnen und lesen, kann aber keine lokale Änderung als Servertransaktion übertragen. Die bekannte Rolle wird im Offline-Cache angezeigt und bleibt bis zur nächsten Online-Anmeldung maßgeblich für die lokale Bedienung. Der Server entscheidet bei jeder Übertragung erneut.

Eine Sitzung ist acht Stunden gültig. Passwort und Token liegen nur während der Sitzung im Speicher. Nach einem Neustart ist eine Online-Anmeldung erforderlich, außer der Benutzer wählt für eine vorhandene Arbeitskopie ausdrücklich Offline öffnen und gibt das Passwort der letzten erfolgreichen Online-Anmeldung ein. Ein abgelaufenes, geändertes oder widerrufenes Passwort kann eine Offline-Kopie nicht aktualisieren.

Wenn der Server nicht erreichbar ist, bleiben lokale Änderungen und die Outbox erhalten. Der Status in Einstellungen → Verbindungen wechselt auf Offline, Ausstehende Änderungen oder Synchronisierungsfehler. Ein HTTP-401 führt zu Anmeldung erforderlich; die App öffnet die Offline-Kopie nicht automatisch. Nach einer erneuten Online-Anmeldung versucht sie, die wartenden Transaktionen weiterzugeben.

## Konflikte lösen

Der Server verwendet einen Compare-and-Swap-Vergleich je Datensatz. Eine Transaktion mit mehreren Zeilen wird nur vollständig angewendet, wenn die erwarteten Versionen aller betroffenen Datensätze noch stimmen. Der Server schreibt Datensätze, Versionsnummern und Änderungsverlauf in einer Transaktion. Eine bereits angenommene Transaktions-UUID wird bei einem Retry nicht doppelt ausgeführt. Ein Tombstone hält eine Löschung für nachfolgende Deltas sichtbar.

Wenn eine Transaktion wegen einer veralteten Datensatzversion abgewiesen wird, bleibt die gesamte Outbox erhalten und der Client zeigt den Status Konflikt. Die Einstellungen bieten dafür die aktuellen Aktionen:

- Serverversion übernehmen… erstellt zuerst eine verschlüsselte Recovery-Kopie. Danach übernimmt der Client die aktuelle Serverversion und verwirft alle wartenden lokalen Änderungen.
- Lokale Änderungen erneut senden… (nur editor und admin) erstellt ebenfalls die Recovery-Kopie und reicht alle wartenden lokalen Änderungen gegen den aktuellen Serverstand erneut ein. Einzelne Änderungen können dabei weiterhin abgewiesen werden.

Automatisch zusammengeführt werden nur Änderungen an unabhängigen Datensätzen. Änderungen an demselben Datensatz benötigen eine ausdrückliche Entscheidung. Die Recovery-Kopie wird vor der Entscheidung im lokalen Arbeitskopie-Verzeichnis geschrieben. Sie erhält einen Zeitstempel und eine UUID, ist verschlüsselt und bleibt an das Geräteprofil gebunden. Eine eigene Oberfläche zum Auffinden oder Wiederherstellen dieser Kopien gibt es noch nicht.

## Zwischen Server und lokal wechseln

Zum lokalen Bestand wechseln… zeigt vor der Aktion eine Bestätigung. Lokalen Bestand öffnen beendet die aktuelle Serversitzung und öffnet den bisherigen lokalen Bestand. Serverarbeitskopien, Outboxen und Recovery-Kopien bleiben dem jeweiligen Konto und der jeweiligen Serveradresse zugeordnet. Serverdaten werden nicht in den lokalen Bestand kopiert.

Eine lokale Funktion, die den gemeinsamen Bestand nicht unterstützt, wird im Serverbetrieb abgewiesen. Dazu gehören lokale Backups, Wiederherstellung, Löschen oder Zurücksetzen des lokalen Datenbestands, der Mitarbeiterimport und das Öffnen lokaler Dokumente. Unter Sicherheit & Backup → Serverbestand exportieren steht für eine ausdrückliche Rückmigration nur der ausdrücklich gestartete unverschlüsselte .db-Export zur Verfügung. Ein verschlüsselter Export ist deaktiviert, weil der lokale Schlüssel an das Geräteprofil gebunden ist und außerhalb dieses Profils nicht wiederhergestellt werden kann. Die .db-Datei ist direkt lesbar und muss für die Rückmigration geschützt behandelt und anschließend lokal importiert werden.

## Sicherung und Wiederherstellung

Eine PostgreSQL-Sicherung enthält die lesbaren Datensätze, Tombstones und den Änderungsverlauf sowie Konten, Sitzungen und technische Metadaten. pg_dump verschlüsselt die Dump-Datei nicht. Sie braucht deshalb ein verschlüsseltes oder zugriffsgeschütztes Sicherungsziel.

    cd server
    umask 077
    mkdir -p backups
    docker compose exec -T db sh -c \
      'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
      > "backups/cleardeck-$(date +%Y%m%d-%H%M%S).dump"

Der lokale Cache und seine Recovery-Kopien liegen nicht im PostgreSQL-Dump. Ihre lokalen Schlüssel sind an den geschützten Gerätespeicher gebunden. Ein Server-Restore stellt deshalb keinen lokalen Offline-Cache auf einem Gerät wieder her. Der Server bietet keine portable verschlüsselte Client-Sicherung.

Bei einer Wiederherstellung muss der Betreiber vor dem Neustart einen frischen Dump anlegen, den Server stoppen, den gewählten PostgreSQL-Dump einspielen, alle alten Sitzungen invalidieren und eine neue Serverinstanz-ID setzen. Danach müssen mindestens ein Online-Login, der Cursor, ein Editor- und ein Reader-Zugriff, eine neue Transaktion und das Lesen eines Tombstones geprüft werden. Das vollständige TLS-, Backup- und Restore-Verfahren ist noch nicht abgenommen. Die offenen Schritte stehen im Hosting- und Launch-Plan.

## Grenzen des aktuellen Serverbetriebs

- Die Rollen admin, editor und reader gelten für den gesamten Arbeitsbereich. Der admin hat zusätzlich zu den Editor-Rechten die Erstinitialisierung eines leeren Servers. Eine Admin-Oberfläche, MFA sowie Rechte je Mandant, Patient oder Datensatz gibt es noch nicht.
- Offline öffnen ist eine ausdrückliche lokale Funktion. Eine Kontosperre oder Rollenänderung kann eine bereits heruntergeladene Offline-Kopie nicht remote löschen. Sie verhindert weitere Online-Synchronisierung, sobald der Server die Änderung prüft.
- Der Serverbetrieb ist selbst gehostet. Ein von ClearDeck betriebener Hosted-Dienst und ein produktiver Server sind nicht eingerichtet.
- TLS, eine geprüfte Backup- und Restore-Strecke, eine unabhängige Sicherheitsprüfung und eine verbindliche Richtlinie für Offline-Kopien nach Kontowiderruf stehen noch aus.
