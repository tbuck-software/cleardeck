# Anforderungen

ClearDeck richtet sich an kleine ambulante Pflegedienste. Leitung und Qualitätsmanagement sollen Personal, Nachweise und die Vorbereitung von Qualitätsprüfungen an einem Ort führen, ohne verstreute Excel-Listen und ohne ein vollständiges HR-System.

Die fachlichen Begriffe stehen in [CONTEXT.md](../CONTEXT.md), die daraus getroffenen Entscheidungen in den [ADRs](adr/).

## Ausgangslage

- Verwaltungssoftware zeigt meist nur den aktuellen Personalstand. Frühere Beschäftigungen, Stellenanteile und Qualifikationen müssen aus Personalunterlagen zusammengesucht werden.
- Jahresauswertungen für abgeschlossene Geschäftsjahre brauchen die damals gültigen Werte, nicht den heutigen Stand.
- Tabellen stoßen an Grenzen, sobald Beziehungen mehrdimensional werden, etwa Person, Zeitraum, Qualifikation und Nachweis.
- Allgemeine Fortbildungen werden oft in einer eigenen Schulungsplattform geführt. ClearDeck ersetzt diese nicht, sondern verweist auf den Beleg.

## Personal und Beschäftigung

- Alle jemals Beschäftigten führen, auch ausgeschiedene.
- Eintritt, Austritt, Wochenstunden, Stellenanteil und Qualifikation jeweils mit Gültigkeitsdatum erfassen. Korrekturen bleiben im Änderungsverlauf nachvollziehbar.
- Nach Zeitraum und Qualifikation filtern: Wer war im gewählten Jahr ganz oder teilweise beschäftigt?
- Vollzeitäquivalente (VZÄ) aus der Arbeitszeit berechnen, taggenau über den Zeitraum gewichtet. Ab 36 Wochenstunden zählt eine Person als 1,0; das ist eine betriebliche Regel, keine gesetzliche Definition.
- Herkunft und Belegverweis einer Angabe festhalten, z. B. Personalakte oder Dokumentenablage. Dokumente werden verlinkt, nicht verändert.
- Auffällige oder unvollständige Daten als Aufgabe anzeigen, statt sie stillschweigend als Nullwert zu behandeln.
- Bestehende Listen aus Excel oder CSV mit Vorschau übernehmen.

## Nachweise, Einweisungen und Einarbeitung

- Einweisungen und Unterweisungen je Person mit Durchführung, Inhalt, durchführender Person und Belegverweis erfassen.
- Wiederholungsintervalle gehören zur jeweiligen Definition und stützen sich auf eine benannte Rechts- oder Betriebsgrundlage ([ADR 0002](adr/0002-unterweisungsintervalle-und-wiedervorlage.md)).
- Fällige und überfällige Nachweise je Person und übergreifend überblicken.
- Praktische Einarbeitung ist ein eigener Vorgang neben Einweisungen und Fortbildungen. Kompetenzen werden stufenweise bestätigt; ein Abschluss verlangt Datum und verantwortliche Person ([ADR 0003](adr/0003-unterweisungsnachweise-und-einarbeitung.md)).
- Mehrere Kompetenzstufen einer Person gemeinsam ändern.

## Patient:innen und Qualitätsprüfung

- Eine stichtagsbezogene Personenliste für die Qualitätsprüfung nach QPR vorbereiten. Sie wird eigenständig gepflegt und muss nicht mit einer Pflegesoftware integriert sein.
- Stichprobenmerkmale wie Mobilität, Kognition und aufwändige Leistungen anklickbar erfassen. Sie sind keine Qualitätsbewertung ([ADR 0001](adr/0001-qpr-stichprobe-pflegevisite-und-pruefergebnisse.md)).
- Vereinbarte Leistungen je Person aus einem pflegbaren Leistungskatalog wählen.
- Pflegevisiten mit Beobachtungen und offenen Maßnahmen nachverfolgen.
- Externe Prüfergebnisse je Qualitätsaspekt erfassen und mit dem Originalbericht verknüpfen.
- Pflegevisite bei Patient:innen und Mitarbeitervisite sind verschiedene Arbeitsfälle.

## Datenschutz und Betrieb

- Die App läuft lokal auf betrieblichen Rechnern, ohne Pflicht zu einem Cloud-Dienst.
- Die lokale Datenbank ist standardmäßig verschlüsselt und wird erst nach der Anmeldung geöffnet.
- Sicherungen lassen sich erstellen, prüfen und wiederherstellen. Updates übernehmen den vorhandenen Bestand automatisch.
- Mehrere Geräte können optional einen selbst gehosteten Server mit persönlichen Konten und Rollen nutzen ([Serverbetrieb](server/server-mode.md)).
- Plattform: Windows zuerst, macOS und Linux über Electron.
- Exporte als Excel oder CSV.

## Nicht-Ziele

- Kein HR- oder Lohnabrechnungssystem und keine Abbildung von Vertragsversionen.
- Keine Pflegedokumentation und keine Tourenplanung.
- Keine automatische Texterkennung aus gescannten oder handschriftlichen Unterlagen.

## Offene Fragen

- Die verbindliche Kennzahl für Jahresberichte an Kostenträger, insbesondere Teilmonate und Jahresdurchschnitte.
- Die fachliche Benennung der Einarbeitungsstufen und die Rollen für Bestätigungen.
- Ein betrieblich verbindlicher Katalog der Nachweise mit geprüften Intervallen.
