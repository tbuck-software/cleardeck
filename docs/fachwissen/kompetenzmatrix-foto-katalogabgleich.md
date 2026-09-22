# Kompetenzmatrix: Foto und ClearDeck-Katalog im Abgleich

Stand: 22.09.2026. Bezug: [Aufgabe #33](https://github.com/tbuck-software/cleardeck/issues/33). Geprüft wurden das im Gespräch übergebene Foto „Anlage 10 – Kompetenzmatrix“ und der ausgelieferte ClearDeck-Katalog. Ein Datenbankabzug des Pflegedienstes liegt nicht vor; dessen selbst gepflegte Kompetenzen können abweichen.

## Ergebnis und Quellen

Die Vorlagenfunktion ist seit 2.2.1 vorhanden. Offen ist die fachliche Zuordnung der fotografierten Matrix zu Katalogeinträgen und Berufsgruppen. Das Foto liegt inzwischen vor; die frühere Aussage „Matrix fehlt“ ist damit überholt. Es ist keine Personalstruktur- oder VZÄ-Tabelle.

**F1: Nutzerfoto.** Ein Foto mit 872 × 1600 Pixeln zeigt mehrere aneinandergefügte Blätter. Sichtbar sind Anlage 10, vier Berufsgruppenspalten, LG 1 bis LG 4, weitere Leistungen sowie Fußnoten. Der Druckstand oben rechts wirkt wie „06.03.2023“, ist aber nicht sicher genug lesbar, um ihn als bestätigte Fassung zu übernehmen. Der untere linke Bereich ist teilweise verdeckt. Eine Bedeutung der Farbmarkierungen ist im Foto nicht erläutert. Die nachfolgende Tabelle ist eine Arbeitsabschrift lesbarer Zeilen, keine freigegebene Berechtigungsmatrix. Das Originalfoto und der angeschnittene Unternehmenshinweis werden nicht ins öffentliche Repository übernommen.

**F2: ClearDeck-Quellcode.** [Startkatalog](../../src/main/database/defaultCatalog.ts), [Vorlagenauswahl](../../src/components/modals/RecommendedCompetenciesModal.tsx), [Berufsgruppenerkennung](../../src/utils/qualificationRelevance.ts), [Katalogeditor](../../src/components/modals/CompetencyModal.tsx) und [erstmalige Katalogübernahme](../../src/main/database/migrations/v013_competency_matrix.ts). Verglichen ist der Stand von `origin/main` beim Beginn dieses Abgleichs, Commit `8b58276`. BPf-Nummern sind ClearDeck-Katalogkennungen, keine GPOS-Zuordnung des Fotos. Eine zweite unabhängige Sichtprüfung wurde abgeglichen; bei abweichender Lesart bleibt die Zelle ausdrücklich offen.

**F3: Quellenprüfung am 22.09.2026.** Der [DBfK](https://dbfk-unternehmer.net/download/sgb-v/nordrhein-westfalen) listet Anlage 10 ab 01.04.2023 und Anlage 11 ab 01.09.2022; die Downloads verlangen eine Mitgliederanmeldung. Der [LfK](https://www.lfk-online.de/pflegedienste/downloads/dokumente/vertraege_mit_krankenkassen.html) führt die Kompetenzmatrix mit Stand 31.03.2023 und Änderungen ab 01.04.2023 sowie eine Ergänzung zur spezialisierten Wundversorgung ab 01.10.2025 auf. Daraus folgt keine bestätigte Vertragsgeltung für den konkreten Dienst.

Der öffentlich abrufbare [VDAB-Rahmenvertrag](https://www.vdab.de/fileadmin/Wissensplattform/Nordrhein-Westfalen/Rahmenvertraege/Paragraf-132a-SGB-V/2023_04_01_Rahmenvertrag_gemaess______132_132a_Abs.4_SGBV.pdf) verweist in § 17 Abs. 2 auf Anlage 10 und Anlage 11; die Anlagen selbst sind dort nicht enthalten. Die URL nennt 01.04.2023, die Seitenfüße „VDAB 09.2022“. Die öffentlich verfügbare [historische Matrix vom 10.08.2022](https://ef-essen.de/wp-content/uploads/Anlage_10_Kompetenzmatrix_09-22.pdf) hat nur drei Berufsgruppenspalten. Sie wird ausdrücklich nicht zum Ergänzen unlesbarer Zellen oder Fußnoten der vier Spalten im Foto verwendet. Weitere Einordnung: [bisheriger NRW-Quellenabgleich](hkp-kompetenzvorlagen-nrw.md).

**F4: Eingrenzung über das nachgereichte Logo.** Das Logo konnte anhand des [offiziellen Impressums](https://homeplus-menden.de/impressum/) dem dort benannten Pflegedienst in Menden zugeordnet werden. Damit ist die regionale Eingrenzung auf Nordrhein-Westfalen möglich. Auf den geprüften öffentlichen Seiten fand sich keine eindeutige Benennung des angewandten HKP-Vertrags oder einer Verbandsmitgliedschaft. Der konkrete Vertragsbeitritt und die aktuelle Geltung des Fotos bleiben offen. Unternehmens- und Mitarbeiterdaten werden für den Katalogabgleich nicht übernommen.

## Berufsgruppen und Grenzen des bisherigen Modells

Die Spalten des Fotos werden hier in ihrer Reihenfolge als G1 bis G4 bezeichnet. Das sind nur Leseschlüssel für diesen Abgleich, keine neuen App-Kategorien.

| Spalte im Foto | Lesbarer Inhalt, verkürzt | Bisheriges ClearDeck-Modell | Offener Unterschied |
| --- | --- | --- | --- |
| G1 | Kranken-, Kinderkranken-, Gesundheits- und Altenpflege sowie Pflegefachkräfte; vollständiger Titelkatalog im Foto klein gedruckt | `Nur PFK`, Erkennung anhand der hinterlegten Qualifikationsbezeichnung | Historische Berufsbezeichnungen werden nicht vollständig durch die Wortsuche erkannt; vollständige Titelliste und zugehörige Fußnoten abgleichen. |
| G2 | Krankenpflegehilfe, Krankenpflegeassistenz und Arzthelferinnen bzw. medizinische Fachangestellte; Fußnotenverweis | Je nach Bezeichnung `Nur PHK`, `Nur PFA` oder kein passendes Tag | Keine eigenständige gemeinsame Gruppe für diese Fotospalte. Medizinische Fachangestellte erhalten derzeit kein entsprechendes Tag. |
| G3 | Pflegefachassistentinnen und Pflegefachassistenten | `Nur PFA` erfasst auch allgemein bezeichnete Pflegeassistenz | Foto führt diese Gruppe ausdrücklich getrennt von G2. Der allgemeine Assistenzbegriff reicht für die Unterscheidung nicht. |
| G4 | Staatlich examinierte Heilerziehungspflege; Altenpflegehilfe; sonstige geeignete Kräfte mit einjähriger Berufserfahrung in der Pflege in Vollzeit; Verweise auf Anlage 6a und weitere Berufsbezeichnungen | Überwiegend `Nur PHK`; sonstige geeignete Kräfte nicht als nachweisabhängige Gruppe modelliert | Anerkennung, Berufserfahrung, Zusatzqualifikation und weitere Bedingungen sind nicht aus einem bloßen Gruppennamen ableitbar. Rest des Spaltentexts und Fußnoten sind noch zu prüfen. |

Die bestehende `relevance`-Angabe steuert die Auswahl für Einarbeitung. Sie speichert weder eine leistungsbezogene Vertragsentscheidung noch die Erfüllung persönlicher Zusatzvoraussetzungen. Die Auswahlbox kann nur eine der vorgegebenen Gruppen wählen; der Parser versteht zwar mehrere Tags in einem Text, die Oberfläche bietet dafür keine Mehrfachauswahl. `Alle` ist kein Ersatz für die vier bedingten Spalten des Fotos.

Der SGB-V-Startkatalog enthält 30 Einträge: 27 mit `Nur PFK`, drei mit `Alle` — Kompressionsstrümpfe anlegen, Vitalzeichenkontrolle und Demenzbegleitung. Kein Eintrag dieses Startkatalogs trägt `Nur PFA` oder `Nur PHK`. Das erklärt, warum die neuen Vorlagen allein noch keine passende Matrixauswahl ergeben. Diese Feststellung betrifft den Startkatalog, nicht individuell bearbeitete Bestände.

## Zeilenabgleich

Grundlage jeder Zeile ist F1; die BPf-Vergleiche stammen aus F2. `J` bzw. `N` bezeichnet den auf dem Foto gelesenen Zelleninhalt „ja“ bzw. „nein“. Die Reihenfolge ist immer **G1 / G2 / G3 / G4**. Ein `J` wird hier nicht als voraussetzungslose Erlaubnis interpretiert. Nicht sicher auflösbare Fußnotenzeichen bleiben offen. `N?` bzw. `J?` bedeutet, dass der Grundwert erkennbar ist, der zugehörige Verweis aber nicht vollständig gelesen wurde. `?` bedeutet unzureichend lesbar und wird nicht aus einer anderen Fassung ergänzt.

„Teiltreffer“ bedeutet, dass ein Katalogeintrag einen verwandten, engeren oder weiteren Sachverhalt beschreibt; daraus darf keine automatische Gleichsetzung entstehen. Alle BPf-Einträge haben derzeit `Nur PFK`, sofern die Spalte nicht ausdrücklich `Alle` nennt.

### LG 1 und LG 2, oberes Blatt und Fortsetzung

| Fotozeile | G1/G2/G3/G4 | ClearDeck-Katalog und notwendiger Abgleich |
| --- | --- | --- |
| Blutdruckmessung | J/J/J/J | Teiltreffer BPf 24, Vitalzeichenkontrolle, `Alle`. Foto nennt eine einzelne Messung, der Katalog zusätzlich Puls, Temperatur und SpO2. |
| Blutzuckermessung | J/J/J/J | Teiltreffer BPf 26, Blutzucker-Messung + Insulin-Protokoll. Berufsgruppenauswahl weicht ab; Protokoll ist zusätzlicher Inhalt. |
| Interstitielle Glukosemessung ohne Kalibrierung und ohne Sensorwechsel | J/J/J/J | Kein eigener Eintrag. BPf 26 beschreibt keine ausdrücklich interstitielle Messung. |
| Inhalation | J/J/J/J | Teiltreffer BPf 3 und BPf 18. Zwei überlappende Katalogthemen; genaue Abgrenzung vor Zuordnung festlegen. |
| Injektion s.c. | J/J/J/J | BPf 5, subkutane Injektion. Auswahl im Startkatalog auf PFK begrenzt. |
| Richten von Injektionen | J/J/J/J | Kein eigener Vorbereitungseintrag. BPf 5/6 bezeichnen Durchführung, nicht das Richten. |
| Auflegen von Kälteträgern | J/J/J/J | Kein eigener Eintrag. |
| Richten ärztlich verordneter Medikamente, ohne Wochendispenser | J/J/J/J | Teiltreffer BPf 1. Der Katalog trennt diese Zeile nicht vom Wochendispenser in LG 3. |
| Medikamentengabe | J/J/J/J | Teiltreffer BPf 2/3/4 mit verschiedenen Applikationswegen. Den genauen Umfang der Fotozeile nicht auf alle Wege ausdehnen. |
| Augentropfen | J/J/J/J | Kein eigener Eintrag. Nicht von „oral / sublingual“ in BPf 2 umfasst. |
| Ausziehen von Kompressionsstrümpfen | J/J/J/J | Kein eigener Eintrag. BPf 22 nennt nur Anlegen, `Alle`. An- und Ausziehen stehen im Foto in verschiedenen Leistungsgruppen. |
| Abnehmen eines Kompressionsverbandes | J/J/J/J | Kein eigener Eintrag; BPf 21 nennt Anlegen. |
| Zeile zwischen Abnehmen des Kompressionsverbandes und Ablegen von Bandagen/Orthesen | J/J/J/J | Titel und Tätigkeitsrichtung sind nicht sicher lesbar. Keine Zuordnung aus einem vermuteten „Anlegen/Ablegen“ ableiten. |
| Ablegen ärztlich verordneter Bandagen und Orthesen | J/J/J/J | Kein eigener Eintrag. |
| Klistier / Klysma | J/J/J/J | Teiltreffer BPf 15, der zusätzlich Einlauf und Darmentleerung zusammenfasst. Foto differenziert weiter. |
| Flüssigkeitsbilanzierung | J/J/J/J | Kein eigener Eintrag. |
| SPK-Versorgung | J/J/J/J | Teiltreffer BPf 14, der Pflege und Wechsel zusammenfasst. Fotozeile nicht mit Katheterwechsel gleichsetzen. |
| Medizinische Einreibungen | J/J/J/J | Kein eigener Eintrag. BPf 4 nennt transdermale Pflaster, nicht Einreibungen. |
| Dermatologische Bäder | J/J/J/J | Kein eigener Eintrag. |
| Versorgung bei PEG | J/J/J/J | Teiltreffer BPf 8, Ernährung über PEG-Sonde. Sondenversorgung und Ernährung sind nicht automatisch identisch. |
| Anziehen von Kompressionsstrümpfen | J/J/J/J | BPf 22, `Alle`. Foto-Fußnoten und Voraussetzungen werden mit `Alle` nicht abgebildet. |
| Anlegen ärztlich verordneter Bandagen und Orthesen | J/J/J/J | Kein eigener Eintrag. BPf 21 ist auf Kompressionsverbände begrenzt. |
| … stützende oder stabilisierende Verbände, LG-2-Zeile | J/J/J/J | Das erste Wort wirkt wie „Ablegen“, ist nach zwei Sichtprüfungen aber nicht eindeutig. Kein eigener Eintrag; nicht pauschal mit BPf 10, Verbandswechsel, gleichsetzen. |
| Positionswechsel zur Dekubitusbehandlung | J/J/J/J | Kein passender eigener SGB-V-Eintrag. P07/P08 stehen im SGB-XI-Katalog und sind keine bestätigte Zuordnung dieser Fotozeile. |
| Interstitielle Glukosemessung, Kalibrieren bei Bedarf, Fortsetzung am Beginn des zweiten Blatts | J/J/J/J | Kein eigener Eintrag. Von Ablesen, Sensorwechsel und kombinierter Sensorwechsel-/Kalibrierungszeile getrennt halten. |

### LG 3

| Fotozeile | G1/G2/G3/G4 | ClearDeck-Katalog und notwendiger Abgleich |
| --- | --- | --- |
| Absaugen der oberen Luftwege / Bronchialtoilette | J/J/N/N | Teiltreffer BPf 19, oral/nasal, und BPf 17, tracheal/endotracheal. Zugangswege nicht ungeprüft zusammenfassen. |
| Blasenspülung | J/J/N/N | Kein eigener Eintrag. |
| Versorgung und Überprüfen von Drainagen | J/J/N/N | Teiltreffer BPf 12, Wunddrainage. Umfang der Fotozeile abgleichen. |
| Injektion i.m. | J/J/N/N | BPf 6. Foto unterscheidet sich von der s.c.-Zeile und von pauschal `Nur PFK`. |
| Instillation | J/J/N/N | Kein eigener Eintrag. Insbesondere nicht mit Infusionstherapie BPf 7 verwechseln. |
| Stomaversorgung bei krankhaften Veränderungen | J/J/J/N | Kein eigener Eintrag. Beispielzusätze im Foto sind klein gedruckt. |
| Katheterisierung, intermittierende Einmalkatheterisierung, einschließlich weiterer Zusätze | J/J/N/N | Teiltreffer BPf 13/16. Vollständigen Foto-Zusatz einschließlich Entfernen/Wechsel zur Harnableitung vor Aufteilung lesen. |
| Richten ärztlich verordneter Medikamente im Wochendispenser | J/J/J/N | Teiltreffer BPf 1. Andere Spaltenbelegung als das Richten ohne Wochendispenser; getrennte Katalogthemen erforderlich. |
| Wechsel und Pflege der Trachealkanüle | J/N/N/N | Teiltreffer BPf 17 nur für verwandte Pflege/Absaugung. Kanülenwechsel ist nicht ausdrücklich als eigenes Thema vorhanden. |
| Augenspülung | J/J/N/N | Kein eigener Eintrag. Von Augentropfen unterscheiden. |
| Anlegen eines Kompressionsverbandes | J/J/J/N | BPf 21. Andere Auswahl als im Startkatalog. |
| Anlegen stützender oder stabilisierender Verbände | J/J/N/N | Kein genauer Eintrag. BPf 10 bezeichnet einen allgemeinen Verbandswechsel. |
| Legen und Anhängen einer s.c. Infusion | J/J/N/N | Teiltreffer BPf 7; s.c. Infusion ist dort nicht von Port-Versorgung getrennt. |
| Wechseln einer s.c. Infusion | J/J/?/N | Teiltreffer BPf 7. Lesarten der G3-Zelle weichen voneinander ab; genau diese Zelle nachfordern. Keine abweichende Berechtigung zu Legen/Anhängen behaupten. |
| Wundversorgung einer akuten Wunde | J/J/J/N | Teiltreffer BPf 9/10/11, die Beurteilung, Verbandwechsel und Debridement getrennt, aber ohne entsprechende Akut-/Chronisch-Abgrenzung enthalten. Keine pauschale Freigabe aller drei Themen ableiten. |
| Interstitielle Glukosemessung mit Sensorwechsel bei Bedarf | J/J/J/N | Kein eigener Eintrag. Lange Zusatztexte zur Abrechnung sind nicht vollständig entziffert. |
| Interstitielle Glukosemessung mit Kalibrierung und Sensorwechsel bei Bedarf | J/J/J/N | Kein eigener Eintrag. Von der vorherigen Zeile und den LG-1-/LG-2-Varianten getrennt halten. |

### LG 4 und unterer Blattbereich

Dieser Bereich ist deutlich schlechter lesbar. Zeilen werden als offene Positionen geführt, statt Namen oder Bedingungen aus der historischen PDF zu übernehmen.

| Fotozeile bzw. Position | G1/G2/G3/G4 | ClearDeck-Katalog und notwendiger Abgleich |
| --- | --- | --- |
| Erste mehrzeilige LG-4-Leistung, vermutlich Dekubitusbehandlung | J/N/N/N | Titel und Zusatz noch bestätigen. Möglicher Bezug zu BPf 9/10/11, keine sichere Gleichsetzung. |
| Einlauf / weitere Zusätze, Zeile unter Dekubitusbehandlung | J/N?/N/N | Teiltreffer BPf 15. Text und Fußnotenzeichen in G2 nicht ausreichend lesbar. |
| Digitale Enddarmausräumung | J/N?/N/N | Teiltreffer BPf 15 „Darmentleerung“, ohne ausdrückliche Einzelzuordnung. Fußnote in G2 offen. |
| Unterste Zeile des zweiten Blatts, Beginn wirkt wie „Anlegen, Wechsel und Pflege …“ | J/N?/N/N | Titel und Bedingungen nicht sicher lesbar. Keine Katalogzuordnung aus einzelnen Wörtern ableiten. |
| Grüner Fortsetzungsbereich des dritten Blatts vor der Port-Zeile | ?/?/?/? | Teilweise verdeckt und unscharf. Ein Bezug zu einer Magensonde ist erkennbar, Zahl/Abgrenzung und vollständige Titel der verdeckten Zeilen bleiben offen. Nicht künstlich aus einer älteren Matrix vervollständigen. |
| Pflege des zentralen Venenkatheters und Portsystemen, Zeile vor orangefarbenem Bereich | J/N?/N/N | Teiltreffer BPf 7; vollständige Bezeichnung und Fußnoten noch bestätigen. |
| Wundversorgung chronischer und schwer heilender Wunden, orangefarbener Bereich | J?/N/N/N | Teiltreffer BPf 9/10/11. In G1 steht ein Fußnotenverweis. Aktuelle Ergänzungsvereinbarung und fachliche Zusätze fehlen im Fotoabgleich. |
| Psychiatrische Krankenpflege, blauer Bereich am Ende | J mit Zusatzvoraussetzungen / N / N / N | Kein eigener Eintrag. Im Foto ist ein Verweis auf § 17 Abs. 4 erkennbar; Detailvoraussetzungen nicht aus dem Ja ableiten. |

## Konkreter Restbedarf

1. **Lesbarkeit:** Nahaufnahme oder PDF nur von den vier Spaltenüberschriften, dem Druckstand, dem unteren LG-4-/Fortsetzungsbereich und dem vollständigen Fußnotenblock. Zusätzlich benötigt werden die zwei in der Tabelle markierten An-/Ablegezeilen in LG 1/2 sowie die G3-Zelle beim Wechsel einer s.c. Infusion. Die übrigen lesbaren Zeilen müssen nicht erneut angefordert werden.
2. **Geltung:** Gehört diese Fassung zum aktuell beim Dienst angewandten Vertrag? Benötigt wird dessen Bezeichnung oder die passende Vertragsunterlage. Der Produktverantwortliche kennt Vertrag und aktuelle Geltung derzeit nicht. Das nachgereichte Logo und der öffentliche Webauftritt grenzen den Dienst inzwischen auf NRW ein, belegen aber keinen Vertragsbeitritt. Der anfängliche Suchansatz über ein verdecktes Namensfragment des Fotos wird dadurch ersetzt.
3. **Ergänzende Bedingungen:** Die zur Fassung gehörende Anlage 11 und gegebenenfalls die aktuelle Ergänzung zur spezialisierten Wundversorgung. Die öffentlichen Fundstellen ersetzen deren Inhalte nicht.

## Umsetzung nach dem Abgleich

Die bisherige Vorlagenfunktion bleibt nutzbar. Dieser Abgleich ändert noch keine Auswahlregeln in produktiven Katalogen.

Für die Matrixübernahme müssen insbesondere Medikamentenrichten mit/ohne Wochendispenser, An-/Ausziehen von Kompressionsstrümpfen, Anlegen/Abnehmen von Verbänden, die getrennten s.c.-Infusionszeilen mit noch offener G3-Zelle sowie die Varianten der interstitiellen Glukosemessung unterscheidbar werden. Die vier Berufsgruppenspalten brauchen eine bestätigte Zuordnung; Bedingungen und Quellenstand müssen zusammen mit der Zuordnung lesbar bleiben.

Vorhandene lokale Katalogänderungen und persönliche Bewertungen sind bei einer späteren Übernahme zu erhalten. Ein bloßes Ändern des Startkatalogs würde Bestandsinstallationen zudem nicht verlässlich aktualisieren: dessen Übernahme erfolgt in Migration v013. Es braucht eine ausdrücklich geprüfte Vorschau bzw. Übernahmeregel für bestehende Einträge.

Aufgabe #33 sollte auf die verbleibende Matrixzuordnung und die obigen gezielten Nachweise eingegrenzt werden. Die bereits ausgelieferte Vorlagenvorschau und Sammelbearbeitung gehören in den erledigten Teil.
