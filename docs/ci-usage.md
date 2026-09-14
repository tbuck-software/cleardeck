# CI gezielt ausführen

Die normalen Desktop- und Serverprüfungen laufen bei relevanten Änderungen auf Pull Requests und bei Pushes nach `main`. Ein Feature-Branch ohne Pull Request startet keine automatischen Codechecks; er lässt sich über `workflow_dispatch` prüfen. So löst ein Commit in einem offenen Pull Request die Checks nur einmal aus. Bei einem neueren Commit wird der überholte Prüflauf desselben Pull Requests oder Branches abgebrochen.

Vollständige Paketbauten und native Windows-Upgrades laufen gezielt:

| Workflow | Auslöser | Zweck |
| --- | --- | --- |
| `server.yml` | Pull Request, Push nach `main`, manuell | TypeScript, ESLint, Desktoptests, Servertests und Integrationstests |
| `windows-recovery.yml` | Manuell auf dem Kandidatenbranch; Tag `v2.2.1` | Windows-Pakete, rekonstruierte Baseline, drei native Upgradewege und Prüfung vor einer möglichen Veröffentlichung |
| `release.yml` | Manuell | Windows-/Linux-Paketkandidat mit Prüfung auf eingebettete Zugangsdaten |
| `windows-update-smoke.yml` | Manuell | Historische Windows-Updateprüfung |
| `cleanup-artifacts.yml` | Täglich, manuell | Alte CI-Artefakte löschen |

Ein Windows-Recovery-Kandidat wird ausdrücklich auf dem zu prüfenden Branch gestartet:

```sh
gh workflow run windows-recovery.yml --repo Rasalas/employee-db --ref <Kandidatenbranch>
```

Vor einem Release muss dieser vollständige Kandidatenlauf erfolgreich sein. Der Tag-Lauf behält sämtliche Prüfungen, Paketbauten, die Baseline und die native Upgradematrix als Voraussetzungen für `publish`. Neue Branch-Prüfläufe können ältere ablösen; ein laufender Tag-Release wird dadurch nicht abgebrochen. Der reine Paketworkflow veröffentlicht weiterhin nichts. Die bestehenden Grenzen des Wiederherstellungswegs bleiben unverändert.

Zeitlimits begrenzen hängende Läufe: Codechecks auf zehn Minuten je Job, Paketbauten und Baseline auf zwanzig Minuten, native Recovery-Upgrades auf fünfzehn Minuten. Die bisherigen Aufbewahrungsfristen der Artefakte bleiben erhalten.
