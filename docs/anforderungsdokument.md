# Anforderungsdokument: Team- und FTE-Uebersicht

## Zweck und Zielbild
- Zentrale, einfach pflegbare Tabelle fuer alle jemals beschaeftigten Teammitglieder.
- Schnelle Erstellung der Nachweise fuer den Krankenkassenverband zum zuletzt abgeschlossenen Geschaeftsjahr.
- Auswertungen nach Jahr, Qualifikation und Vollzeitaequivalent (VZAE) ohne manuelle Recherchen in verschiedenen Systemen.

## Ausgangslage / Schmerzpunkte
- Verwaltungssoftware liefert nur aktuelle bzw. inaktive Teammitglieder, aber keine Jahresfilter oder Historie.
- Export aus der Software zeigt Stellenanteile nur fuer aktuelle Teammitglieder; vergangene Jahre muessen manuell recherchiert werden.
- Historische Daten liegen verstreut in NAS-Personalordnern (gescannte Personalfrageboegen, Vertraege, Kuendigungen); Start- und Enddaten muessen dort einzeln gesucht werden.
- Bisherige Excel-Listen wurden begonnen, aber nicht fertiggestellt oder gingen verloren.

## Scope
- Abdeckung aller Teammitglieder (aktiv, inaktiv, ausgeschieden) mit historischer Sicht.
- Schwerpunktjahr zunaechst 2024; andere Jahre sollen filter- und auswertbar sein.
- Zielplattform: lokal nutzbare Tabelle (Excel/Sheets-kompatibel); cloudunabhaengig, um Upload-Probleme und Datenvolumen zu vermeiden.
- Umsetzung als Desktop-App mit Electron (moderner, leicht bedienbarer UI).
- Excel nur als Exportoption; produktive Datenhaltung in SQLite (lokal, integrierbar, relational fuer 1:n / m:n Beziehungen).

## Datenfelder (Minimum)
- Name
- Qualifikationskategorie: `3-jaehrig examiniert`, `1-jaehrig examiniert`, `Pflegekraft/-helfer` (plus optionale Spezialqualifikationen)
- Eintrittsdatum
- Austrittsdatum (leer bei aktiven Teammitgliedern)
- Stellenanteil (z. B. 1,0; 0,5)
- Status abgeleitet aus Datum + Jahr (aktiv im Zieljahr, ausgeschieden, neu gestartet)
- Datenquelle/Herkunft (z. B. Verwaltungssoftware, Personalakte/NAS)
- Freitext-Bemerkung

## Funktionen
- **Jahresfilter**: Auswahl eines Zieljahres (z. B. 2024) zeigt alle Teammitglieder, die im Jahr ganz oder teilweise beschaeftigt waren.
- **FTE/VZAE-Berechnung**: Summen pro Jahr und Qualifikationskategorie auf Basis des Stellenanteils; Darstellung der Gesamt-VZAE.
- **Aggregationen**: Kopfkennzahlen pro Jahr (Anzahl Personen pro Kategorie, VZAE pro Kategorie, Gesamt-VZAE).
- **Detailansicht**: Listendarstellung mit allen Datenfeldern; Export als Excel/CSV.
- **Historiepflege**: Erfassung von Eintritt/Austritt zur korrekten Jahreszuordnung; einfache Nachpflege neuer Ereignisse.
- **Erweiterbar**: Zusaetzliche Auswertungen (z. B. weitere Kennzahlen) koennen spaeter ergänzt werden, ohne Grundstruktur zu brechen.
- **Dokumentenbezug**: Verknuepfung von Datensaetzen mit referenzierten Dateien (NAS/PC) und manuelle oder halbautomatische Uebernahme von Daten aus Dokumenten; Ziel ist gebuendelte Sicht und abfragbare Struktur.

## Erweiterungen (gewollt, aber nachrangig)
- Fortbildungen: Datum, Thema, Wiederholungsintervall; Auswertung, wer wann Fortbildung hatte bzw. wieder braucht.
- Pflegevisiten: Faelligkeits- und Durchfuehrungsdaten.

