# QPR: Stichprobenmerkmale, Pflegevisiten und Prüfergebnisse trennen

Stand: 2026-09-05. Bezug: Qualitätsprüfungs-Richtlinien ambulante Pflege Teil 1a, MD Bund, Fassung 19.05.2025, gültig ab 01.07.2026; § 114a SGB XI. Fundstellen jeweils in Klammern.

Diese Entscheidungssammlung hält den eingebrachten fachlichen Zielstand für ClearDeck fest: Stichprobenmerkmale gehören zur Person, Pflegevisiten zum internen Qualitätsmanagement und externe Prüfergebnisse zum jeweiligen Qualitätsaspekt. Dadurch werden die mehrfach verwendeten Buchstaben A–D in der App nicht miteinander verwechselt.

**Dokumentationsstatus:** Übernommener fachlicher Entscheidungsstand mit offenen technischen Detailfragen. Aussagen über die App beschreiben die beabsichtigte Gestaltung; dieses ADR bestätigt keinen abgeschlossenen Implementierungsstand. Die acht Entscheidungen sind hier als zusammengehöriges ADR dokumentiert.

Die [QPR-Recherche](../research/qpr-teil-1a-ambulante-pflege-2026.md) enthält die geprüften Richtlinienangaben und deren Fundstellen. Dieses ADR ergänzt die daraus abgeleiteten Produktentscheidungen, insbesondere Farben, Datenfelder, Pflegevisitenintervall und Ergebnisanzeige. Diese Produktentscheidungen sind keine Vorgaben der QPR.

## 1. Teilgruppen A–D sind Stichproben-Merkmale, keine Bewertung

Die Buchstaben A–D an der Patient:in bezeichnen die **Teilgruppe der MD-Stichprobe** (Kap. 8.1, Anlage 8), nicht eine Qualität oder Schwere:

- **A** Mobilität und Kognition beeinträchtigt – Sollzahl 2
- **B** Mobilität beeinträchtigt, Kognition nicht – Sollzahl 2
- **C** Kognition beeinträchtigt, Mobilität nicht – Sollzahl 2
- **D** aufwändige HKP-Leistung – Sollzahl 3

Gesamt 9 Personen. Unterbesetzte Teilgruppen werden **nicht** aufgefüllt; die Unterschreitung wird im Prüfbericht begründet.

Konsequenzen in der App: Teilgruppen werden neutral (Blautöne) dargestellt, nie als Ampel. Das ursprünglich geplante Modell „A–D = Bewertung aus der Pflegevisite" wurde verworfen.

## 2. D ist ein zusätzliches Merkmal, keine Alternative zu A–C

A/B/C ergeben sich allein aus Mobilität/Kognition. **D wird zusätzlich** eingetragen, wenn eine aufwändige HKP-Leistung vorliegt (Anlage 7, Muster mit Mehrfachkennzeichnung). Ziehung: zuerst A–C, für D nur Personen, die noch nicht gezogen wurden.

Datenmodell: `kog`, `mob` (bool | null) → Teilgruppe A/B/C/„ohne Beeinträchtigung"; `hkp` (null | '6' | '8' | '29' | '31a') separat. Anzeige z. B. „B + HKP 31a".

## 3. Aufwändige HKP = genau vier Ziffern

Nur diese Ziffern des HKP-Leistungsverzeichnisses zählen für Teilgruppe D (Kap. 8 Abs. 3):
6 Absaugen · 8 Bedienung/Überwachung Beatmungsgerät · 29 Wechsel/Pflege Trachealkanüle · 31a Wundversorgung chronische, schwer heilende Wunde.
Gewöhnliche HKP begründet keine D-Zuordnung. Deshalb wird die Ziffer gespeichert, nicht ein Ja/Nein.

## 4. Quelle der Einstufung ist das Pflegegrad-Gutachten, Fallback eigene Einschätzung

Maßgeblich sind Modul 1 (Mobilität) und Modul 2 (kognitive/kommunikative Fähigkeiten) des Begutachtungsinstruments ab erheblicher Beeinträchtigung – d. h. ≥ 4 ungewichtete Punkte in Modul 1 bzw. ≥ 6 in Modul 2 (Anlage 2 zu § 15 SGB XI). Gutachten darf **nicht älter als ein Jahr** sein (Kap. 8 Abs. 3).

