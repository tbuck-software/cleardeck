# Öffentliches ClearDeck-Repository vorbereiten

Dieses Verzeichnis gehört nur zum privaten Repository und wird nicht mit veröffentlicht.

## Warum ein neues Repository

`tbuck-software/cleardeck` wird nicht einfach öffentlich geschaltet. Die bereinigte Historie ist sauber. GitHub hält aber weiterhin interne PR-Referenzen auf den alten Verlauf, der ein inzwischen gesperrtes Token und eine entfernte Personalliste enthält. Diese Inhalte wären nach dem Umschalten über die PR-Ansichten abrufbar.

Stattdessen gilt:

- Das private Repository wird in `tbuck-software/cleardeck-private` umbenannt und behält Historie, Issues, PRs und Release-Entwürfe.
- Ein neues öffentliches `tbuck-software/cleardeck` bekommt einen einzigen Commit aus dem geprüften Stand.
- Die Update-Quelle der App zeigt schon auf `tbuck-software/cleardeck`.

## Snapshot bauen

```sh
scripts/public-snapshot/build.sh origin/main ../cleardeck-public-snapshot
```

Das Skript geht so vor:

1. Es exportiert den Stand.
2. Es entfernt die Pfade aus `exclude.txt`.
3. Es sucht nach den Mustern aus `forbidden.txt`. Geprüfte Fehlalarme stehen in `allow.txt`.
4. Es erzeugt ein lokales Repository mit einem Commit. Gepusht wird nichts.

Das Skript endet mit Exit-Code 0 nur, wenn keine Treffer übrig sind und gitleaks installiert ist und nichts findet (`brew install gitleaks`).

## Offene Entscheidungen

Stand 14.09.2026 meldet das Skript noch folgende Treffer. Sie bleiben stehen, bis der Eigentümer entschieden hat:

- **`VA-HYG-003`** ist eine interne Dokumentnummer als Rechtsgrundlage der MRSA-Unterweisung. Sie steht in `src/main/database/defaultCatalog.ts` und in den Fixtures v1.8.0 bis v2.2.0. Ist sie kundenspezifisch, wird sie im Katalog neutralisiert. Die Fixtures bilden ausgelieferte Datenbanken ab und bekommen dann denselben neutralen Wert.
- **„Pflegecampus“** ist das Schulungsprodukt der Kundin. Es steht als UI-Text in `src/utils/dashboardTasks.ts` und in `docs/betrieb/datenuebernahme-und-sicherung.md`. Neutral wäre z. B. „Schulungsnachweis“.
- **`docs/Einarbeitung_Kompetenzmatrix.xlsx`** ist derzeit ausgeschlossen. Zu klären ist, ob die Vorlage und ihr Stufenmodell frei veröffentlicht werden dürfen.
- **Ausgeschlossen, aber verlinkt:** Auf die ausgeschlossenen internen Dokumente verweisen noch `docs/README.md`, `docs/hosting-launch-plan.md`, `src/main/__tests__/fixtures/README.md` und der Release-Skill (`docs/reviews/`). Wenn die Ausschlüsse so bleiben, werden diese Verweise entfernt oder die internen Dokumente nach `docs/internal/` verschoben.
- **Release-Skill** (`.agents/`, `.claude/`, `AGENTS.md`): behalten oder entfernen. Er nennt kein privates Setup.
- **Logo und Icons:** Die Rechte sind noch zu bestätigen.
- **Release 2.2.1:** `windows-recovery.yml` prüft Upgrades gegen die privaten Entwürfe und fehlt deshalb im Snapshot. Vorschlag: Kandidat und native Upgradetests im privaten Repository, Veröffentlichung als erster Release im öffentlichen Repository. Der Kunde installiert 2.2.1 ohnehin einmal von Hand.

## Umschalten

Nur nach ausdrücklicher Freigabe durch den Eigentümer.

1. Offene Entscheidungen umsetzen, Snapshot neu bauen, Exit-Code 0.
2. Snapshot lokal prüfen: `npm ci`, `npx tsc --noEmit`, `npx vitest run`, Dateiliste durchsehen.
3. Privates Repository in `cleardeck-private` umbenennen. In allen lokalen Klonen die Remote-URL auf `tbuck-software/cleardeck-private` setzen.
4. Neues öffentliches Repository `tbuck-software/cleardeck` anlegen und den Snapshot pushen.
5. Einstellungen im neuen Repository:
   - Secret Scanning mit Push Protection einschalten.
   - Private Vulnerability Reporting einschalten.
   - Standardrechte der Workflows auf Lesen setzen.
   - Workflows von Fork-PRs erst nach Freigabe starten.
6. Issue #33 übertragen und den Discord-Webhook neu einrichten, falls gewünscht.
7. `hosting-launch-plan.md` im privaten Repository aktualisieren.
