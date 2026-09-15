# Behebung und Vervollständigung der Arbeitsabläufe

Ergänzung vom selben Tag: Der [Upgrade- und Designbericht](2026-09-06-upgrade-171-180-und-design.md) dokumentiert die automatische Weiterführung von 1.7.1/1.8.0, weitere Darstellungskorrekturen und den abschließenden Stand von 297 Tests. Die unten genannten 288 Tests gehören zum ursprünglichen F01–F30-Abschluss.

Stand: 06.09.2026. Bezug: [Gesamt-Review F01 bis F30](2026-09-06-cleardeck-fachliches-gesamt-review.md), Ausgangscommit `d36919fa9055c315d36dea7e402b968f32c097af`. Die nachstehenden Änderungen liegen im Arbeitsbaum. Dieser Bericht dokumentiert Implementierung und Prüfung, keine Veröffentlichung einer neuen Version.

## Fachliche Korrekturen gegenüber dem ersten Review

F14 wurde durch die inzwischen ausgewerteten beruflichen Anforderungen präzisiert. Ab 36 Wochenstunden sollen ausdrücklich 1,0 VZÄ gelten, begrenzt auf höchstens 1,0. Die Schwelle bleibt erhalten. Korrigiert wurden die Erklärung des konfigurierbaren Bezugswerts und dessen Übernahme nach der Anmeldung. Historische Stundenstände werden davon unabhängig mit Gültigkeitsdatum geführt.

Die Originalvorlage berechnet einen taggewichteten Periodenanteil. Bereits gewichtete Excel-Werte dürfen nicht als unveränderlicher Stellenanteil übernommen werden. Die App bietet deshalb getrennt den Stichtag 31.12. und den taggewichteten Jahresdurchschnitt. Das konkrete Empfängerformular ist nicht belegt.

Die praktische Einarbeitung verwendet Stufen 1 bis 5 für laufende Einarbeitung und Stufe 6 für den bestätigten Abschluss. Frühere Stufen 0 bis 5 bleiben als Altmodell erkennbar. Ein Abschluss ersetzt keine gesetzliche oder vertragliche Einsatzberechtigung. Employee DB ist der frühere Name derselben App ClearDeck.

Herleitung: [berufliche Anforderungen](../anforderungen/kundengespraeche-2026-09-06.md), [ADR 0003](../../adr/0003-unterweisungsnachweise-und-einarbeitung.md), [ADR 0004](../../adr/0004-historische-stellenanteile-und-auswertungen.md).

## Zuordnung aller Befunde