Fehlt es oder ist es älter, schätzt der Pflegedienst selbst ein:
- Mobilität beeinträchtigt: regelmäßig personelle Hilfe **sowohl** beim sicheren Treppensteigen **als auch** bei der Fortbewegung in der Wohnung.
- Kognition beeinträchtigt: (nahezu) täglich Störungen in mindestens einem Bereich: Kurzzeitgedächtnis, zeitliche Orientierung, örtliche Orientierung, Personenerkennung.

Konsequenz: Mobilität/Kognition sind **Stammdaten** der Patient:in, nicht Ergebnis der Pflegevisite. Offene Punkte (siehe unten): Gutachtendatum speichern und Ablauf nach 12 Monaten anzeigen.

## 5. Pflegevisite bleibt interne QM ohne A–D

Die interne Pflegevisite erfasst Datum, Beobachtungen und ein Flag **Handlungsbedarf** (erscheint in „Heute zu tun"). Sie vergibt keine Buchstaben. Fälligkeit nach konfigurierbarem Intervall (Standard 90 Tage). Fachlich begründete mündliche Auskünfte zählen in der Prüfung gleichrangig zur Dokumentation – die Visite dient der Auskunftsfähigkeit, nicht dem Schein.

## 6. Kernartefakt ist die Personenliste nach Anlage 7

Der Pflegedienst legt zu Prüfungsbeginn eine **alphabetische Liste aller versorgten Personen** vor (Leistungen nach §§ 36/39 SGB XI bzw. §§ 37/37c SGB V; ausgenommen reine Haushalts-/Betreuungs-/Entlastungsleistungen und reine Beratungsbesuche § 37 Abs. 3). Fünf Spalten (Kap. 8 Abs. 1–3, Anlage 7):

1. Vor- und Nachname
2. ggf. Name und Telefon der bevollmächtigten/betreuenden Person
3. Teilgruppe A/B/C (bzw. Mobilitäts-/Kognitionsmerkmale)
4. aufwändige HKP-Leistung inkl. Ziffer
5. AKI/pHKP; bei AKI Beatmung „B" und Einfach-/Mehrfachversorgung „EV/MV"; bei pHKP ggf. Erstverordnung „E" (Verordnungsbeginn < 4 Wochen)

Konsequenz: Felder `contact`, `aki` im Datenmodell; „Personenliste (Anlage 7) exportieren" ist die Hauptaktion der Seite MD-Prüfung; die Vorbereitungs-Checks prüfen genau diese Vollständigkeit.

## 7. Bewertung nach Qualitätsbereichen, kein Gesamtbuchstabe

- **QB 1** unabhängig von vereinbarten Leistungen (Aufnahmemanagement, Risiken, Destabilisierung) – Skala A–D
- **QB 2** individuell vereinbarte Leistungen – A–D
- **QB 3** ärztlich verordnete Leistungen – A–D
- **QB 4** sonstige personenbezogene Aspekte (Angehörige, Gewalt/Vernachlässigung) – beschreibend, keine Skala
- **QB 5** QM, Hygiene, verantwortliche PFK – erfüllt / nicht erfüllt
- **Abrechnungsprüfung** – Auffälligkeiten werden dokumentiert und der Kasse gemeldet

Skala: A ohne Auffälligkeiten · B Auffälligkeiten ohne erwartbare Risiken/Folgen · C Defizit mit Risiko negativer Folgen · D Defizit mit eingetretenen negativen Folgen (Anlage 3). Bewertung erfolgt **je Qualitätsaspekt und Person**, im Prüfbericht tabellarisch (P1–P9) zusammengeführt (Kap. 12, Anlage 6).

Konsequenz: Es gibt kein offizielles Gesamtergebnis. Die App zeigt in der Prüfungsliste das schwächste Ergebnis aus QB 1–3 als Orientierung – ausdrücklich so beschriftet. Die vorher angenommenen Bereiche „Struktur / Ergebnisqualität / Abrechnung / Hygiene" waren falsch und wurden ersetzt.

## 8. Ankündigung

Regelprüfungen werden **zwei Arbeitstage** vorher angekündigt (§ 114a Abs. 1 S. 2 SGB XI, aktuelle Fassung; die QPR-Originalfassung nannte noch einen Tag unter Vorbehalt). Anlassprüfungen unangemeldet. Die Personenliste wird nach Ankündigung erstellt – sie muss daher jederzeit exportierbar sein.

## Offene Punkte

- Gutachtendatum je Patient:in speichern; Warnung bei > 12 Monaten und Umschalten auf „eigene Einschätzung" mit Begründung.
- AKI: Einfach-/Mehrfachversorgung (EV/MV) als eigenes Feld, falls AKI tatsächlich erbracht wird.
- Ob die interne Pflegevisite ein eigenes Intervall pro Teilgruppe braucht (fachliche Entscheidung des Dienstes, nicht Vorgabe der QPR).
- Original-Prüfbogen A/B (Anlage 1/2) mit den Qualitätsaspekten je QB abbilden, wenn Prüfergebnisse detaillierter erfasst werden sollen.

## Präzisierungen und offene Modellfragen

Die folgenden Hinweise ergänzen den übernommenen Text. Sie ersetzen keine noch ausstehende fachliche oder technische Entscheidung.

- **Mehrere HKP-Leistungen:** Das in Abschnitt 2 vorgeschlagene skalare `hkp`-Feld bildet nur eine Ziffer ab. Anlage 7 zeigt auch gleichzeitig erbrachte Leistungen, etwa 6, 8 und 29. Vor der Umsetzung muss das Modell mehrere Ziffern abbilden können; die konkrete Speicherung ist offen.
- **Unbekannte Einstufung:** Bei `mob` oder `kog` mit dem Wert `null` ist die Einstufung nicht vollständig bekannt. Der im Text vorgesehene Zustand „ohne Beeinträchtigung“ darf nicht als Ersatz für unbekannte Angaben verwendet werden. Die Ableitung bei unvollständigen Angaben ist noch festzulegen.
- **Ausschlüsse der Personenliste:** „Reine Betreuungsleistungen“ in Abschnitt 6 meint die ausgeschlossenen Leistungen nach § 45a Abs. 1 beziehungsweise § 45b Abs. 1 Nr. 3 SGB XI. Pflegerische Betreuungsmaßnahmen nach § 36 SGB XI gehören ausdrücklich zur Grundgesamtheit. Für „E“ bei pHKP müssen sowohl „Erstverordnung“ angekreuzt als auch das „vom-Datum“ weniger als vier Wochen zurückliegen.
- **Prüfergebnisanzeige:** Die QPR sieht keinen einzelnen Gesamtbuchstaben für eine Person oder einen Dienst vor. Eine Anzeige des schwächsten Ergebnisses wäre eine interne Produktentscheidung. Mehrere Bewertungen je Qualitätsaspekt sind möglich; die App muss bei einer solchen Zusammenfassung weiterhin die Einzelbefunde zugänglich machen. Der Prüfbericht bezeichnet die Personen allgemein als P1 bis PX; P1 bis P9 beschreibt nur die reguläre Neun-Personen-Stichprobe.
- **Abrechnungsprüfung und Meldungen:** Die Recherche belegt die Darstellung der Abrechnungsauffälligkeiten im Prüfbericht. Die pauschale Formulierung „der Kasse gemeldet“ in Abschnitt 7 legt keinen konkreten Meldeweg für ClearDeck fest. Ein solcher Ablauf ist hier nicht spezifiziert.

## Quellen

- [MD Bund: QPR Teil 1a ambulante Pflegedienste, 19.05.2025](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil_1a_ambulante_Pflegedienste_2025_05_19.pdf), Kap. 4, 7, 8, 12; Anlagen 1–3, 6, 7, 8.
- [§ 114a SGB XI](https://www.gesetze-im-internet.de/sgb_11/__114a.html).
- [Anlage 2 zu § 15 SGB XI: Modulschwellen](https://www.gesetze-im-internet.de/sgb_11/anlage_2.html).
- Im eingebrachten Text genannte, hier nicht zusätzlich geprüfte Sekundärquellen: qm-praxis-pflege.de „Neue QPR ambulant ab 2026 im Fokus"; pflege-besser.de Arbeitsblatt QPR ambulant; careproof.eu ambulante Pflegeeinrichtungen
