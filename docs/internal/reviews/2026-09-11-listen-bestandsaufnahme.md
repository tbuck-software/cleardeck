# Listen-Bestandsaufnahme

Stand: main `fa262ad`, 11.09.2026. Screenshots unter [assets/2026-09-11-lists](assets/2026-09-11-lists/README.md). Es wurde nichts geändert; das Dokument ist die Grundlage für den Umbau.

## Befund in einem Satz

Die App hat 19 Listen mit 7 verschiedenen Zeilen-Anatomien, 3 Container-Stilen und 3 Arten, „Klick öffnet etwas“ zu signalisieren. Die Katalogseiten sind untereinander konsistent, der Rest ist pro Feature gewachsen.

## Bestand

| # | Ort | Aufgabe der Liste | Container | Zeile (links → rechts) | Klick-Signal | Soll-Typ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Übersicht › Heute zu tun | Aufgaben abhaken, hinspringen | Panel | Kreis · Titel + Unterzeile · Tag · Pfeil | Pfeil | D Aufgabenliste |
| 2 | Übersicht › Nächste 30 Tage | Termine | flach | Datumsblock · Titel + Unterzeile · Relativzeit | keins | C Zeitleiste |
| 3 | Alle Aufgaben | wie 1 mit Filter | Panel | wie 1 | Pfeil | D Aufgabenliste |
| 4 | Team | Personen finden, vergleichen | Tabelle | Avatar · Name + Notiz · Spalten · Status-Tag-Spalte | keins | A Datentabelle |
| 5 | Patient:innen | Personen finden, vergleichen | Tabelle | Name + geb./PG · Tag neben Name · Teilgruppen-Badge · Visiten-Balken | keins | A Datentabelle |
| 6 | MD-Prüfung › Vorbereitung | Lücken mit Sprungziel | flach | Farbpunkt · Titel + Unterzeile · Pfeil | Pfeil | B Objektliste |
| 7 | MD-Prüfung › Prüfungen | Einträge öffnen | Panel | „?“-Kreis · Datum + Unterzeile · Pfeil | Pfeil | B Objektliste |
| 8 | Kalender | Termine im Raster | Raster | Chips | Chip | eigener Typ, bleibt |
| 9 | Verwaltung › Qualifikationen | Katalog pflegen, sortieren | Panel | Griff · Titel + Unterzeile · Zähler · Pfeil | Pfeil | B Objektliste (Griff) |
| 10 | Verwaltung › Leistungen | wie 9 | Panel | Griff · Titel + Unterzeile · Zähler · **Button „Deaktivieren“** · Pfeil | Pfeil | B Objektliste (Griff) |
| 11 | Verwaltung › Kompetenzen | wie 9 | Panel | Griff · Titel + Unterzeile · Tag · Zähler · Pfeil | Pfeil | B Objektliste (Griff) |
| 12 | Verwaltung › Einweisungen | wie 9 | Panel | Griff · Titel (ohne Unterzeile) · Tag · Zähler · **Button „Zuordnen“** · Pfeil | Pfeil | B Objektliste (Griff) |
| 13 | Person › Kompetenzen | Einträge öffnen, mehrere auswählen | flach, Hairlines | Checkbox · Kürzel · Titel + Unterzeile · Meta-Text · Punkte · Stufen-Tag | keins | B Objektliste (Checkbox) |
| 14 | Person › Einweisungen | Einträge öffnen | Panel | Titel + Unterzeile · Fälligkeit · Status-Tag | keins | B Objektliste |
| 15 | Person › Historie | Chronologie, Einträge öffnen | flach, Linie | Datum links · Punkt · Titel + Unterzeile | Erklärungssatz | C Zeitleiste |
| 16 | Patient › Pflegevisiten | Chronologie, Einträge öffnen | Panel, Punkte | Punkt · Datum als Titel + Unterzeile · Status-Text rechts | keins | C Zeitleiste |
| 17 | Dialog „Passend zur Qualifikation“ | mehrere auswählen | flach | Checkbox · Titel + Unterzeile · zwei Tags | – | B Objektliste (Checkbox) |
| 18 | Dialog „Jahresnachweis“ | Kennzahlen | Tabelle + Punkte | Spalten | – | A Datentabelle (kompakt) |
| 19 | Patient-Dialog › Vereinbarte Leistungen | mehrere auswählen | Rahmen | Checkbox-Raster in Gruppen | – | Formularfeld, bleibt |

## Was auseinanderläuft

