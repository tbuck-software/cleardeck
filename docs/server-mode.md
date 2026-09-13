# Serverbetrieb

Stand: 13.09.2026. Der Serverbetrieb ist ein optionaler, selbst gehosteter Betriebsweg. Der lokale Betrieb bleibt die Voreinstellung.

## Was der Serverbetrieb speichert

Eine Serverinstallation hat genau einen gemeinsamen Arbeitsbereich. Die Desktop-App lädt dafür den vollständigen SQLite-Bestand, entschlüsselt ihn im Arbeitsspeicher und schreibt nach einer Änderung wieder einen vollständigen, verschlüsselten Snapshot zurück. PostgreSQL speichert dabei nur:

- den undurchsichtigen verschlüsselten Snapshot als `bytea`,
- Konten, Passwort-Hashes, Rollen und Sitzungen,
- die technische Änderungsfolge mit Revision, Benutzername und Zeit.

Die fachlichen Tabellen und der fachliche Audit-Inhalt bleiben im verschlüsselten SQLite-Snapshot. Der Server erhält den 32-Byte-Datenschlüssel nicht. Im Snapshot-Kopf steht nur sein SHA-256-Fingerabdruck, damit die App einen falschen Schlüssel erkennen kann.

Alle Geräte, die denselben Arbeitsbereich öffnen, benötigen denselben 32-Byte-Datenschlüssel. Die App fragt ihn bei jeder Anmeldung erneut ab und legt ihn nicht in der Serverkonfiguration ab. Das Serverpasswort ist davon getrennt. Es dient nur der Anmeldung am Server.

Ein Konto hat die Rolle `reader` oder `editor`. Leser können den Bestand ansehen und exportieren. Editoren können Änderungen speichern. Eine Sitzung läuft nach acht Stunden ab. Das Serverkonto sieht keine einzelnen Patientenrechte vor, sondern gilt für den gesamten Arbeitsbereich.

Der Snapshot darf höchstens 32 MiB groß sein. Der Server führt keine Live-Abfragen auf fachlichen SQL-Tabellen aus. Es gibt derzeit keinen von ClearDeck betriebenen Hosted-Dienst. Die Adresse in der App gehört zum selbst betriebenen Server des jeweiligen Betreibers.

## Server einrichten

Die App verbindet sich mit der ClearDeck-API. SQL-Zugangsdaten gehören ausschließlich auf den Server. Der erste unterstützte externe Speicher ist PostgreSQL hinter dieser API; ein Firebase-Adapter ist nicht implementiert. Für einen gemieteten Server ist entscheidend, dass sich dort der unten beschriebene Stack betreiben lässt. Ein gewöhnliches Webhosting-Paket mit Datenbankzugang allein reicht dafür nicht.

### Voraussetzungen

Für einen dauerhaften Betrieb werden benötigt:

- ein Rechner oder eine VM mit Docker Engine und Docker Compose Plugin,
- PostgreSQL mit dauerhaftem Volume,
- ein DNS-Name für die Serveradresse,
- ein Reverse Proxy mit TLS, im vorgesehenen Setup Caddy,
- ein geschützter Ort für PostgreSQL-Sicherungen und den Datenschlüssel.

Die Compose-Datei `server/docker-compose.yml` und die Caddy-Konfiguration `server/Caddyfile` gehören zum Serverpaket. Die dort dokumentierten Service-Namen `app`, `db` und `caddy` sowie die Variablen aus `server/.env.example` sind maßgeblich. Zugangsdaten und Schlüssel gehören in eine lokale `.env`-Datei oder in den Secret-Speicher des Betriebs. Sie dürfen nicht in Git eingecheckt werden.

### Start mit Docker Compose

Im Serververzeichnis starten:

```sh
cd server
cp .env.example .env
# POSTGRES_PASSWORD, DATABASE_URL und SERVER_DOMAIN in .env setzen
docker compose up -d --build
docker compose ps
```

Der Server legt die benötigten Tabellen beim ersten Start an. Prüfen, ob die Adresse erreichbar ist:

```sh
curl --fail https://cleardeck.example.de/health
```

Die Antwort muss ein JSON mit `ok: true` enthalten. Der Node-Port ist nur im privaten Compose-Netz erreichbar. Von außen wird nur die HTTPS-Adresse des Reverse Proxys verwendet.

