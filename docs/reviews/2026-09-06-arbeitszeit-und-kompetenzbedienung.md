# Arbeitszeitverläufe und gemeinsame Kompetenzänderungen

Stand: 06.09.2026. Anlass ist die Rückmeldung zu einer vor März 2025 nicht auswählbaren Arbeitszeitänderung und der Wunsch, mehrere Kompetenzen gemeinsam einzustufen. Dieses Dokument trennt den geprüften Iststand vom Gestaltungsvorschlag. Die Checkbox und zwei Fehler beim Bearbeiten von Arbeitszeiten sind im Arbeitsstand behoben. Der eigene Arbeitszeiteditor ist ebenfalls umgesetzt. Gemeinsame Kompetenzänderungen wurden am 07.09.2026 anschließend umgesetzt; die abschließende Sichtprüfung steht noch aus.

## Dokumentationsstand

Die fachlichen Grundlagen sind vorhanden: [ADR 0004](../adr/0004-historische-stellenanteile-und-auswertungen.md) beschreibt historische Arbeitszeiten und Auswertungen, [ADR 0003](../adr/0003-unterweisungsnachweise-und-einarbeitung.md) die Einarbeitungsstufen. Der [Behebungsbericht](2026-09-06-cleardeck-behebung.md) dokumentiert bisherige Implementierung und Prüfungen.

Für diese Arbeitsfälle fehlt jedoch eine zusammenhängende Bedienbeschreibung mit konkreten Beispielen. Die Historie mischt Beschäftigungsperioden und Ereignisse; das Personenformular verbindet Stammdaten mit einer datierten Arbeitszeitänderung. Die vorhandene Dokumentation erklärt diese Bediengrenzen nicht ausreichend. Die erneute Prüfung ist auf diese Arbeitsfälle begrenzt und bestätigt nicht die Vollständigkeit der gesamten App-Dokumentation.

## Arbeitszeit ist bereits zeitbezogen gespeichert

Die App unterscheidet drei Sachverhalte:

- Beschäftigung mit Eintritt, Austritt und gegebenenfalls Wiedereintritt.
- Arbeitszeitstände innerhalb einer Beschäftigungsperiode mit Gültigkeitsdatum, Wochenstunden und VZÄ.
- Das Änderungsprotokoll mit früheren Fassungen und Erfassungszeitpunkten.

Die Jahresauswertung verwendet die wirksamen Arbeitszeitstände. Ein frei formulierter Eintrag im Protokoll ersetzt keinen solchen Stand. Arbeitszeitänderungen erzeugen ihrerseits nachvollziehbare Ereignisse.

Für das gemeldete Beispiel ist eine durchgehende Beschäftigung ab 01.09.2024 mit diesen Arbeitszeitabschnitten vorgesehen:

| Von | Bis | Wochenstunden | Stellenanteil |
| --- | --- | ---: | ---: |
| 01.09.2024 | 31.12.2024 | 18 | 50 % |
| 01.01.2025 | offen | 36 | 100 % |

Die 18 Stunden ergeben sich hier aus dem ausdrücklich genannten Vollzeitmaß von 36 Stunden. Eine Stundenänderung allein ist kein Austritt und Wiedereintritt. Intern genügt ein Gültigkeitsbeginn je Stand; das Ende folgt aus dem nächsten Stand beziehungsweise dem Beschäftigungsende. Eine Oberfläche kann daraus verständliche Von-/Bis-Zeiträume darstellen.

Fundstellen im Code: [Arbeitszeitstände und Auswertungen](../../src/main/repositories/employees.ts), [Datenmodell](../../src/main/database/migrations/v017_employment_terms.ts), [Korrekturhistorie](../../src/main/database/migrations/v020_employment_provenance.ts), [Änderungsereignisse](../../src/main/employeeHistory.ts).

## Datumsgrenze und Speichern

Das [Personenformular](../../src/components/modals/EmployeeModal.tsx) begrenzt das Gültigkeitsdatum über den Beginn und das Ende der ausgewählten Beschäftigungsperiode. [useEmployees](../../src/hooks/useEmployees.ts) übernimmt diese Werte bei der Personenauswahl in den Formularzustand. Das Repository prüft dieselbe fachliche Grenze beim Speichern. Es gibt keine fest programmierte Untergrenze März 2025.