| Befund | Umgesetzte Änderung | Prüfung |
| --- | --- | --- |
| F01 | Sicherung isoliert entschlüsseln, SQLite-Struktur und Verknüpfungen prüfen, migrieren und erst dann atomar installieren; aktueller Bestand bleibt bei Ablehnung erhalten | SQLite-/Dateisystemtests mit defekter Datei, falschem Schlüssel, fremder Datenbank und fehlgeschlagenem Austausch; echte Wiederherstellung |
| F02 | Eindeutige Sicherungsnamen; Wiederherstellungsquelle und Sicherheitskopie außerhalb der Aufbewahrungsbereinigung | Tests für mehrere Sicherungen derselben Minute und Wiederherstellung der ältesten Quelle |
| F03 | Keine automatische Befüllung mit Demopersonen | Leere neue Datenbank im Test und bei echter Ersteinrichtung |
| F04 | Berichtsjahr und Auswertungsart bestimmen Laden und Export gemeinsam | Typprüfung, Berichtstests und tatsächlicher Excel-Export 2024 |
| F05 | Stunden/VZÄ mit Gültigkeitsdatum und Belegreferenz je Beschäftigungsperiode; ungeprüfte Altwerte gekennzeichnet | Historientests und echte rückdatierte Änderung von 36 auf 18 Stunden |
| F06 | Beschäftigungsperioden bestimmen Eintritt, Austritt und Wiedereintritt; alte globale Ereignisse überschreiben sie nicht | Tests für Ende, Wiedereintritt und Überschneidungen |
| F07 | Stichtag 31.12. enthält nur zu diesem Datum Beschäftigte; Jahresübersicht und Durchschnitt sind ausdrücklich andere Auswertungen | Tests für unterjährigen Austritt und getrennte Berichtsarten |
| F08 | Bearbeitung einer Unterweisungsdefinition erhält Intervall, Quelle und Jugendregel | Repositoriumstest und durchgängige Übergabe im Formular |
| F09 | Entfernen betrifft genau einen Nachweiseintrag; Themen mit Nachweisen lassen sich nicht mitsamt der Historie löschen | SQLite-Test mit Durchführung und Wiedervorlage |
| F10 | Ergebnisse starten als nicht erfasst; Entwürfe und ungeprüfte Alteinträge erhalten kein A | Tests und tatsächlich gespeicherter leerer Prüfungsentwurf |
| F11 | Aufgaben ohne Begrenzung auf 20, einschließlich undatierter Einträge und fehlender Belege; ausgeschiedene Personen ausgeschlossen | Aufgaben- und Repositoriumstests |
| F12 | Versorgungsstatus, Ende und Leistungsumfang; Beenden archiviert und erhält Visiten | SQLite-Test für Archivierung, Filter und erhaltene Historie |
| F13 | Periodenänderung erhält nicht mitgesendetes Geburtsdatum | Historientest |
| F14 | Gewünschte 36-Stunden-Schwelle erhalten; Bezugswert nach Anmeldung laden und zutreffend erklären | VZÄ-Tests, Typprüfung und Formularprüfung |
| F15 | Mehrere HKP-Ziffern, AKI EV/MV sowie pHKP-Erstverordnung und Beginn | QPR-Tests, echte Erfassung B mit HKP 6 und 29, Excel-Prüfung |
| F16 | Einstufungsquelle, Datum und Begründung; alte Gutachten und unbekannte Angaben bleiben prüfbedürftig | QPR-/Datumsprüfungen und echtes Patientenformular |
| F17 | Sollzahlen ausschließlich als Orientierung für allgemeine Pflege; Bestände sind keine Ziehung; zusätzliche HKP-Merkmale werden getrennt gezählt | QPR-Seitentests und Sichtprüfung; besondere Vertragsauswahl ausdrücklich begrenzt |
| F18 | Prüfergebnisse ausdrücklich interne Zusammenfassung mit Originalberichtreferenz; kein offizielles Gesamturteil | Repositoriums- und UI-Tests, echte Entwurfserfassung |
| F19 | Geplant/durchgeführt getrennt; deterministische Reihenfolge; ältere offene Maßnahmen bleiben bis zur ausdrücklichen Erledigung bestehen | SQLite-Tests und echte Folgetermin-Erfassung bei offener Maßnahme |
| F20 | Ohne Aufnahme- oder durchgeführtes Visitendatum wird ein fehlender Ausgangstermin angezeigt | Datums-/Aufgabentests; Vorbereitung meldet fehlende Termine |
| F21 | Kalender berücksichtigt Mitarbeitenden-Geburtstage, Unterweisungsfristen und ablaufende Nachweise; Überfälliges bleibt sichtbar | Kalender-, Aufgaben- und SQLite-Tests |
| F22 | Kalendertage lokal statt über UTC ableiten; Monatswechsel beginnen am ersten Tag | Datumsprüfungen einschließlich Januarende und Zeitumstellung |
| F23 | Halbjährliche Jugendregel nur bei einschlägigen Gefahrenunterweisungen; alte fragliche Termine zur Prüfung markieren | Intervall- und Repositoriumstests; Primärquellen korrigiert |
| F24 | Einjährige Ausbildung gilt nicht allein wegen „examiniert“ als Pflegefachkraft | Qualifikations- und Integrationstest |
| F25 | Inhalt und Belegreferenz getrennt von Durchführung; fehlender Beleg bleibt offen; Originalnachweis bleibt maßgeblich | Tests und tatsächliche Erfassung mit automatischer Wiedervorlage |
| F26 | Formaterkennung, ursprünglicher Recovery-Key, vollständiges Neuladen nach Import und sichtbare automatische Backupfehler | Tests sowie echte Ablehnung mit falschem und Wiederherstellung mit ursprünglichem Schlüssel |
| F27 | Verschlüsselte Arbeitsdatenbank im Speicher; atomarer Snapshot vor erfolgreicher IPC-Antwort; Rücknahme bei Schreibfehler | SQLite-/Dateisystemtests und echte Prüfung ohne unverschlüsselte Arbeitsdatei |
| F28 | Excel enthält Zusammenfassung nach Qualifikation und Einzelabschnitte mit Berechnungsart, Tagen, Stellenanteil und Quelle | Arbeitsmappentests und zurückgelesener echter Export |
| F29 | Konfigurierbare Erinnerungsfrist wird in Aufgaben und Detailanzeige verwendet | Aufgaben- und Repositoriumstests |
| F30 | „Keine Vertretung vorhanden“ wird von „ungeklärt“ unterschieden | QPR-/Aufgabentests und tatsächliche Erfassung ohne falsche Kontaktaufgabe |

## Vollständigkeit der Arbeitsabläufe

