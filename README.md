# Employee DB – Electron Desktop App

Lokale Mitarbeiter- und VZAE-Uebersicht als Electron-Desktop-App mit SQLite, Export (CSV/Excel) und Passwortschutz.

## Features (Stand: Prototyp)
- Historisierte Mitarbeitenden-Tabelle (Eintritt, Austritt, Stellenanteil, Qualifikation, Quelle, Notiz, Dokumentenpfad).
- Jahresfilter mit Status (aktiv, ausgeschieden) und VZAE-Berechnung je Qualifikation + Gesamt.
- Historienpflege: mehrere Perioden pro Person moeglich (Toggle „Neue Historienperiode“).
- Exporte: CSV oder Excel inkl. Aggregationen je Qualifikation.
- Verweis auf Dokumentenpfad; Button oeffnet Datei/Ordner via Electron shell.
- Lokale Verschluesselung: App-Schluessel wird aus Benutzerpasswort abgeleitet, Datenbank liegt verschluesselt im User-Data-Verzeichnis.

## Projektstruktur
- `anforderungsdokument.md`: Anforderungen / Kontext.
- `app/`: Electron-Forge Projekt (TypeScript, React, better-sqlite3).
  - `src/index.ts`: Main-Prozess (DB, Verschluesselung, IPC, Export).
  - `src/preload.ts`: IPC-Bruecke.
  - `src/renderer.tsx`: UI (React).

## Setup & Start
Voraussetzung: Node.js 18+.

```bash
cd app
npm install
npm start
```

Der erste Start fragt nach einem Passwort (setzt gleichzeitig den lokalen App-Schluessel). Danach kann die Jahresliste gefiltert, editiert und exportiert werden.

## Release / Versionierung
- `make release-patch` / `make release-minor` / `make release-major`: hebt die Semver-Version in `app/package.json` an, committet, taggt (`vX.Y.Z`) und baut die Artefakte via `npm run make`.
- `make release`: baut nur die aktuell eingetragene Version (nuetzlich, wenn bereits ein Tag existiert).
- `make show-version`: zeigt die aktuelle Version an.
- Releases pushen automatisch Commit + Tag ins Remote.
- Voraussetzungen: sauberes Git-Working-Tree, installierte Dependencies (`npm install` im Ordner `app/`). Artefakte landen unter `app/out` (ignored).

### CI-Releases (GitHub Actions)
- Workflow: `.github/workflows/release.yml` baut auf Tags (`v*`) für macOS, Windows und Linux und lädt die Artefakte als Release-Assets hoch.
- Default: `SKIP_FUSES=1` im CI (kein Codesigning nötig). Für signierte Builds einfach die Variable entfernen/setzen und die jeweiligen Zertifikate/Notarisierungs-Secrets hinterlegen.
- Linux benötigt `rpm`/`fakeroot` (wird im Workflow installiert); Windows/macOS nutzen die Standard-Forge-Maker (Squirrel/ZIP, ZIP).

## Datenablage & Verschluesselung
- Arbeits- und Konfigurationsdaten liegen unter `app.getPath('userData')/data` (OS-abhaengig).
- Datenbank wird beim Schliessen in `employee.db.enc` (AES-GCM) verschluesselt. Entschluesselung nur nach Login.
- Passwort wird nicht gespeichert; bei Verlust ist die DB nicht wiederherstellbar.

## Wichtige NPM-Skripte (im Ordner `app/`)
- `npm start` – Entwicklung mit Hot-Reload.
- `npm run make` – Paketieren (plattformabhaengig, erfordert System-Toolchain).

## Bekannte TODOs / Naechste Schritte
- Optional: dedizierte Auto-Update-Pipeline und Installationspakete pro OS.
- Tests (Unit/E2E) ergaenzen, Lint/Formatting-Konfiguration schaerfen.
- Optional: SQLCipher statt App-seitiger AES-Verpackung.