Mit einer synthetischen Testperson wurde der Fehler per Computer Use in der laufenden macOS-Demo reproduziert: Eintritt zunächst 01.03.2025, anschließend in der Historie auf 01.09.2024 korrigiert. Die Historie zeigte September, die Personenauswahl und ihr Formular enthielten weiterhin März. Im Kalender war „Vorherigen Monat anzeigen“ bei März 2025 deaktiviert. Damit ist ein Ablauf nachgewiesen, der das gemeldete Symptom erzeugt. Ob die Rückmeldung auf genau diesen Ablauf zurückgeht, ist ohne den betroffenen Bestand weiterhin unbekannt.

Behoben: Nach einer Korrektur der ausgewählten Beschäftigungsperiode aktualisiert [useEventsPeriods](../../src/hooks/useEventsPeriods.ts) sofort Personenauswahl und Formulargrenzen. Das verhindert auch, dass ein anschließendes Speichern der Person den alten Eintritt zurückschreibt. Die Zuordnung verwendet die Perioden-ID; eine andere Periode derselben Person wird nicht versehentlich ausgewählt.

Auch reine Änderungen des Gültigkeitsdatums werden jetzt gespeichert. Zuvor übertrug das Personenformular bei unveränderten Stunden und fehlender Checkbox-Bestätigung updateHours=false und verwarf solche Änderungen. Der neue Speicherweg unterscheidet die Eingabe beim Öffnen von einer ausdrücklichen Änderung. Eine Änderung von Name oder Notiz allein erzeugt keinen neuen Arbeitszeitstand.

## Bestätigung ohne Checkbox

Auf Wunsch des Produktverantwortlichen entfällt die zusätzliche Bestätigung. Manuell eingetragene oder geänderte Arbeitszeitdaten gelten beim Speichern als bestätigt. Übernommene frühere Werte werden dadurch nicht pauschal bestätigt. Das automatisch erfasste Speicherdatum bleibt erhalten. Das Textfeld „Personalbeleg“ und seine Historien-Spalte entfallen ebenfalls, weil ClearDeck hier keine Belegablage bietet. Die Entscheidung ist in [ADR 0004](../adr/0004-historische-stellenanteile-und-auswertungen.md) ergänzt.

## Arbeitszeitstände in der vorhandenen Historie bearbeiten

Die separate Arbeitszeittabelle entfällt. Die vorhandene Historie zeigt die gültigen Arbeitszeitabschnitte nach ihrem Gültigkeitsbeginn, gemeinsam mit Beschäftigung und Ereignissen. Die Kopfzeile enthält weiterhin die Wochenstunden und VZÄ der Person. Die ganze Arbeitszeitzeile öffnet den Editor, auch per Enter oder Leertaste. Neue Stände werden über **Eintrag hinzufügen → Typ: Arbeitszeit** ergänzt.

Korrekturen verwenden die stabile ID des Arbeitszeitstands. Beim Verschieben seines Beginns wird der bestehende Datensatz aktualisiert. Ein gleicher Beginn bei einem anderen Stand wird als Konflikt abgewiesen, bevor Daten verändert werden. Eine Korrektur ändert weder Name noch Qualifikation noch Beschäftigungsgrenzen. Der passende Beschäftigungsabschnitt wird anhand von Person und Gültigkeitsdatum ermittelt; das erlaubt auch Korrekturen über eine Qualifikationsgrenze hinweg.

In der Historie stehen die gültigen Angaben, keine zusätzlichen Meldungen zum Erfassungszeitpunkt. Frühere Korrekturfassungen bleiben intern gespeichert. Ein eigener Verlauf, Aufklapper oder History-Button entfällt. Doppelte Stunden-/VZÄ-Ereignisse für bereits dokumentierte Arbeitszeitstände werden ausgeblendet.

Die Speicherung bleibt zunächst abschnittsbezogen. Arbeitszeit und Qualifikation sind damit in der Bedienung getrennt, aber noch nicht vollständig im Datenmodell. Der Bestand wird nicht automatisch zusammengeführt. Siehe [ADR 0004](../adr/0004-historische-stellenanteile-und-auswertungen.md).

## Kompetenzen gemeinsam ändern

Im [Vorschlagsdialog](../../src/components/modals/RecommendedCompetenciesModal.tsx) gibt es bereits **Alle aktivieren**. Das ordnet ausgewählte Kompetenzen ohne Einstufung zu. Der Speicherablauf in [useEmployees](../../src/hooks/useEmployees.ts) setzt dabei level=null. Für eine gemeinsame Änderung bestehender Stufen gibt es jetzt die Checkbox-Auswahl in der Kompetenzliste.