| Arbeitsablauf | Durchgängiger Weg | Bewusste Grenze |
| --- | --- | --- |
| Ersteinrichtung | Leerer Personenbestand, Referenzkataloge, Verschlüsselung, Recovery-Key | Keine Übernahme privater Ausgangsdaten ohne Auswahl |
| Personal aufnehmen | Manuelle Anlage oder Excel-/CSV-Vorschau, Zeilenauswahl, Identitätszuordnung, gemeinsame Transaktion und Sicherheitskopie | Erstes Tabellenblatt, erkannte Spalten; unklare Originaldaten müssen berichtigt werden |
| Bestand nachpflegen | Gesamtliste aller jemals Beschäftigten, Qualifikation, Beschäftigungsperioden und Quellen | Dokumente bleiben im angegebenen Quellsystem |
| Änderungen und Korrekturen | Wirksamkeitsdatum, Belegreferenz, bisherige Stundenstände und Erfassungszeitpunkt | Unbelegte Altwerte werden nicht rückwirkend bestätigt |
| Austritt und Wiedereintritt | Ende der bisherigen Periode, neue nicht überlappende Periode; alte Berichtsjahre erhalten | Einträge in der Historie ersetzen keine Beschäftigungsperiode |
| Jahresnachweis | Alle verfügbaren Jahre, getrennte Auswertungsarten, Einzelabschnitte und Summenexport | Konkretes Empfängerformular betrieblich zu prüfen |
| Wiederkehrende Unterweisung | Zuordnung, Termin, Durchführung, Inhalt/Beleg, verknüpfte Wiedervorlage, Korrektur und einzelne Entfernung | Keine digitale Unterschrift oder vollständige Lernplattform |
| Praktische Einarbeitung | Themen zuordnen, Stufen fortschreiben, Verlauf, bestätigter Abschluss in Stufe 6 | Vertragliche Einsatzrechte werden nicht aus der Stufe abgeleitet |
| Nachweise und Fristen | Aufgaben und Kalender, undatierte sowie abgelaufene Einträge sichtbar | Betriebliche Fristen und Anwendbarkeit der Themen pflegt der Dienst |
| Klientenversorgung | Aufnahme, Leistungsumfang, Einstufung mit Herkunft, mehrere HKP-Leistungen, Versorgungsende/Archiv und erneute Aktivierung | Kein Ersatz für die vollständige Pflegedokumentation |
| Pflegevisite | Planung, Durchführung, Beobachtungen, Zuständigkeit, Maßnahmentermin und Erledigung | Keine Qualitätsbuchstaben aus einer internen Visite |
| QPR-Vorbereitung | Vollständigkeitsprüfung, aktive einbezogene Personen, alphabetischer Export mit fünf Spalten der Anlage 7 | Keine automatische MD-Ziehung; Sonderauswahl nach Kapitel 8.2/8.3 ausdrücklich nicht berechnet |
| Prüfergebnis nachhalten | Entwurf, Originalberichtreferenz, Abgleich, interne Zusammenfassung | Vollständige Einzelbefunde je Person/Aspekt verbleiben im Originalbericht |
| Sicherung und Rückkehr | Manuell/automatisch, eindeutige Stände, Fehleranzeige, validierte Wiederherstellung und ursprünglicher Schlüssel | Keine Bereitstellung eines externen Backup-Speichers |

## Bedienoberfläche

Geburtsdaten verwenden in Personen-, Patienten- und Übernahmeformularen denselben gestalteten Datumsbaustein. Alte Jahre lassen sich direkt eingeben, leere Angaben bleiben möglich, unbekannte Jahre werden nicht erfunden. Tatsächlich geprüft wurde unter anderem der 29.02.1940; Austritt und Geburtsdatum haben dieselbe Feldhöhe und Gestaltung.

Dauerhafte Erklärungstexte wurden gekürzt. Berechnungsregeln, Einstufungskriterien und rechtliche Hintergründe stehen in nativen, per Tastatur bedienbaren aufklappbaren Hilfen. Konkrete Datenlücken, ungeprüfte Stellenanteile und Fehler bleiben unmittelbar sichtbar.

## Validierung

Die [Prüfübersicht als JSON](2026-09-06-cleardeck-behebung-evidence.json) enthält die Testzahlen und tatsächlich durchgespielten Fälle.

- Gesamtlauf: 52 Testdateien mit 288 Tests. Zusätzliche Integritätstests arbeiten mit echter SQLite-Datenbank und temporären Dateien. Für Node-Tests wird ein Adapter verwendet; zusätzlich wurde die Anwendung mit Electron und ihrem nativen SQLite-Modul geprüft.
- TypeScript ohne Fehler, ESLint ohne Fehler oder Warnungen, Renderer-/Preload-Build erfolgreich.
- Electron unter macOS mit neuem getrenntem Profil und ausschließlich synthetischen Personen: Ersteinrichtung, alte Geburtsdaten, datierte Stundenänderung, Nachweis/Wiedervorlage, Klient mit mehreren HKP-Ziffern, offene Maßnahme mit zukünftigem Visitenplan, leerer Prüfungsentwurf, Tabellenübernahme, historische Gesamtliste, Excel-Exporte, Sperren/Anmelden sowie Wechsel der Verschlüsselung und Wiederherstellung geprüft.
- Die Dateiauswahl wurde bei den Export-/Importprüfungen im Testprozess auf temporäre Pfade gelenkt. Formulare, IPC, Datenbank, Parser und Dateischreiben liefen tatsächlich. Der native Betriebssystem-Dateidialog selbst war nicht Gegenstand dieser Prüfung.
- Reale Daten der privaten Quellunterlagen und Schlüssel wurden nicht in die Ergebnisartefakte übernommen.

Kein Windows- oder macOS-Installationspaket wurde neu veröffentlicht. Ein vollständiger Test mit dem tatsächlichen produktiven Altbestand und den Verträgen des Dienstes ist damit nicht behauptet. Für die erste Übernahme gilt die [Betriebsanleitung](../../anleitung/datenuebernahme-und-sicherung.md).
