# HKP-Kompetenzkatalog: Quelle und Übernahme

Stand: 22.09.2026. Bezug: [Aufgabe #33](https://github.com/tbuck-software/cleardeck/issues/33).

## Vollständige Quelle

Die vom Nutzer nachgereichte [Anlage 10, Stand 06.03.2023](quellen/anlage-10-kompetenzmatrix-2023-03-06.pdf) enthält vier Berufsgruppenspalten, alle 50 Leistungspositionen und sieben Fußnoten. Alle drei Seiten wurden als Text und gerendert geprüft. PDF-Metadaten nennen AOK NORDWEST als Autor und Microsoft Excel 2019 als Erzeuger, Erstellung 18.04.2023. Diese Metadaten allein belegen weder Echtheit noch aktuelle Vertragsgeltung. Die PDF stimmt in Aufbau, Datum, Berufsgruppen und lesbaren Zellen mit dem Nutzerfoto überein.

SHA-256: `ba595d2228cc95d0f03ad9912fab0a8c8212329cf353907b952639b3d526fe2f`.

Damit sind die zuvor dokumentierten Leselücken geschlossen. Die separat übergebene neu gesetzte PDF „Kompetenzmatrix_HKP_Anlage10.pdf“ wird wegen fehlender Zeilen/Fußnoten und falscher Zuordnungen nicht verwendet. Die ältere dreispaltige Fassung von 2022 wird ebenfalls nicht zum Ergänzen dieser Quelle verwendet. Fotos, Unternehmens- und Mitarbeiterdaten werden nicht mitgeliefert.

## Umfang und Zuordnung

[Der strukturierte Katalog](../../src/shared/hkpCatalog.ts) enthält:

- LG 1: 14 Positionen.
- LG 2: 11 Positionen, einschließlich Kalibrierung bei Bedarf.
- LG 3: 17 Positionen.
- LG 4: sechs Positionen.
- Zwei weitere Positionen: chronische/schwer heilende Wunde und psychiatrische häusliche Krankenpflege.

Vier separate Vorlagengruppen bilden die Spalten ab. Generische Bezeichnungen wie „Pflegehilfskraft“, „Pflegeassistenz“ oder „1-jährig examiniert“ reichen nicht für deren automatische Unterscheidung. Die konkrete Gruppe kann in der Vorlagenauswahl ausdrücklich gewählt werden. Die Berufsbezeichnung und persönlichen Nachweise bleiben davon unabhängig.

Die Standardauswahl folgt den Ja-Zellen: G1 enthält 50, G2 41, G3 31 und G4 25 Positionen. Nein-Zellen mit Bestandsschutz werden nicht zu einem pauschalen Ja. Die betreffende Fußnote bleibt an den fünf LG-4-Positionen erhalten; eine individuell begründete Zuordnung ist über die bestehende manuelle Auswahl möglich.

Besonders geprüft wurden:

- Absaugen/Bronchialtoilette hat GPOS **032230**, nicht die zunächst aus dem Foto gelesene 032220.
- Medikamentenrichten mit/ohne Wochendispenser sind getrennte Positionen.
- An-/Ausziehen von Kompressionsstrümpfen und Anlegen/Abnehmen von Verbänden bleiben getrennt.
- Beim Wechsel einer s.c.-Infusion steht für Pflegefachassistenz **nein**.
- Sensorwechsel allein und Kalibrierung mit Sensorwechsel sind getrennte Positionen; die Abrechnungshinweise bleiben in den Notizen erhalten.
- GPOS 032326 lautet Anhängen, Wechsel oder Abhängen einer i.v.-Infusion, etwa parenterale Ernährung oder Substitutionstherapie über Port.
- GPOS 032265 lautet Legen und Wechseln einer Magensonde.
- Die psychiatrische Krankenpflege verweist auf **§ 13 Abs. 4**, mit Nein in den übrigen drei Spalten.

## Bedingungen

Die sieben Fußnoten werden inhaltlich zusammengefasst an den jeweiligen Vorlageneinträgen gespeichert; das Original bleibt als Prüfreferenz verfügbar. Erfasst sind der Wundversorgungsverweis, regelmäßige Behandlungspflege bei MFA/Arzthilfe, leistungsbezogener Bestandsschutz bis 29.07.2022 mit Handzeichenliste und GPOS, der NRW-Lehrplan für Heilerziehungspflege sowie die Schulungs- und Praxisnachweise nach Anlagen 6, 6a und 7.

Der Hinweis auf ein Jahr Pflege-Berufserfahrung in Vollzeit gilt im Spaltenkopf für sonstige geeignete Kräfte. Fußnote 7 steht nach Rettungsassistenz; die Notiz lässt diese Position erkennbar, statt aus dem Gruppennamen eine zusätzliche pauschale Rechtsregel abzuleiten.

Die Texte der Anlage sind nun vollständig erfasst. Offen bleibt deren aktuelle Anwendbarkeit beim konkreten Dienst. Insbesondere ersetzt die Fassung von 2023 nicht die Prüfung späterer Wundversorgungsregelungen oder der zugehörigen Vertragsanlagen. [Der NRW-Quellenabgleich](hkp-kompetenzvorlagen-nrw.md) dokumentiert die Verbandsfundstellen. Der Kompetenzkatalog dokumentiert Einarbeitung und Bewertungen, keine automatische Durchführungserlaubnis.

## Verhalten in ClearDeck

Unter **Kompetenzen → HKP-Katalog ergänzen** wird die Auswahl vor dem Import angezeigt. Die Übernahme ergänzt ausschließlich fehlende Einträge. Übereinstimmende Vorlagenkennung, GPOS oder Bezeichnung gelten als vorhanden; eigene Bezeichnungen, Notizen und Regeln werden nicht überschrieben. Der alte BPf-Katalog wird nicht umgedeutet oder gelöscht: seine teilweise breiteren Themen sind nicht automatisch dieselbe Leistung.

Neue Einträge erhalten eine stabile Vorlagenkennung und den Status **Vorlage ungeprüft** für die betriebliche Prüfung. Dieser Status ist vom Einarbeitungsstand einer Person getrennt. Quelle, Leistungsgruppe und Bedingungen stehen in der Katalognotiz. Berufsgruppen sind im Editor mehrfach auswählbar; spätere Ergänzungen ändern weder Eintrags-ID noch Mitarbeiterbewertungen oder deren Verlauf.

Migration 24 ergänzt nur zwei nullable Metadatenfelder im Katalog. Es werden beim Update keine HKP-Einträge oder Mitarbeiterzuordnungen automatisch angelegt. Der additive Import läuft als Transaktion und prüft vorhandene Einträge erneut beim Speichern. Auch nach Änderungen an Kürzel und Bezeichnung verhindert die stabile Vorlagenkennung einen erneuten Import.

Synchronisierte Installationen benötigen den Server mit Schema 24 aus demselben Änderungsstand. Ein Server-Rollout ist nicht Teil dieser Implementierung.
