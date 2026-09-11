---
name: cleardeck-release
description: ClearDeck-Releases vorbereiten, prüfen und veröffentlichen sowie deutsche Release Notes schreiben oder nachträglich korrigieren. Verwenden, wenn in diesem Projekt eine Version veröffentlicht oder ihr Änderungstext bearbeitet werden soll.
---

# ClearDeck veröffentlichen

Arbeite vom Repository-Stamm aus. Nutze Git, die GitHub-CLI und die vorhandenen GitHub-Actions-Workflows. Der Ablauf gilt auch in Cloud-Umgebungen und benötigt keine lokale ClearDeck-Installation. Prüfe verfügbare Werkzeuge, Netzwerkzugang und GitHub-Berechtigungen. Fehlt ein benötigter Zugang, erledige die möglichen Vorbereitungen und benenne die konkrete Einschränkung; behaupte keinen ausgelösten Release.

Ein Releaseauftrag umfasst die Veröffentlichung nach bestandenen Prüfungen. Nutze bereits erteilte Autorisierung ohne zusätzliche Bestätigungsrunde. Ein Auftrag, nur Release Notes zu schreiben oder diesen Skill anzulegen, löst keinen neuen Release aus.

## Kurze deutsche Release Notes

- Schreibe pro Feature oder Fix einen kurzen Stichpunkt aus Nutzersicht.
- Beschreibe konkret, was die Person neu tun kann oder was besser funktioniert.
- Bündele zusammengehörige Änderungen; gehe nach Features statt nach einzelnen Commits vor.
- Verwende wenige Wörter pro Punkt. Lass Einleitungen und ausführliche Erklärungen weg.
- Halte Tests, Architektur, Datenbankschemata und Entwicklungswerkzeuge in technischen Berichten fest.
- Nenne notwendige Plattformgrenzen separat und knapp.

Beispiele:

- Patientenlisten nach Name und Diagnose sortieren.
- Offene Aufgaben und Fristen auf einen Blick.
- Daten nach einem Update zuverlässig übernehmen.

Pflege den Text in [CHANGELOG.md](../../../CHANGELOG.md). [scripts/release-notes.js](../../../scripts/release-notes.js) erzeugt daraus die GitHub-Beschreibung; [scripts/generate-update-yml.js](../../../scripts/generate-update-yml.js) übernimmt die veröffentlichte Historie in `releaseNotes` der Update-Dateien. Die App liest diese Dateien, nicht den GitHub-Beschreibungstext. Für eine reine Korrektur veröffentlichter Hinweise verwende [Notizen nachträglich korrigieren](references/notizen-korrigieren.md).

## Einen neuen Release ausführen

1. **Stand klären.** Prüfe Arbeitsbaum, Remote, Branch, letzten veröffentlichten Tag und Paketversion. Ermittle die Nutzeränderungen seit diesem Release. Übernimm nur zum Auftrag gehörende Änderungen. Verwende die angeforderte Version oder eine zum Umfang passende SemVer-Erhöhung. Bereits veröffentlichte Tags bleiben unverändert.

2. **Releaseweg prüfen.** Lies [.github/workflows/release.yml](../../../.github/workflows/release.yml), [scripts/retain-mac-feed.cjs](../../../scripts/retain-mac-feed.cjs), [scripts/publish-verified-release.cjs](../../../scripts/publish-verified-release.cjs) und [scripts/verify-release-artifacts.cjs](../../../scripts/verify-release-artifacts.cjs). Verwende deren Laufzeiten und Prüfungen. Leite den Plattformumfang aus Nutzerauftrag und bisheriger Auslieferung ab. Im Stand von 2.0.0 sperrt das Mac-Skript andere Paketversionen und der Publisher nennt 2.0.0 im Beschreibungstext. Passe solche Versionsannahmen vor dem Kandidatenlauf an den nächsten Release an; Beschreibung, behaltene Mac-Version und Verifier müssen zusammenpassen. Erhalte die Prüfungen und einen auflösbaren gemeinsamen privaten GitHub-Feed. Build-Artefakte zählen gegen das Speicherkontingent des Kontos: Paketbauten behalten einen Tag, `cleanup-artifacts.yml` löscht täglich alles Ältere als zwei Tage. Schlägt ein Upload mit erschöpftem Kontingent fehl, lösche alte Artefakte per API und starte die fehlgeschlagenen Jobs neu; GitHub rechnet das Kontingent nur alle 6 bis 12 Stunden neu.

