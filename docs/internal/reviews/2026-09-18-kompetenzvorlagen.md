# Kompetenzvorlagen, Ticket #33

Stand: 18.09.2026. Lokaler Arbeitsstand, noch nicht veröffentlicht. Keine verbindlichen HKP-Leistungsfreigaben importiert.

## Umsetzung

- Sichtbarer Einstieg „Kompetenzen aus Vorlage“, auch wenn bereits alles zugeordnet ist.
- Vorschau mit aktueller Qualifikation, unabhängig verfügbaren Berufsgruppen, neuen Einträgen und vorhandenen Zuordnungen. Ein Gruppenwechsel verwirft die Auswahl, verändert aber keine Personalstammdaten.
- Pflegefachassistenz wird nicht mehr als Pflegefachkraft erkannt und besitzt eine eigene Katalogrelevanz.
- Sammelzuordnung erfolgt in einer Transaktion. Bereits vorhandene Bewertungen und deren Verlauf bleiben vollständig erhalten. Neue Einträge starten unbewertet.
- Die bestehende Stufenänderung und beide Stufenmodelle bleiben erhalten.

## Prüfung

TypeScript und ESLint für die geänderten Produktionsdateien bestanden; `git diff --check` ohne Befund. Gesamte Vitest-Suite: 94 Dateien, 630 Tests bestanden. Neue Fälle prüfen Wiederholung, zwischenzeitliche Bewertung, Rollback, Gruppenwechsel, Speicherfehler und die Verfügbarkeit der Assistenzvorlage beim ursprünglichen Qualifikationskatalog.

Browserprüfung über Playwright mit den tatsächlichen Dialogkomponenten und Styles, synthetischen Daten und isolierter Vorschauseite. Geprüft: 1100 × 850 sowie 390 × 844, Sammelauswahl, Gruppenwechsel mit zurückgesetzter Auswahl und Schließen per Escape. Dies ist keine vollständige Electron- oder Server-Ende-zu-Ende-Prüfung. Lokale Bildnachweise liegen unter `output/playwright/issue-33/`: `before.png`, `after.png`, `after-narrow.png`.

## Standards

Unabhängige Prüfung ohne belastbare Findings. Bestehende Datenzugriffs-, Transaktions- und UI-Muster werden verwendet.

## Spec

Ein Befund: Die Assistenzvorlage war zunächst nur mit entsprechend benannter, bereits konfigurierter Qualifikation erreichbar. Behoben durch unabhängig verfügbare Berufsgruppen; Regressionstest bestanden und erneute unabhängige Prüfung ohne verbleibenden Blocker.

## Verbleibender fachlicher Umfang

Der [NRW-Quellenabgleich](../../fachwissen/hkp-kompetenzvorlagen-nrw.md) begründet, warum die vorläufige LG-Tabelle nicht als verbindliche Regel übernommen wird. Für diesen Teil von #33 fehlen weiterhin vollständige aktuelle Vertragsanlagen und der Nachweis ihrer Anwendbarkeit. Die technische Vorlagenfunktion ist davon unabhängig nutzbar. Ticket #33 wurde nicht geschlossen.
