# Arbeitszeiten und Beschäftigung erfassen

Stand: 07.09.2026, ab Version 2.1.0.

Die Personenkopfzeile zeigt den ausgewählten Arbeitszeitstand mit Wochenstunden und VZÄ. Unter **Historie** stehen Beschäftigungsabschnitte, gültige Arbeitszeiten und Ereignisse gemeinsam nach ihrem fachlichen Datum. Eine Arbeitszeitzeile zeigt beispielsweise 18 Std./Woche und 0,50 VZÄ ab 01.09.2024 bis 31.12.2024; die nächste 36 Std./Woche und 1,00 VZÄ ab 01.01.2025.

## Arbeitszeit hinzufügen oder bearbeiten

1. Person öffnen und **Historie** wählen.
2. Zum Korrigieren die ganze Arbeitszeitzeile anklicken oder per Tab fokussieren und Enter beziehungsweise Leertaste drücken.
3. Zum Ergänzen **Eintrag hinzufügen → Typ: Arbeitszeit** wählen.
4. Gültigkeitsdatum, Wochenstunden und VZÄ eingeben und speichern. Bei aktiver Verknüpfung berechnet die App VZÄ aus den Stunden und dem eingestellten Bezugswert.

Eine Datumskorrektur verschiebt den ausgewählten Stand. Aus einem irrtümlichen Beginn am 01.03.2025 wird beispielsweise der richtige Beginn am 01.01.2025; ein zusätzlicher Märzstand bleibt dabei nicht zurück. Die Enden der benachbarten Abschnitte berechnet die App neu.

Existiert am Zieldatum schon ein anderer Stand, meldet die App den Konflikt und lässt beide Angaben unverändert. Dann den bereits vorhandenen Stand bearbeiten. Eine automatische Zusammenführung oder Löschfunktion gibt es hier nicht.

## Beschäftigung und Qualifikation

Das Gültigkeitsdatum muss innerhalb einer Beschäftigungsperiode liegen. Der passende Abschnitt wird aus Person und Datum ermittelt, auch wenn er eine andere Qualifikation enthält. Der Arbeitszeiteditor verändert keine Qualifikation oder Beschäftigungsgrenze. Einen falschen Eintritt am Beschäftigungseintrag in der Historie korrigieren.

Arbeitszeiten gelten mit dem Speichern als korrekte Eingaben. Eine Prüf-Checkbox und ein Belegfeld gibt es dafür nicht. In der Historie stehen die gültigen Arbeitszeitabschnitte. Frühere Korrekturfassungen bleiben intern gespeichert; sie erscheinen dort nicht zusätzlich als „Arbeitszeit erfasst“.

Hintergrund: [ADR 0004](../adr/0004-historische-stellenanteile-und-auswertungen.md).

## Beschäftigungsdaten zentral prüfen

Unter **Verwaltung → Datenprüfung** stehen die erkannten Auffälligkeiten aller Personen und Jahre. Die Prüfung schließt ausgeschiedene Personen und Personen ohne Beschäftigungsabschnitt ein. Die Seite ist auch über die Suche erreichbar.

**Fehler** sind sich überschneidende Beschäftigungsabschnitte derselben Person oder ein Beginn nach dem Ende. **Prüfhinweise** betreffen gleichnamige Personen und auffällige Übernahmen. Gleiche Namen beweisen keine doppelte Erfassung. Ein Paar gleichnamiger Personen erscheint in der Übersicht einmal.

Die Filter **Alle**, **Fehler** und **Prüfhinweise** sowie die Personensuche grenzen die Liste ein. Ein Klick auf einen Fund öffnet die **Historie** der betroffenen Person. Dort stehen die vorhandenen Korrekturen mit Vorschau bereit. Nach einer Korrektur wird die Prüfung mit den Teamdaten aktualisiert; **Erneut prüfen** lädt sie auch manuell neu.

Aufeinanderfolgende Arbeitszeitstände, etwa 80 % bis Ende Februar und 100 % ab März, sind kein Fehler. Die Prüfung kann fehlende oder bereits gelöschte Zeiträume nicht aus anderen Angaben rekonstruieren und prüft nicht, ob eine Berichtsmethode den Vorgaben eines Empfängers entspricht.


## Jahresnachweis nach Monatsenden

Unter **Team → Weitere Aktionen → Jahresnachweis erstellen** das gewünschte Jahr wählen. Standard ist **Durchschnitt aus 12 Monatsenden**. Für jeden Monatsletzten zählt der dann gültige Stellenanteil. Die zwölf Monatsendwerte werden addiert und durch zwölf geteilt, auch wenn in manchen Monaten niemand beschäftigt war.

Beispiel für 2025: Januar und Februar jeweils 0,8 VZÄ, März bis Dezember jeweils 1,0 VZÄ ergeben `(2 × 0,8 + 10 × 1,0) / 12 = 0,96667`, angezeigt als **0,97 VZÄ**. Eine Änderung am Monatsletzten gilt bereits für diesen Monat. Ein Austritt am Monatsletzten wird noch berücksichtigt. Beschäftigung ausschließlich zwischen zwei Monatsenden zählt in dieser Methode nicht.

**Personen an Monatsenden** zählt jede Person je Qualifikation einmal, wenn sie an mindestens einem Monatsende vertreten war. Die Gesamtzahl zählt jede Person einmal, auch bei einem Qualifikationswechsel. Das ist kein Durchschnitt der monatlichen Personenzahlen. Wer alle im Jahresverlauf Beschäftigten zählen möchte, wählt die taggewichtete Alternative und liest dort die Spalte **Personen**.

**Taggewichteter Jahresdurchschnitt** und **Stichtag 31.12.** bleiben im selben Dialog auswählbar. **Als Excel exportieren** übernimmt die ausgewählte Methode. Beim Monatsenddurchschnitt nennt das Blatt **Team** die berücksichtigten Monatsenden und deren Anzahl je Abschnitt.

Die Berechnung verwendet die hinterlegten Stellenanteile, ohne gesonderte Begrenzung auf SGB XI. Unbekannte Stellenanteile an Monatsenden machen den Bericht vorläufig.