Nach der angeforderten Recherche wurde die Umsetzung am 07.09.2026 beauftragt. Der Schwerpunkt liegt auf beliebigen Teilmengen; „Alle auswählen“ ist eine Abkürzung. Checkboxen sind von der weiterhin bearbeitbaren Zeilenfläche getrennt. Recherche und vorläufige Empfehlung stehen in [Sammeländerungen für Kompetenzen](../research/kompetenzen-sammelaenderung-ux.md). Die anschließende Entscheidung steht in ADR 0003.

Die Bedeutung der Stufe ist noch fachlich zu beachten:

- Altmodell: Stufe 5 bedeutet **Kann anleiten**.
- Neues Einarbeitungsmodell: Stufen 1 bis 5 bedeuten laufende Einarbeitung; Stufe 6 heißt **Abgeschlossen** und verlangt Datum und bestätigende Person.

Fundstellen: [Stufenauswahl](../../src/components/ui/CompetencyLevelPicker.tsx), [Kompetenzformular](../../src/components/modals/EmployeeCompetencyModal.tsx), [Speicherung und Verlauf](../../src/main/repositories/competencies.ts). Der Wunsch „alle auf 5“ darf deshalb nicht ungeprüft zwischen den Modellen übertragen werden. Die Rückmeldung allein ändert die in ADR 0003 festgehaltene Bedeutung nicht. Für eine einheitliche Einstufung muss feststehen, ob die fachliche Befähigung oder der Abschluss der Einarbeitung gemeint ist.

## Prüfung und nächste Umsetzung

Die vier zunächst fehlschlagenden Regressionstests belegten die veraltete Datumsgrenze sowie ignorierte beziehungsweise unbestätigte Arbeitszeitänderungen. Nach der Korrektur bestand die Gesamtprüfung mit 318 Tests in 55 Dateien. Nach dem anschließenden Entfernen des Belegfelds entfällt dessen Eingabetest; die sieben verbleibenden Tests in useEmployees.test.ts, TypeScript und die Lint-Prüfung der betroffenen Dateien bestehen.

[useEmployees.test.ts](../../src/hooks/__tests__/useEmployees.test.ts) prüft den verbundenen Ablauf von Periodenkorrektur und anschließendem Personenformular, einschließlich einer außerhalb der Jahresliste liegenden Periode. Weitere Fälle prüfen Datum, Stunden und eine bloße Namensänderung. [employmentHistoryIntegrity.test.ts](../../src/main/__tests__/employmentHistoryIntegrity.test.ts) prüft zusätzlich 18 Stunden ab September 2024, 36 Stunden ab März 2025 und die nachgetragene Gültigkeit derselben 36 Stunden ab Januar. Der Bestand Ende 2024 bleibt bei 0,5 VZÄ; der Jahresdurchschnitt 2025 beträgt 1,0 VZÄ.

Die erneute Bedienprüfung in der macOS-Demo gelang ohne erneute Personenauswahl nach der Periodenkorrektur: Von März konnte nach Februar zurückgeblättert werden. Danach wurden unveränderte 36 Stunden ab 01.01.2025 und 18 Stunden / 0,50 VZÄ ab 01.09.2024 gespeichert; beide wurden gespeichert und erschienen im Verlauf. Die Checkbox und der zunächst ergänzte Formularhinweis fehlen. Eine kurze Erklärung steht ausschließlich in der Hilfe. Das Feld „Personalbeleg“, die zugehörige Verlaufsspalte und die Statusfloskeln „Quelle nicht hinterlegt“, „bestätigt“ und „ungeprüft“ entfallen dort. Die betroffene Windows-Installation wurde nicht direkt geprüft.

Der [Bedienweg für Arbeitszeiten](../betrieb/arbeitszeiten-und-beschaeftigung.md) erklärt Beschäftigungsgrenzen, Arbeitszeitstände und das Protokoll. Der [Bedienweg für gemeinsame Kompetenzänderungen](../betrieb/kompetenzen-gemeinsam-aendern.md) ist ergänzt. Der neue Arbeitszeiteditor ergänzt und korrigiert einzelne Stände. Eine Lösch- oder Zusammenführungsfunktion gehört noch nicht dazu.


