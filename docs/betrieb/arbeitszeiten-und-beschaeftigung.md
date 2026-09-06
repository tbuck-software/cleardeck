# Arbeitszeiten und Beschäftigung erfassen

Stand: 06.09.2026, Arbeitsstand nach Release 2.0.0.

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

Hintergrund: [ADR 0004](../adr/0004-historische-stellenanteile-und-auswertungen.md), [Fehlerprüfung und Bedienwünsche](../reviews/2026-09-06-arbeitszeit-und-kompetenzbedienung.md).
