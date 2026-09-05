# Windows-Update von 1.7.1 auf 1.8.0

Am 5. September 2026 im bestehenden GitHub-Release `v1.8.0` repariert. Die Installationsdatei wurde nicht verändert. Der Client benötigt für die Metadatenkorrektur keine vorherige manuelle Neuinstallation.

## Ursache

Die drei beteiligten Stellen verwendeten unterschiedliche Dateinamen:

| Stelle | Dateiname |
| --- | --- |
| Forge-Standard und erzeugte `latest.yml` | `ClearDeck-1.8.0 Setup.exe` |
| Tatsächlich hochgeladenes GitHub-Asset | `ClearDeck-1.8.0.Setup.exe` |
| Von `PrivateGitHubProvider` in electron-updater 6.6.2 gesuchter Name | `ClearDeck-1.8.0-Setup.exe` |

Der Provider ersetzt Leerzeichen durch Bindestriche und vergleicht anschließend den Namen exakt mit den GitHub-Assets. Daher entstand `Cannot find asset`. Das Release und der Installer waren vorhanden. Der Zugriff auf das private Repository funktionierte.

## Änderung am veröffentlichten Release

Die neue `latest.yml` verweist in `files[0].url` und `path` exakt auf `ClearDeck-1.8.0.Setup.exe`. Sie enthält nur den für den Windows-Updater benötigten Installer. NuGet-Paket und ZIP bleiben als separate Release-Assets verfügbar. Version, Release-Datum, Installergröße und SHA-512 blieben gleich.

- Altes Manifest-Asset: `373317696`
- Neues Manifest-Asset: `546053375`
- Unverändertes Installer-Asset: `373317692`
- SHA-256 der geprüften EXE: `1af7ff4bc5ce2110fbc5f8a6297f36e23fc4f84dec6efd4cb0dec05507182f15`
- Größe: `136727040` Byte

Die heruntergeladene EXE stimmt mit der SHA-512 im Manifest und der SHA-256 aus GitHub überein. Nach dem Upload wurde das Manifest erneut von GitHub geladen und mit dem echten `PrivateGitHubProvider` aus der auch in 1.7.1 verwendeten Version 6.6.2 aufgelöst.

## Windows-Prüfung

[Erfolgreicher GitHub-Actions-Lauf](https://github.com/Rasalas/employee-db/actions/runs/33978923134) auf einer temporären `windows-latest`-VM:

1. Originalen Installer 1.7.1 aus dem privaten Release installieren.
2. Synthetische gesperrte Konfiguration und Datenbankdatei unter `%APPDATA%\ClearDeck\data` ablegen und ihre Hashes erfassen.
3. Originalen Installer 1.8.0 mit `--updated --force-run` starten. Das sind die Parameter von `NsisUpdater`, wenn 1.7.1 `quitAndInstall()` mit Standardwerten aufruft.
4. Installierte Produktversion 1.8.0, laufenden neuen Prozess, gültiges Verknüpfungsziel und unveränderte Datenhashes prüfen.

Der Test prüft die konkreten Installer und deren Aufruf. Die private GitHub-Dateiauflösung wurde separat geprüft. Er ersetzt keine Bestätigung vom betroffenen Rechner und enthält keine echten Mitarbeiter- oder Patientendaten.

Die Squirrel-/NSIS-Kombination ist offiziell nicht unterstützt. Die konkreten veröffentlichten Installer funktionieren mit diesen Parametern. Künftige Änderungen am Installer brauchen erneut einen Windows-Installationstest.

## Schutz für künftige Releases und Fehleranzeige

- `MakerSquirrel` bekommt einen expliziten Dateinamen ohne Leerzeichen.
- Der Manifest-Generator weist unsichere Dateinamen zurück, bevor eine betroffene Manifestdatei geschrieben wird.
- Windows-Metadaten enthalten nur Installer. Ähnlich beginnende andere Versionsnummern werden ausgeschlossen.
- Regressionstests verwenden den echten privaten GitHub-Provider und laufen auch im Release-Workflow.
- Lange Fehler erscheinen in einem 9 rem hohen, scrollbar und per Tastatur nutzbaren Textfeld mit Kopierknopf. Falls die Zwischenablage nicht verfügbar ist, wird der Text zum manuellen Kopieren markiert. Das gilt für Einstellungen und den neuen Startbildschirm.

Diese Quellcodeänderungen sind von der sofort wirksamen Metadatenreparatur getrennt. Der vorhandene 1.8.0-Installer enthält die neue Fehleranzeige noch nicht.

## Ergänzter Test des echten alten Update-Knopfs

[Erfolgreicher UI-Test für 1.7.1 und 1.7.2](https://github.com/Rasalas/employee-db/actions/runs/33982051559) auf jeweils einer eigenen GitHub-Windows-VM:

1. Nur den originalen alten Installer herunterladen und installieren.
2. Die alte App über ihre sichtbare Oberfläche mit einem synthetischen Testpasswort einrichten.
3. Die App ihren unveränderten veröffentlichten Feed prüfen und das Update selbst herunterladen lassen.
4. Den echten „Installieren“-Knopf in ihrer Sidebar anklicken. Der Test ruft weder Update-IPC noch den neuen Installer direkt auf.
5. Den automatisch gestarteten Prozess aus `app-1.8.0` und dessen Produktversion prüfen.
6. Unveränderte Konfiguration und unveränderten entschlüsselten Datenbankinhalt nachweisen.

Beide Ausgangsversionen bestanden diesen vollständigen Ablauf. Das bestätigt, dass die Manifestreparatur in dieser Windows-Umgebung bis zum tatsächlichen Versionswechsel reicht, ohne vorherigen Client-Patch oder manuell gestarteten neuen Installer. Es ist weiterhin keine Garantie gegen zusätzliche Fehler auf einem bestimmten Kundenrechner.

Die ursprüngliche Statusanzeige kann auch unter Windows einen bereits geladenen Update-Hinweis überschreiben oder native Fehler verbergen. Diese gemeinsame UI-Lücke hat den erfolgreich geprüften Installationsaufruf nicht verhindert. Der auf dem lokalen Mac beobachtete Signaturfehler ist ein separater Befund.