### Caddy und TLS

Caddy nimmt Anfragen für den DNS-Namen an und leitet sie an den internen ClearDeck-Port weiter. Die öffentliche Adresse muss genau die Origin ohne Pfad sein, zum Beispiel `https://cleardeck.example.de`. In der App gehören keine Zugangsdaten, Query-Parameter oder zusätzlichen Pfade in das Feld Serveradresse.

Für eine öffentliche Adresse gilt:

1. DNS zeigt auf den Reverse Proxy.
2. Caddy kann die Zertifikatsvalidierung erreichen und sein Zertifikats-Volume dauerhaft speichern.
3. Die Firewall lässt für den Proxy nur die notwendigen Ports 80 und 443 zu. PostgreSQL und der interne Node-Port sind aus dem Internet nicht erreichbar.
4. Nach dem Start wird die Zertifikatserneuerung und ein Neustart des Proxy-Containers geprüft.

Die Desktop-App akzeptiert nur HTTPS. Unverschlüsseltes HTTP ist ausschließlich für `localhost`, `127.0.0.1` oder `::1` erlaubt, etwa für einen Test auf demselben Gerät. Browserzugriff auf die API ist absichtlich nicht vorgesehen.

### Erstes Konto anlegen

Der Account-Befehl liest das Passwort aus `stdin`, speichert nur einen Hash und widerruft beim Setzen eines Kontos dessen bisherige Sitzungen. Nach dem Compose-Start die folgenden Eingaben in Bash ausführen:

```sh
cd server
read -r -s -p 'Passwort: ' CLEARDECK_ACCOUNT_PASSWORD; printf '\n'
printf '%s\n' "$CLEARDECK_ACCOUNT_PASSWORD" | \
  docker compose exec -T app npm run account -- set team-admin editor
unset CLEARDECK_ACCOUNT_PASSWORD
```

Das Passwort muss 14 bis 256 Zeichen lang sein. Für einen Leser `reader` statt `editor` angeben. Ein weiteres Konto wird ebenfalls im Service `app` angelegt:

```sh
read -r -s -p 'Passwort: ' CLEARDECK_READER_PASSWORD; printf '\n'
printf '%s\n' "$CLEARDECK_READER_PASSWORD" | \
  docker compose exec -T app npm run account -- set team-reader reader
unset CLEARDECK_READER_PASSWORD
```

Das Konto deaktivieren:

```sh
docker compose exec -T app npm run account -- disable team-reader
```

Das Deaktivieren löscht die Sitzungen des Kontos. Es löscht weder Snapshots noch bereits heruntergeladene Exporte und kennt keine Rückholung eines bereits verteilten Datenschlüssels.

## Mit der Desktop-App verbinden

### Bestehenden lokalen Bestand übertragen

Die Übertragung ist ein bewusster Schritt und funktioniert nur von einem geöffneten lokalen Bestand auf einen leeren Server:

1. Den lokalen Bestand anmelden und unter `Einstellungen → Allgemein → Datenablage` den Server verbinden.
2. `Lokalen Bestand übertragen` wählen. Für weitere Geräte stattdessen `Vorhandenen Bestand öffnen` verwenden.
3. Serveradresse, Serverbenutzername und Serverpasswort eintragen.
4. Den vorhandenen lokalen Recovery-Key verwenden oder einen neuen Datenschlüssel erzeugen. Den Schlüssel offline und getrennt vom Serverpasswort ablegen.
5. Erst nach der Ablage des Schlüssels `Übertragen und verbinden` wählen.

Der Server muss leer sein. Ein nichtleerer Server wird nicht überschrieben. Der lokale Bestand bleibt nach der Übertragung auf dem Gerät erhalten. Die Übertragung erzeugt keine Zusammenführung zweier Bestände.

### Weitere Geräte anmelden

Auf jedem Gerät dieselbe ClearDeck-Version oder eine kompatible Version installieren. Unter `Einstellungen → Allgemein → Datenablage` oder über `Vorhandenen Server verwenden` die Serveradresse und das zugewiesene Konto eingeben. Danach denselben 32-Byte-Datenschlüssel eingeben. Der Schlüssel wird nicht an den Server gesendet.