Nach der letzten Anpassung öffnet **Eintrag hinzufügen** direkt **Neuer Eintrag**. **Arbeitszeit** ist dort eine Option im Feld **Typ**. Der Ablauf wurde in der macOS-Demo per Computer Use geprüft. Der Formular-Test prüft den Wechsel von Periode zu Arbeitszeit und das Speichern von 18 Stunden / 0,5 VZÄ. Die abschließende Gesamtprüfung besteht mit 327 Tests in 57 Dateien; TypeScript, Lint der zuletzt geänderten UI-Dateien und `git diff --check` bestehen. Eine vollständige Prüfung des neu hinzugezogenen Admin-Interface-Leitfadens ist damit nicht behauptet: Der gemeinsame Dialog besitzt bisher insbesondere keinen Fokusfang und keinen Schutz vor dem Verwerfen ungespeicherter Eingaben. Diese Anforderungen sind für den geplanten Sammeleditor zu berücksichtigen.


## Kompetenzänderung vom 07.09.2026

Die Kompetenzliste hat einzelne Checkboxen sowie eine Kopfcheckbox mit gemischtem Auswahlzustand. Die Aktion nennt die Anzahl und öffnet einen kurzen Editor. Alte und aktuelle Stufen erhalten bei gemischter Auswahl getrennte Felder, zunächst „Beibehalten“. Ein gemeinsamer Abschluss verlangt Datum und bestätigende Person. Die übrige Zeilenfläche öffnet weiterhin die Einzelbearbeitung. Auswahl und Eingaben bleiben nach einem Speicherfehler erhalten; Schließen schützt ungespeicherte Eingaben. Der Sammeleditor aktiviert Fokusbegrenzung und Fokusrückkehr im gemeinsamen Dialog. Andere bestehende Editoren werden dadurch nicht pauschal umgestellt.

Die API prüft Zuordnung und Stufenmodell und speichert sämtliche Änderungen sowie ihre Verläufe in einer Transaktion. Unbeteiligte Kompetenzen und vorhandene Metadaten bleiben erhalten; gleiche Werte erzeugen keinen neuen Verlauf. Der bisherige Einzel-Speicherweg verwendet weiterhin dieselben Validierungen.

Die Tests prüfen freie Teilmengen, Auswahl aller mit anschließendem Abwählen, unveränderten Zeilenklick, getrennte Modelle, explizite Abschlussangaben, Fehler mit erhaltenem Entwurf, Verwerfen und Tastaturfokus. SQLite-Tests prüfen atomare Rücknahme bei Fehlern, ungültige Daten, fremde oder entfernte Zuordnungen, unveränderte Metadaten und Verlaufserhaltung. Die Sichtprüfung in der laufenden Demo konnte noch nicht stattfinden: Computer Use meldete einen gesperrten Mac. Eine visuelle Abnahme auf Desktop und schmaler Ansicht wird daher noch nicht behauptet.

Abschließende automatisierte Prüfung des Kompetenzstands: **341 Tests in 59 Dateien bestanden**, außerdem TypeScript, Lint der betroffenen Kompetenz-/Dialogdateien und `git diff --check`. Die Sichtprüfung bleibt aus dem oben genannten Grund offen.


## Nachgeholte Desktopprüfung und Screenshots

Am 07.09.2026 um etwa 00:13 Uhr war die macOS-Demo wieder erreichbar. Der Testperson wurden 67 vorgeschlagene Kompetenzen zugeordnet. Ganzwaschung, Teilwaschung und Ausscheidungen wurden anschließend per separater Checkbox ausgewählt und gemeinsam auf Stufe 5 gespeichert. Oberfläche und direkte SQLite-Abfrage bestätigen diese drei Änderungen; Einarbeitung und die übrigen Zuordnungen behielten ihre Werte. Der Dialog setzte den Eingabefokus auf die Stufenauswahl und schloss nach erfolgreichem Speichern.

Unbearbeitete Screenshots der laufenden Demo mit synthetischen Daten:

- [Drei Kompetenzen auswählen](screenshots/2026-09-07-kompetenzen/01-auswahl.jpeg)
- [Gemeinsame Zielstufe](screenshots/2026-09-07-kompetenzen/02-stufe-aendern.jpeg)
- [Gespeichertes Ergebnis](screenshots/2026-09-07-kompetenzen/03-gespeichert.jpeg)

Die Desktopansicht wurde bei 1280 × 705 Pixeln aufgenommen. Eine gesonderte Prüfung bei schmaler Ansichtsbreite steht weiterhin aus.

Auch bei gesetzter Checkbox öffnete der anschließende Klick auf die Ganzwaschungszeile den Einzel-Editor mit Stufe 5 und zwei Verlaufsständen. Der Editor wurde ohne weitere Änderung geschlossen.
