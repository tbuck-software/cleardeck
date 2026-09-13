# Employee DB – Electron Desktop App

Lokale Team- und VZAE-Uebersicht als Electron-Desktop-App mit SQLite, Export (CSV/Excel) und Passwortschutz.

## Features (Stand: Prototyp)
- Historisierte Team-Tabelle (Eintritt, Austritt, Stellenanteil, Qualifikation, Quelle, Notiz, Dokumentenpfad).
- Jahresfilter mit Status (aktiv, ausgeschieden) und VZAE-Berechnung je Qualifikation + Gesamt.
- Historienpflege: mehrere Perioden pro Person moeglich (Toggle „Neue Historienperiode“).
- Exporte: CSV oder Excel inkl. Aggregationen je Qualifikation.
- Verweis auf Dokumentenpfad; Button oeffnet Datei/Ordner via Electron shell.
- Lokale Verschluesselung: App-Schluessel wird aus Benutzerpasswort abgeleitet, Datenbank liegt verschluesselt im User-Data-Verzeichnis.

## Projektstruktur
- `docs/anforderungsdokument.md`: Anforderungen / Kontext.
- `src/index.ts`: Main-Prozess (DB, Verschluesselung, IPC, Export).
- `src/preload.ts`: IPC-Bruecke.
- `src/renderer.tsx`: UI (React).

## Setup & Start
Voraussetzung: Node.js 18+.

```bash
npm install
npm start
```

Der erste Start fragt nach einem Passwort (setzt gleichzeitig den lokalen App-Schluessel). Danach kann die Jahresliste gefiltert, editiert und exportiert werden.

## Optionaler Serverbetrieb

Der lokale Betrieb bleibt die Voreinstellung. Für einen gemeinsam genutzten, selbst gehosteten Bestand beschreibt das [deutsche Server-Runbook](docs/server-mode.md) Einrichtung, Konten, Datenschlüssel, Migration sowie PostgreSQL-Sicherung und -Wiederherstellung. Der [Hosting- und Launch-Plan](docs/hosting-launch-plan.md) enthält die offenen technischen, Sicherheits- und Datenschutzprüfungen. ClearDeck betreibt derzeit keinen Hosted-Dienst.

## Release / Versionierung
- `make release-patch` / `make release-minor` / `make release-major`: hebt die Semver-Version in `package.json` an, committet, taggt (`vX.Y.Z`) und baut die Artefakte via `npm run make`.
- `make release`: baut nur die aktuell eingetragene Version (nuetzlich, wenn bereits ein Tag existiert).
- `make show-version`: zeigt die aktuelle Version an.
- Releases pushen automatisch Commit + Tag ins Remote.
- Voraussetzungen: sauberes Git-Working-Tree, installierte Dependencies (`npm install`). Artefakte landen unter `out/` (ignored).

### CI-Releases (GitHub Actions)
- Workflow: `.github/workflows/release.yml` baut auf Tags (`v*`) für macOS, Windows und Linux und lädt die Artefakte als Release-Assets hoch.
- Default: `SKIP_FUSES=1` im CI (kein Codesigning nötig). Für signierte Builds einfach die Variable entfernen/setzen und die jeweiligen Zertifikate/Notarisierungs-Secrets hinterlegen.
- Linux benötigt `rpm`/`fakeroot` (wird im Workflow installiert); Windows/macOS nutzen die Standard-Forge-Maker (Squirrel/ZIP, ZIP).

## Datenablage & Verschluesselung
- Produktionsdaten liegen unter `app.getPath('userData')/data` (OS-abhaengig).
- `npm start` verwendet automatisch ein separates Dev-Profil unter `dev-ClearDeck/data`, damit lokale Dev-Starts und die installierte App unterschiedliche Daten halten.
- Datenbank wird beim Schliessen in `employee.db.enc` (AES-GCM) verschluesselt. Entschluesselung nur nach Login.
- Passwort wird nicht gespeichert; bei Verlust ist die DB nicht wiederherstellbar.

## Wichtige NPM-Skripte
- `make dev` / `npm start` – echte ClearDeck-Dev-App mit Live-Aktualisierung.
- `make dev-updates` / `npm run dev:updates` – direkt zum Update-Beispiel mit separatem Testprofil.
- Renderer und CSS aktualisieren sich beim Speichern. Für Main-Prozess-Änderungen im laufenden Terminal `rs` eingeben.
- Start, Datenpfade und Trennung sind in [docs/development.md](docs/development.md) beschrieben.
- `npm run make` – Paketieren (plattformabhaengig, erfordert System-Toolchain).
- `npm run nuke:dev` – entfernt die Dev-Datenbank unter `dev-ClearDeck/data` nach Bestaetigung.
- `npm run nuke:prod` – entfernt die Produktionsdatenbank unter `ClearDeck/data` nach Bestaetigung.
- `npm run nuke:all` – entfernt Dev- und Prod-Daten nach Bestaetigung.
- Mit `-- --yes` laeuft der jeweilige Nuke-Befehl ohne Rueckfrage.

## Bekannte TODOs / Naechste Schritte
- Optional: dedizierte Auto-Update-Pipeline und Installationspakete pro OS.
- Tests (Unit/E2E) ergaenzen, Lint/Formatting-Konfiguration schaerfen.
- Optional: SQLCipher statt App-seitiger AES-Verpackung.
