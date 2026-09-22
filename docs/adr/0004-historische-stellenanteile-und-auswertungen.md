# Stellenanteile zeitbezogen belegen und Auswertungsarten benennen

Stand: 06.09.2026. Die [Anforderungen](../anforderungen.md) und die ursprünglichen Vorlagen verlangen historische Beschäftigung und enthalten eine taggewichtete Periodenrechnung. Die verbindliche Kennzahl des späteren Berichtsempfängers ist noch offen.

Stunden und VZÄ werden deshalb mit Wirksamkeitsdatum je Beschäftigungsperiode geführt. Der Erfassungszeitpunkt ist davon getrennt. Rückdatierte Korrekturen bleiben in einer Historie nachvollziehbar. Aus alten globalen Feldern übernommene Werte bleiben als Altdaten erkennbar.

Manuell eingetragene oder geänderte Arbeitszeitangaben gelten beim Speichern als bestätigt; eine zusätzliche Prüf-Checkbox entfällt auf Wunsch des Produktverantwortlichen vom 06.09.2026. Das betrifft auch ein ausdrücklich geändertes Gültigkeitsdatum. Eine bloße Namens- oder Notizänderung bestätigt keine übernommenen Altwerte. ClearDeck bietet für Arbeitszeiten keine Belegablage. Deshalb entfallen auch das Textfeld „Personalbeleg“, die entsprechende Historien-Spalte und Belegprüfungs-Hinweise.

Arbeitszeiten erhalten einen eigenen Editor ohne Qualifikationsfeld. Eine Korrektur adressiert den bestehenden Stand über seine ID; eine Änderung des Gültigkeitsdatums verschiebt diesen Stand, statt einen zusätzlichen zu erzeugen. Gleichdatige Konflikte werden abgewiesen. Die vorherigen Fassungen bleiben intern erhalten. Die vorhandene Historie zeigt die gültigen Arbeitszeitabschnitte nach ihrem Gültigkeitsbeginn und öffnet beim Anklicken der ganzen Zeile den Editor. Neue Stände werden über „Eintrag hinzufügen → Arbeitszeit“ ergänzt. Eine zweite Arbeitszeittabelle und zusätzliche Erfassungsmeldungen entfallen.

Die bestehende Speicherung ordnet Arbeitszeitstände weiterhin Beschäftigungsabschnitten zu, die auch eine Qualifikation enthalten. Der Editor ermittelt den passenden Abschnitt aus Person und Datum und kann dadurch auch einen Stand über eine Qualifikationsgrenze hinweg verschieben, ohne Qualifikationen zu ändern. Das ist eine Trennung der Bedienung, noch keine vollständige Trennung des Datenmodells. Vorhandene Arbeitszeitstände an solchen Abschnittsgrenzen bleiben erhalten; aus ihnen lässt sich nicht sicher ableiten, welche Angaben lediglich übernommen wurden.

Die Gesamtliste zeigt alle jemals Beschäftigten mit ihrem letzten erfassten Stand. Die Jahresübersicht umfasst im Jahr Beschäftigte. Der Bericht bietet ausdrücklich einen Bestand zum 31.12. und einen taggewichteten Jahresdurchschnitt. Der Durchschnitt zerlegt Beschäftigung nach wirksamen Stunden- und Qualifikationsänderungen und gewichtet gespeicherte Stellenanteile mit inklusiven Tagen geteilt durch die Kalendertage des Jahres. Eintritt und Austritt begrenzen die Abschnitte. Die Excel-Vorlage verwendete dafür eigene Zeitraumspalten; ihre fehlerverdeckende Nullbehandlung wird nicht übernommen.

Die gewünschte betriebliche VZÄ-Regel bleibt erhalten: ab 36 Wochenstunden 1,0, höchstens 1,0. Der voreingestellte Bezugswert darunter ist 36 Stunden; ein abweichender konfigurierter Bezugswert muss sichtbar sein. Bereits erfasste historische Stellenanteile werden durch eine spätere Änderung dieses Bezugswerts nicht neu berechnet.