## Nicht-Ziele
- Kein vollstaendiges HR- oder Lohnabrechnungs-System.
- Keine Abbildung komplexer Vertragsversionen; es reicht ein konsistenter Satz Eintritt/Austritt/Stellenanteil pro Person (manuell pflegbar).

## Datenquellen und Erfassung
- Verwaltungssoftware: Export der aktuellen Teammitglieder inkl. Stellenanteil (keine Historie); dient als Ausgangspunkt fuer aktive Personen.
- NAS-Personalordner: manuelle Sichtung von Personalfrageboegen, Vertraegen, Kuendigungen fuer historische Start-/Enddaten.
- Laufende Pflege: Neueintritte und Austritte sofort in der Tabelle nachtragen; Stellenanteils-Aenderungen erfassen, damit VZAE stimmt.
- Dokumente lesen: Wichtige Metadaten (Eintritt, Austritt, Stellenanteil, Qualifikation) aus gescannten/abgelegten Dateien extrahieren (halbautomatisch), um Nachpflege zu beschleunigen.

## Prozess/Workflows
- **Initiale Befuellung**: Aktuelle Liste exportieren, historische Start-/Enddaten aus NAS nachtragen, Qualifikationen und Stellenanteile vervollstaendigen.
- **Monatliche Pflege**: Neueintritte, Austritte und Stellenanteils-Aenderungen einpflegen; offene Felder (z. B. fehlende Austrittsdaten) klaeren.
- **Jahresauswertung**: Auswahl des Zieljahres liefert Liste + Aggregationen fuer den Bericht an den Krankenkassenverband.

## Architektur / Technik
- Electron-Desktop-App (UI modern, touch/mausfreundlich), lokal lauffaehig ohne permanente Cloud-Abhaengigkeiten.
- Datenhaltung: SQLite (lokal, relational, unterstuetzt 1:n und m:n Tabellen fuer Teammitglieder, Qualifikationen, Fortbildungen, Dokumentverweise etc.).
- Export: Excel/CSV; optional PDF-Report spaeter.
- Auto-Update: bevorzugt private GitHub-Releases (nicht oeffentlicher Feed, Auth/Token); alternativ eigener PHP-Server als Update-Host.
- Deployment: Signierte Builds pro OS (mind. Windows; macOS via Electron moeglich). Update-Kanal: Stable (evtl. spaeter Beta).

## Sicherheit / Authentifizierung
- Einzel-User-Zugang mit Passwort.
- Lokaler App-Schluessel automatisch erzeugt; verschluesselt mit Benutzerpasswort (z. B. PBKDF2/scrypt/argon2 + AES-GCM) und lokal gespeichert. Backup des verschluesselten Schluessels beim Betreiber.
- Gesamte Datenbank standardmaessig verschluesselt; Entschluesselung nur nach Login/Passworteingabe, Nutzung im Arbeitsspeicher, kein Klartext-Storage.
- Keine offene Repo-Pflicht: Updates aus privater Quelle; Quellcode kann privat bleiben.
- Backup-Strategie fuer verschluesselte Datenbank/Schluessel erforderlich (Offline-Sicherung auf NAS).

## Offene Punkte / Klaerungen
- FTE-Definition: Standard-Stichtag 31.12.; soll konfigurierbar sein. Teilzeit-Aenderungen muessen mit Gueltig-ab-Datum historisiert werden.
- Qualifikationskategorien: Start mit den genannten Kategorien, aber frei anpassbar/erweiterbar.
- Exportformate: Excel/CSV reichen zunaechst (kein PDF-Pflicht).
- NAS-Daten: Keine direkte Manipulation; nur Verlinkung auf Ordner/Dokumente.
- Plattform: Windows Prioritaet; Electron ermoeglicht macOS (optional).
- Updates: Praeferenz private GitHub-Releases; Fallback eigener PHP-Server; Authentifizierung fuer Update-Feed erforderlich.
- OCR/Extraktion: Vorerst keine OCR (handgeschriebene Dokumente); Daten werden manuell erfasst.