Die Client-Konfiguration speichert nur die Serveradresse, den Benutzernamen und die technische Instanz-ID. Serverpasswort, Datenschlüssel und Sitzungstoken werden nicht gespeichert. Nach einem Neustart fragt die App die Zugangsdaten und den Datenschlüssel erneut ab.

### Zwischen Server und lokal wechseln

`Zum lokalen Bestand wechseln` zeigt zunächst, was beim Wechsel geschieht. `Lokalen Bestand öffnen` bestätigt den Wechsel, beendet die Serversitzung und setzt die Auswahl auf lokal. Die Serverdaten werden dabei nicht in den lokalen Bestand kopiert. Der lokale Bestand bleibt getrennt erhalten und muss nach dem Wechsel lokal angemeldet werden.

Für eine ausdrückliche Rückmigration:

1. Im Serverbetrieb `Sicherheit & Backup → Serverbestand exportieren` wählen.
2. Für die normale Rückmigration den verschlüsselten Export wählen und den Datenschlüssel getrennt bereithalten. Ein unverschlüsselter Export ist eine direkt lesbare SQLite-Datei und muss wie eine Patientendatei behandelt werden.
3. Zum lokalen Bestand wechseln und lokal anmelden.
4. Unter `Sicherheit & Backup → Backup wiederherstellen` die Datei wählen. Bei einem verschlüsselten Export den Datenschlüssel als Recovery-Key eingeben.
5. Nach der Sicherheitskopie ersetzt die Wiederherstellung den lokalen Bestand vollständig. Die wichtigsten Listen, Zeiträume und Nachweise prüfen.

Der Import und die Wiederherstellung bleiben im Serverbetrieb gesperrt. Auch der lokale Mitarbeiterimport ist dort gesperrt. Der Servermodus unterstützt nur den expliziten Bestands-Export und die laufende Bearbeitung des einen Serverbestands.

## Laufender Betrieb

Die Internetverbindung wird während der Nutzung benötigt. Wenn der Server nicht erreichbar ist, weicht die App nicht automatisch auf den lokalen Bestand aus. Die geladene Datenbank liegt nur im Arbeitsspeicher des ClearDeck-Prozesses. Beim Sperren oder Beenden schließt die App sie und verwirft den Schlüssel aus dem Arbeitsspeicher.

Jede Datenoperation prüft zuerst die geladene Serverrevision. Eine andere offene App kann zwischen zwei Bedienvorgängen speichern. Dann meldet ClearDeck einen Konflikt und speichert die lokale Änderung nicht. Unter `Einstellungen → Allgemein → Datenablage` `Serverbestand neu laden` wählen und die Eingabe danach erneut erfassen. Das Neuladen schließt offene Eingaben; bereits gespeicherte Änderungen bleiben erhalten.

Ein Leser erhält beim Speichern eine Berechtigungsfehlermeldung. Ein abgelaufenes oder widerrufenes Konto muss mit Serverpasswort und Datenschlüssel erneut verbunden werden. Ein falscher Datenschlüssel wird beim Entschlüsseln erkannt. Ein größerer Snapshot wird bei 32 MiB abgewiesen.

## Sicherung und Wiederherstellung

### PostgreSQL sichern

Eine Server-Sicherung ist ein PostgreSQL-Dump. Darin liegen der verschlüsselte Snapshot, Konten, Sitzungen und die technische Änderungsfolge. `pg_dump` verschlüsselt die Dump-Datei nicht zusätzlich: Kontennamen, Passwort-Hashes und technische Metadaten bleiben darin lesbar. Deshalb den Dump zusätzlich verschlüsseln oder auf einem verschlüsselten, zugriffsgeschützten Sicherungsziel ablegen. Der Datenschlüssel liegt niemals in diesem Dump und muss separat gesichert werden.

Vor jeder Sicherung ein geschütztes Ziel anlegen und die Dateirechte einschränken:

```sh
cd server
umask 077
mkdir -p backups
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "backups/cleardeck-$(date +%Y%m%d-%H%M%S).dump"
```

Die Compose-Umgebung setzt `POSTGRES_USER` und `POSTGRES_DB` im Service `db`. Alternativ kann `pg_dump --format=custom --dbname="$DATABASE_URL"` auf einem gesicherten Administrationsrechner verwendet werden. Das Passwort in `DATABASE_URL` muss URL-sicher sein oder percentkodiert werden.