Keiner dieser Berichte behauptet ohne Vertragsprüfung, das verbindliche Formular eines bestimmten Empfängers zu erfüllen. Ein vorläufiger Bericht kennzeichnet unbekannte oder unbestätigte Stellenanteile ausdrücklich.


## Ergänzung vom 22.09.2026: Monatsenden als Standard

Auf Wunsch des Produktverantwortlichen verwendet der Jahresnachweis standardmäßig den Durchschnitt aus zwölf Monatsenden. Taggewichteter Jahresdurchschnitt und Stichtag 31.12. bleiben als ausdrücklich benannte Alternativen auswählbar. Die anfängliche Auswahl nur im Jahresnachweis wird durch die folgende zentrale Einstellung ergänzt.

Für jeden Monatsletzten werden die an diesem Datum gültigen Stellenanteile und Qualifikationen der Beschäftigten berücksichtigt. Eintritt und Austritt zählen einschließlich ihres Datums. Die Summe der zwölf Monatsendwerte wird immer durch zwölf geteilt, auch bei Monaten ohne Beschäftigte. Ein untermonatiger Beschäftigungsabschnitt ohne Monatsende trägt nichts bei. Fehlende Stellenanteile an berücksichtigten Monatsenden bleiben als unbekannt gekennzeichnet; ein ausdrücklich erfasster Nullwert ist davon getrennt.

Die Spalte „Personen an Monatsenden“ zählt unterschiedliche Personen, die an mindestens einem Monatsende vertreten sind. Sie ist kein Durchschnitt der monatlichen Kopfzahlen. Bei einem Qualifikationswechsel kann dieselbe Person in mehreren Gruppen zählen; insgesamt zählt sie einmal. Die taggewichtete Alternative zählt weiterhin alle im Jahr Beschäftigten.

Die Methode verwendet die erfassten Stellenanteile. Sie ergänzt keine SGB-XI-Aufteilung, keine automatischen Freistellungsabzüge und keine bestätigte Zuordnung zu einem bestimmten Vertragsformular. Monatsenden und ihr Gewicht bleiben im Excel-Export nachvollziehbar.


## Zentrale Einstellung für Jahres-VZÄ

Unter „Einstellungen → Allgemein → Berechnung der Jahres-VZÄ“ wird die Methode pro Datenbestand gespeichert und im Serverbetrieb synchronisiert. Standard ist der Durchschnitt aus zwölf Monatsenden; der taggewichtete Jahresdurchschnitt bleibt wählbar. Dashboard, Jahrestabelle und deren Excel-/CSV-Exporte verwenden diese Einstellung. Jeder neu geöffnete Jahresnachweis übernimmt sie als Vorauswahl; eine abweichende Berichtsauswahl verändert die zentrale Einstellung nicht.

Arbeitszeitstände bleiben unverändert: `fte` bezeichnet weiterhin den Stellenanteil des angezeigten Arbeitszeitstands. Das Jahresdataset ergänzt `annualFte` pro Person und `annualSummary` für die historische Zuordnung zu Qualifikationen. Personendetails und Gesamtliste zeigen weiterhin den jeweiligen Arbeitszeitstand. Die Jahrestabelle zeigt die Qualifikation und Wochenstunden des letzten Stands im Jahr sowie den berechneten Jahresbeitrag der Person. Ihre Qualifikationsfilter beziehen sich deshalb auf den letzten Stand; die Qualifikationssummen im Dashboard und Jahresnachweis auf die zeitanteilige Zuordnung.

Die Personenzahl im Dashboard umfasst alle im Jahr Beschäftigten, einschließlich kurzer Einsätze ohne Monatsende. Auch der Durchschnitt je Person verwendet diese Kopfzahl. Untermonatige Einsätze ohne Monatsende tragen bei der Monatsendmethode null Jahres-VZÄ bei. Unbekannte Stellenanteile an relevanten Tagen bzw. Monatsenden bleiben als fehlend markiert; Summen mit fehlenden oder unbestätigten Werten werden als vorläufig bezeichnet.
