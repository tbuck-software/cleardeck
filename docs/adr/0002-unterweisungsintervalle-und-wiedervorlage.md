# Unterweisungsintervalle gehören an die Definition, nicht an die App

Stand: 05.09.2026. Bezug: [Recherche zu Wiederholungsintervallen](../fachwissen/unterweisungsintervalle-ambulante-pflege.md), dort sind alle Fundstellen im Wortlaut belegt.

Anlass war eine Entwurfsvorlage, die im Einweisungsdialog pauschal „Nach Abschluss automatisch in 12 Monaten wieder fällig" anbot. Die Recherche zeigt, dass diese Zahl für einen erheblichen Teil des mitgelieferten Katalogs falsch ist — in beide Richtungen. Dieses ADR hält die daraus abgeleiteten Produktentscheidungen fest. Es trifft keine Rechtsaussagen; die stehen in der Recherche.

**Dokumentationsstatus:** Ursprünglicher Stand der Migrationen v015/v016; am 06.09.2026 fachlich korrigiert. Die Anwendung der Jugendregel und Belegführung präzisiert [ADR 0003](0003-unterweisungsnachweise-und-einarbeitung.md).

## 1. Das Intervall ist eine Eigenschaft der Einweisung, nicht der App

Die Vorlage nahm ein globales Intervall an. Belegt sind stattdessen mindestens drei verschiedene Fristen und eine Gruppe ganz ohne Frist:

- 12 Monate bei Arbeitsschutz, Brandschutz, Hygiene und Gefahrstoffen (DGUV V1 § 4 Abs. 1, ArbStättV § 6 Abs. 4, BioStoffV § 14 Abs. 3, GefStoffV § 14 Abs. 2)
- in der Regel 24 Monate bei der Ersthelfer-Fortbildung (DGUV V1 § 26 Abs. 3, mit Anerkennungsvoraussetzungen aus Satz 3) und 24 Monate bei der Belehrung nach IfSG § 43 Abs. 4
- höchstens 6 Monate für Gefahrenunterweisungen bei Beschäftigten unter 18 (JArbSchG § 29 Abs. 2)
- kein Intervall bei Medizinprodukten, Datenschutz, Schweigepflicht und allen Einträgen ohne Rechtsgrundlage

Entscheidung: `instruction_definitions.intervalMonths INTEGER NULL`.

## 2. NULL heißt „kein festes Intervall" und wird nie stillschweigend zu 12

`NULL` ist ein zulässiger, fachlich richtiger Zustand, kein fehlender Wert. Die Oberfläche behandelt ihn nicht als Fehler, ergänzt keinen Vorschlagswert und erzeugt keine Fälligkeit.

Der wichtigste Fall ist die **Medizinprodukte-Einweisung**: Die MPBetreibV kennt in der Neufassung 2025 keine Wiederholung nach Zeitablauf. Ein Zwölfmonatszähler würde dort eine Fälligkeit behaupten, die keine Norm verlangt, und im Gegenzug den tatsächlichen Auslöser verdecken — ein neues, nicht baugleiches Produkt oder eine relevante Softwareaktualisierung.

## 3. Die Herkunft des Intervalls wird mitgeführt

`intervalSource TEXT` mit zwei Werten: `norm` (aus einer Rechtsgrundlage abgeleitet) und `betrieblich` (eigene Festlegung des Dienstes).

Grund: In einer Prüfung ist der Unterschied entscheidend. Eine Zahl aus der Norm ist zu belegen, eine betriebliche Festlegung ist zu begründen. Ohne dieses Feld sind im Katalog beide nicht auseinanderzuhalten — genau das war die Ausgangslage, in der „IfSG / KRINKO" jahrelang als Grundlage der Hygieneunterweisung geführt wurde, wobei die jährliche Unterweisungsfrist aus dem Arbeitsschutzrecht folgt. Infektionsprävention und Hygienepläne ambulanter Dienste sind zusätzlich in IfSG § 35 geregelt.

## 4. Unter 18 wird personenbezogen gedeckelt, nicht über das Intervall

JArbSchG § 29 Abs. 2 betrifft die Gefahrenunterweisungen nach Absatz 1. Die frühere Verallgemeinerung auf alle Themen war falsch. ClearDeck kennzeichnet deshalb an der Definition, ob sie eine solche Gefahrenunterweisung ist.

Entscheidung: Bei der Berechnung der nächsten Fälligkeit gilt `min(intervalMonths, 6)`, wenn die Definition eine Gefahrenunterweisung bezeichnet und die Person **am Tag der Durchführung** noch nicht 18 ist. Ohne allgemeines Intervall werden in diesem Fall sechs Monate angesetzt.

