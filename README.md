# Employee DB – Electron Desktop App

Lokale Mitarbeiter- und VZAE-Uebersicht als Electron-Desktop-App mit SQLite, Export (CSV/Excel) und Passwortschutz.

## Features (Stand: Prototyp)
- Historisierte Mitarbeitenden-Tabelle (Eintritt, Austritt, Stellenanteil, Qualifikation, Quelle, Notiz, Dokumentenpfad).
- Jahresfilter mit Status (aktiv, Neueintritt, ausgeschieden) und VZAE-Berechnung je Qualifikation + Gesamt.
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