Den Dump nicht zusammen mit dem Datenschlüssel aufbewahren. Ein sinnvolles Sicherungsset enthält mindestens:

- mehrere PostgreSQL-Dumps mit zusätzlicher Datei- oder Speicherverschlüsselung in einem zugriffsgeschützten und räumlich getrennten Ziel,
- den 32-Byte-Datenschlüssel in einem separaten Offline- oder Secret-Management,
- die Compose-/Umgebungsdokumentation und die Caddy-Zertifikatsdaten, soweit sie für den Wiederanlauf benötigt werden.

Die Rücksicherung regelmäßig mit einer Kopie in einer Testumgebung üben. Nur die Existenz einer Dump-Datei beweist keine Wiederherstellbarkeit.

### PostgreSQL wiederherstellen

Vor einer Rücksicherung einen frischen Sicherheitsdump schreiben, dann den ClearDeck-Server stoppen. Die folgenden Befehle ersetzen die Serverdaten durch den gewählten Dump. Nur gegen die beabsichtigte Instanz ausführen:

```sh
docker compose stop app
docker compose exec -T db sh -c \
  'pg_restore --list' < backups/cleardeck-JJJJMMTT-HHMMSS.dump
docker compose exec -T db sh -c \
  'pg_restore --exit-on-error --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backups/cleardeck-JJJJMMTT-HHMMSS.dump
```

Nur nach einer erfolgreichen Wiederherstellung weitermachen. **Vor dem Neustart alle zurückgesicherten Sitzungen löschen und eine neue Instanz-ID setzen.** Dadurch können vor dem Restore geladene Clients nicht versehentlich mit einem wiederverwendeten Revisionsstand schreiben:

```sh
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
BEGIN;
DELETE FROM sessions;
UPDATE workspace SET instance_id = gen_random_uuid();
COMMIT;
SQL
docker compose start app
curl --fail https://cleardeck.example.de/health
```

Die Wiederherstellung nutzt die dokumentierten [pg_restore-Optionen](https://www.postgresql.org/docs/16/app-pgrestore.html) und die eingebaute [UUID-Funktion von PostgreSQL 16](https://www.postgresql.org/docs/16/functions-uuid.html).

Nach der Wiederherstellung auf jedem Gerät zum lokalen Betrieb wechseln und den Server ohne Initialübertragung ausdrücklich neu verbinden. Die App erkennt die neue Instanz-ID; das ist nach einem Restore beabsichtigt. Den Datenschlüssel aus dem separaten Schlüsseldepot verwenden. Den Revisionsstand, ein Editor-Konto und einen Reader prüfen. Ohne Datenschlüssel bleibt der wiederhergestellte Snapshot unlesbar.

Ein Account-Entzug beseitigt keine Kopien, die ein Gerät bereits geladen oder exportiert hat. Falls der Datenschlüssel bekannt geworden ist, reicht das Deaktivieren eines Kontos nicht aus. Eine Schlüsselrotation mit vollständiger Neuverschlüsselung und Verteilung eines neuen Schlüssels ist für den produktiven Betrieb noch offen.

## Grenzen des aktuellen Servermodus

Der aktuelle Umfang hat bewusst klare Grenzen:

- Berechtigungen gelten für den gesamten Arbeitsbereich. Feinere Rechte je Patient oder Datensatz gibt es nicht.
- Es gibt keine Offline-Bearbeitung und keine kollaborative Zusammenführung. Bei einer konkurrierenden Änderung muss neu geladen und erneut gespeichert werden.
- Es gibt keine Mehrfaktor-Anmeldung.
- Es gibt noch keine Serverfunktion für die Rotation des gemeinsamen Datenschlüssels.
- Lokale automatische Sicherungen, lokale Sicherheitskopien, destruktives lokales Löschen oder Zurücksetzen sowie der Mitarbeiterimport sind im Serverbetrieb gesperrt.

Diese Grenzen sind Betriebsbedingungen und keine Zusage, dass der Servermodus für jede Verarbeitung sensibler Gesundheitsdaten geeignet ist. Die technische Verschlüsselung ersetzt keine Risiko- und Rechtsprüfung.