- **Zeilen-Anatomie.** Sieben Varianten für dieselbe Grundfigur „Titel mit Unterzeile, rechts Meta“. Das linke Element ist mal Avatar (4), Kreis (1), Farbpunkt (6), „?“-Kreis (7), Griff (9–12), Checkbox plus Kürzel (13) oder nichts (5, 14, 16).
- **Container.** Panel mit Rundung (1, 3, 7, 9–12, 14, 16), flach mit Hairlines (13), flach ohne Linien (2, 6), Zeitleiste mit Linie (15). Person › Kompetenzen und Person › Einweisungen liegen auf derselben Seite direkt nebeneinander und nutzen zwei Container.
- **Klick-Signal.** Pfeil rechts (1, 3, 6, 7, 9–12), gar nichts (4, 5, 13, 14, 16), ein Erklärungssatz (15: „Zeilen öffnen den Bearbeitungsdialog“). Team und Patient:innen sind vollständig klickbar, zeigen es aber nur per Hover.
- **Drei Zeitleisten.** Historie (Datum links, Linie), Pflegevisiten (Datum als Titel, Punkt ohne Linie, im Panel), Nächste 30 Tage (Datumsblock). Alle drei sind „Ereignisse in zeitlicher Reihenfolge“.
- **Aktionen in Zeilen.** Nur Leistungen („Deaktivieren“) und Einweisungen („Zuordnen“) haben Buttons in der Zeile, alle anderen Kataloge nicht.
- **Team vs. Patient:innen.** Beide Personentabellen, aber Avatar nur im Team; Status-Tag im Team als eigene Spalte, bei Patient:innen neben dem Namen; Unterzeile mal Notiz, mal Geburtsdatum.
- **Meta-Formate.** Person › Kompetenzen zeigt „zuletzt 2026-08-27 12:00:00“ als rohen Zeitstempel, überall sonst steht `27.08.2026`. Pflegevisiten zeigen „Geplant ·“ mit hängendem Trennzeichen. Patient:innen zeigen „geb. - · PG 4“ bei unbekanntem Geburtsdatum.

## Zieltypen

**A Datentabelle** (4, 5, 18). Eine Tabellenzeile für Personen: Avatar mit Initialen, Name mit Unterzeile, Fachspalten, Status-Tag als letzte Spalte. Zeile klickbar mit Hover, kein Pfeil, weil die Tabelle als Ganzes navigiert.

**B Objektliste** (1, 3, 6, 7, 9–14, 17). Eine Zeilenkomponente mit fester Anatomie: `[links: Griff | Checkbox | Statuspunkt | Kürzel | nichts] [Titel + Unterzeile] [Meta-Text] [Tag] [Pfeil]`. Regeln: immer im Panel mit Hairlines, Hover und Auswahl eckig über die volle Zeile; Pfeil genau dann, wenn Klick etwas öffnet; keine Buttons in der Zeile, Aktionen wie „Zuordnen“ und „Deaktivieren“ wandern in den Dialog, der sich beim Klick öffnet; Tag immer als letztes Element vor dem Pfeil. Die Aufgabenliste ist diese Zeile mit Kreis links.

**C Zeitleiste** (2, 15, 16). Datum in fester Spalte links, Punkt mit Typfarbe auf einer Linie, Titel mit Unterzeile, Status-Tag rechts. Zeile klickbar mit Hover, der Erklärungssatz entfällt. Pflegevisiten wechseln vom Panel auf diese Darstellung, Nächste 30 Tage nutzt die kompakte Form ohne Linie.

**Bleibt wie es ist:** Kalender (8), Kennzahlen-Balken auf der Übersicht, Checkbox-Raster im Patienten-Dialog (19).

## Umbau in Schritten

1. `ListRow`-Komponente und `Timeline`-Komponente in `src/components/ui`, CSS aus `cd-item`, `cd-selectable-row`, `cd-panel`, Historie und Pflegevisiten zusammenziehen.
2. Person › Kompetenzen, Person › Einweisungen, MD-Prüfung, Aufgaben und Vorschläge-Dialog auf `ListRow`. Roh-Zeitstempel und „Geplant ·“ dabei beheben.
3. Katalogseiten auf `ListRow` mit Griff; „Zuordnen“ und „Deaktivieren“ in den jeweiligen Dialog.
4. Historie, Pflegevisiten, Nächste 30 Tage auf `Timeline`.
5. Team und Patient:innen auf eine gemeinsame Tabellenzeile.

Schritte 1 und 2 sind der größte Gewinn für die Personenakte, Schritt 5 der größte für den Ersteindruck.
