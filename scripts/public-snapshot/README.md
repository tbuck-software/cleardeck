# Öffentliches ClearDeck-Repository vorbereiten

Dieses Verzeichnis gehört nur zum privaten Repository und wird nicht mit veröffentlicht.

## Warum ein neues Repository

`tbuck-software/cleardeck` wird nicht einfach öffentlich geschaltet. Die bereinigte Historie ist sauber. GitHub hält aber weiterhin interne PR-Referenzen auf den alten Verlauf, der ein inzwischen gesperrtes Token und eine entfernte Personalliste enthält. Diese Inhalte wären nach dem Umschalten über die PR-Ansichten abrufbar.

Das öffentliche Repository bekommt deshalb einen einzigen Commit aus dem geprüften Stand. Historie, Issues, PRs und Release-Entwürfe bleiben im privaten Repository. Die Namen beider Repositorys sind noch nicht festgelegt. Die Update-Quelle der App zeigt derzeit auf `tbuck-software/cleardeck` und muss auf das Repository zeigen, das die öffentlichen Releases trägt.

## Snapshot bauen

```sh
scripts/public-snapshot/build.sh origin/main ../cleardeck-public-snapshot
```

Das Skript geht so vor:

1. Es exportiert den Stand.
2. Es entfernt die Pfade aus `exclude.txt`.
3. Es sucht nach den Mustern aus `forbidden.txt`, nach Office-, Daten- und Audiodateien und nach toten relativen Links. Geprüfte Fehlalarme stehen in `allow.txt`.
4. Es erzeugt ein lokales Repository mit einem Commit. Gepusht wird nichts.

Das Skript endet mit Exit-Code 0 nur, wenn keine Treffer übrig sind und gitleaks installiert ist und nichts findet (`brew install gitleaks`).

## Entscheidungen

Stand 15.09.2026:

- Nicht öffentlich: alles unter `docs/internal/`, darunter das ursprüngliche Anforderungsdokument, die Auswertung der Kundengespräche, alle xlsx-Vorlagen, Berichte und Vorfälle. Rohmaterial wie `docs/interview/` ist nie versioniert.
- Öffentlich ist stattdessen die neutrale Fassung `docs/anforderungen.md`.
- `VA-HYG-003` stammt aus der Vorlage des Kunden und heißt im Standardkatalog jetzt „interner Hygieneplan“. „Pflegecampus“ ist durch „Schulungsplattform“ ersetzt.
- Das Logo ist selbst erstellt, die Icons sind frei lizenziert oder generiert.
- Der Release-Skill (`.agents/`, `.claude/`, `AGENTS.md`) bleibt privat, weil er auf den privaten Feed und die internen Berichte verweist.
- Release 2.2.1: Kandidat und native Upgradetests laufen im privaten Repository, weil `windows-recovery.yml` die privaten Entwürfe braucht. Veröffentlicht wird 2.2.1 als erster Release im öffentlichen Repository. Der Kunde installiert 2.2.1 ohnehin einmal von Hand.

Vor dem Umschalten prüft der Eigentümer den Snapshot selbst.

## Umschalten

Nur nach ausdrücklicher Freigabe durch den Eigentümer.

1. Snapshot bauen, Exit-Code 0.
2. Snapshot lokal prüfen: `npm ci` unter Node 22, `npx tsc --noEmit`, `npx vitest run` unter Node 26, Dateiliste durchsehen.
3. Namen festlegen. Soll das öffentliche Repository `tbuck-software/cleardeck` heißen, das private zuerst umbenennen und in allen lokalen Klonen die Remote-URL anpassen. Sonst die Update-Quelle der App auf den öffentlichen Namen umstellen.
4. Öffentliches Repository anlegen und den Snapshot pushen.
5. Einstellungen im neuen Repository:
   - Secret Scanning mit Push Protection einschalten.
   - Private Vulnerability Reporting einschalten.
   - Standardrechte der Workflows auf Lesen setzen.
   - Workflows von Fork-PRs erst nach Freigabe starten.
6. Issue #33 übertragen und den Discord-Webhook neu einrichten, falls gewünscht.
7. `docs/internal/betrieb/hosting-launch-plan.md` im privaten Repository aktualisieren.