3. **Kandidaten vorbereiten.** Schreibe die Stichpunkte unter `[Unreleased]`. Aktualisiere Paket und Lockdatei ohne Tag, etwa mit `npm version <Version> --no-git-tag-version`, und führe `node scripts/release-notes.js --prepare` aus. Prüfe den Diff und committe den Kandidaten. Die älteren `make release-*`-Ziele taggen vor der unabhängigen Kandidatenprüfung; verwende stattdessen diese getrennten Schritte.

4. **Unveröffentlicht prüfen.** Sorge vor dem Push für einen auslösbaren Workflow auf dem Kandidatenbranch. Prüfe Push-Filter und den Workflow auf dem tatsächlichen Defaultbranch: Nur dort verfügbarer manueller Dispatch kann vorausgesetzt werden. Falls beide Wege fehlen, ergänze im Kandidatencommit den Push-Filter um genau diesen Branch oder ein passendes Releasebranch-Muster. Pushe ohne Versionstag. Wenn der Push keinen Lauf auslöst, starte den verfügbaren manuellen Workflow ausdrücklich auf diesem Branch, etwa mit `gh workflow run release.yml --ref <Kandidatenbranch>`. Folge dem zugehörigen Lauf bis zum Endzustand. Erforderlich sind Codeprüfungen, Paketbauten, Datei-/Feedprüfung und native Windows-Upgrades.

   Die wiederholbaren Tests in `scripts/test-windows-candidate.ps1` und `.cjs` kontrollieren Installation, Neustart, Passwort und Bestand mit synthetischen Altprofilen. Nimm auch die zuletzt veröffentlichte Version als Ausgangspunkt auf. Passe dafür Versionsvalidierung, Fixture und tatsächliche Bedienfolge an: Ab 2.0.0 wird der Download ausdrücklich ausgelöst. Leite Zielschema und erwartete Sicherungen aus den tatsächlichen Migrationen ab; ohne Schemaänderung ist eine neue Migrationssicherung nicht zwingend richtig. Eine zusätzliche Matrixzeile allein reicht nicht. Behebe Fehler und wiederhole betroffene Prüfungen; ein Download allein belegt keine Datenübernahme.

5. **Veröffentlichen.** Nach vollständig erfolgreicher Kandidatenprüfung erstelle `v<Version>` auf genau dem geprüften Commit und pushe genau diesen Tag. Prüfe zuvor, dass er noch nicht existiert und Paketversion, Changelog und Kandidat zusammenpassen. Der Tag-Workflow prüft erneut, lädt alle Dateien als Entwurf hoch, vergleicht die heruntergeladenen Dateien und veröffentlicht erst danach. Erhalte diese Prüfbedingungen; schalte einen fehlgeschlagenen Release nicht manuell frei.

6. **Live prüfen.** Bestätige Workflow-Erfolg, Veröffentlichung und vorgesehenes Updateangebot. Lade die veröffentlichten Dateien zurück und prüfe Versionen, Referenzen, Prüfsummen und Release Notes gegen die getesteten Artefakte. Dokumentiere Ergebnisse und Grenzen unter `docs/reviews/`. Melde knapp Release-Link, Plattformen und geprüfte Updatewege. Bei einer unklaren Veröffentlichungsantwort prüfe zuerst den tatsächlichen Releasezustand, bevor du eine Mutation wiederholst.

Für bisherige Datenübernahme und Plattformgrenzen lies [docs/update-flow.md](../../../docs/update-flow.md) und den jeweils neuesten Release-Bericht in `docs/reviews/`.