Maßgeblich ist bewusst der Durchführungstag und nicht der Fälligkeitstag: Die Norm verlangt die Wiederholung, *solange* die Person minderjährig ist. Bei einer entsprechend eingestuften Gefahrenunterweisung mit zweijährlichem Katalogintervall wäre eine sechzehnjährige Person am regulären Termin längst volljährig — eine Prüfung am Fälligkeitstag ließe sie also zwei Jahre ohne Unterweisung, genau die Lücke, die § 29 Abs. 2 schließen soll.

Das Geburtsdatum liegt seit Migration v009 vor. Fehlt es, greift die Deckelung nicht — die App rät kein Alter.

## 5. Abschluss erzeugt einen Folgeeintrag

Beim Abschließen einer Einweisung mit Intervall entsteht ein **neuer** Eintrag mit `dueDate = completedAt + intervalMonths`, statt das Datum der bestehenden Zeile weiterzuschieben.

Grund: Der abgeschlossene Eintrag verweist auf die Durchführung und den zugehörigen Beleg. Ein Abschlussdatum allein ersetzt den tatsächlichen Nachweis nicht. Wer ihn weiterschiebt, verliert die Historie und kann in einer Prüfung nicht mehr zeigen, wann die vorherige Unterweisung stattgefunden hat. Ohne Intervall (`NULL`) entsteht kein Folgeeintrag.

## 6. Der Zwölfmonatszeitraum rollt ab dem Durchführungsdatum

Die Normen sagen „mindestens jährlich", ohne festzulegen, ob Kalenderjahr oder rollierender Zeitraum gemeint ist. Beide Lesarten sind vertretbar. Die App rechnet ab dem letzten Durchführungsdatum, weil das die strengere Auslegung ist und keine Lücke entstehen lässt, wenn eine Unterweisung im Dezember und die nächste im Januar des übernächsten Jahres stattfindet.

## 7. Der Katalog unterstützt die betriebliche Zuordnung

Entscheidung: Der Katalog enthält relevante Vorlagen; die Anwendbarkeit und Vollständigkeit für die tatsächlichen Tätigkeiten muss der Dienst prüfen. Die fünf von der Recherche benannten Pflichten sind mit v016 ergänzt.

Tragend ist, dass ein Katalogeintrag nur eine **Definition** ist. Fällig wird nichts, solange er niemandem zugeordnet ist. Ein Eintrag zu viel kostet also eine Zeile in einer Liste; ein fehlender Eintrag kostet einen Nachweis, an den niemand gedacht hat. Deshalb sind auch die Fälle enthalten, die nur auf manche Dienste zutreffen — die Anwendbarkeit der Belehrung nach IfSG § 43 hängt von den Tätigkeiten nach § 42 ab. Die frühere Einschränkung auf eine eigene Küche war zu eng.

Zwei Einträge bleiben bewusst ohne Intervall: die **Brandschutzhelfer-Ausbildung**, weil ASR A2.2 Abschn. 7.3 nur eine Spanne empfiehlt und die Festlegung der Gefährdungsbeurteilung überlässt, und alles Übrige ohne Normfrist. Wer dort eine Frist führen will, setzt sie selbst als `betrieblich`.

Ergänzt wird über je eine eigene Migration pro Erkenntnis, nicht über einen Abgleich mit `defaultCatalog.ts` bei jedem Start: Ein solcher Abgleich würde Einträge wiederherstellen, die ein Dienst absichtlich gelöscht hat.

## 8. Katalogkorrekturen gehören in die Migration, nicht in die Katalogdatei

`defaultInstructionCatalog` wird nur einmal in Migration v013 mit `INSERT OR IGNORE` eingespielt. Eine Änderung der Datei erreicht bestehende Datenbanken nicht.

Entscheidung: Die Korrekturen laufen als Datenmigration und fassen nur Zeilen an, deren `legalBasis` noch **unverändert** dem ursprünglich eingespielten Wert entspricht. Eine eigene Korrektur des Dienstes wird nicht überschrieben.

Korrigiert werden drei belegte Fehler:

| Eintrag | bisher | belegt |
| --- | --- | --- |
| Hygieneunterweisung (jährlich) | `IfSG / KRINKO` | `BioStoffV § 14 / TRBA 250` für die jährliche Unterweisung; zusätzlich `IfSG § 35` für Infektionsprävention und Hygieneplan |
| Einweisung Medizinprodukte (MPG) | `MDR / MPDG` | `MPBetreibV § 4 / § 11` — die Betreiberpflicht steht nicht in MDR oder MPDG |
| Brandschutzunterweisung | `ArbStättV` | `ArbStättV § 6 / ASR A2.2` |

Intervalle werden gesetzt für Arbeitsschutz, Brandschutz, Hygiene und Abfallentsorgung (je 12 Monate, `norm`). Alle übrigen Einträge bleiben ohne Intervall — auch die, für die eine jährliche Schulung verbreitete Praxis ist. Wer sie führen will, setzt sie selbst als `betrieblich`.
