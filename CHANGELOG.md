# Änderungen in ClearDeck

## [Unreleased]

- Neu gestaltete Oberfläche: eigene Seitenleiste mit Übersicht, Team, Patient:innen, MD-Prüfung und Kalender, eigener Bereich für Verwaltung und Einstellungen.
- „Heute zu tun“ auf der Übersicht sammelt offene Fristen, Visiten und Datenlücken automatisch und springt direkt zum betroffenen Datensatz.
- Suche über Personen, Patient:innen, Seiten und Aktionen mit Strg+K.
- QPR-Teilgruppen A–D werden aus Mobilität (Modul 1) und Kognition (Modul 2) abgeleitet statt bewertet; eine aufwändige HKP-Leistung ergänzt Teilgruppe D zusätzlich.
- Pflegevisiten dokumentieren „Handlungsbedarf“ statt einer A–D-Note. Bisherige Visiten mit C oder D werden übernommen, die alten Buchstaben bleiben gespeichert.
- Neue Seite „MD-Prüfung“ mit Vorbereitungs-Checks, Stichprobenzählung gegen die Sollzahlen und erfassten Prüfergebnissen je Qualitätsbereich.
- Personenliste nach Anlage 7 als Excel exportieren.
- Pflegevisiten-Intervall und Erinnerung an Einweisungen sind einstellbar.
- Neue Seite „Tastenkürzel“; „Über ClearDeck“, „Sicherheit & Backup“ und „Logs & Diagnose“ als eigene Bereiche.
- Kalender: Tagesansicht per Klick, Filter nach Terminart. Termine östlich von Greenwich landen nicht mehr auf dem Vortag.
- App lässt sich über die Seitenleiste sperren; ohne Verschlüsselung verdeckt sie nur den Bildschirm und wird per Knopf wieder freigegeben.
- Einweisungen haben ein eigenes Wiederholungsintervall statt einer pauschalen Jahresfrist. Beim Abschließen entsteht ein Folgeeintrag, der abgeschlossene bleibt als Nachweis stehen.
- Bei Beschäftigten unter 18 wird das Intervall auf sechs Monate verkürzt (JArbSchG § 29 Abs. 2).
- Korrigierte Rechtsgrundlagen im Einweisungskatalog: Hygiene folgt aus BioStoffV / TRBA 250 statt IfSG, Medizinprodukte aus der MPBetreibV statt MDR/MPDG. Medizinprodukte haben bewusst kein Zeitintervall.
- Fünf fehlende Pflichtunterweisungen ergänzt: Gefahrstoffe, Ersthelfer-Fortbildung, Brandschutzhelfer, Hautschutz und die Belehrung nach IfSG § 43.
- Backups in einen wählbaren Ordner, automatisch beim Schließen sowie täglich oder wöchentlich, mit einstellbarer Aufbewahrung. Wiederherstellen legt vorher ein Sicherheits-Backup an.
- Passwort ändern, ohne dass Recovery-Key oder ältere Backups unbrauchbar werden.
- Excel-Exporte werden wieder geschrieben; sie schlugen zuvor mit „cannot save file" fehl.

- Neue Ansicht „Logs & Diagnose“ in den Einstellungen mit Zeitstempeln, Fehlerstufen und kopierbaren Ereignissen.
- Bereinigte Diagnosedatei bei Bedarf lokal speichern und einer Feedback-Nachricht anhängen.

- Updates gezielt herunterladen, mit Fortschrittsbalken und geschätzter Restzeit.
- Heruntergeladene Updates per zweitem Klick installieren und ClearDeck neu starten.
- Neuerungen direkt am Update-Symbol lesen, auch vor der Anmeldung.
- Update-Fehler bleiben sichtbar und lassen sich kopieren. Ein Fensterwechsel verwirft den Downloadstatus nicht mehr.
- Zuverlässigere Windows-Updates durch korrigierte Installationsdateinamen.
- Fehler beim Öffnen der lokalen Konfiguration werden angezeigt, statt die Ersteinrichtung anzubieten.

## [1.8.0]

- Überarbeitete Einstellungen mit eigenen Bereichen für Qualifikationen, Kompetenzen und Einweisungen.
- Links zu Hilfe und Releases öffnen sich im externen Browser.
- Detaillierte Kennzahlen im Dashboard zeigen fehlende Nachweise und den Stand der Kompetenzen.
- Kompetenzabzeichen und ein Kompetenzpass geben je Teammitglied Auskunft über vorhandene Fähigkeiten.
- Kompetenzstufen lassen sich in einem interaktiven Auswahlfeld bearbeiten.
- Eine Kompetenzmatrix und die Verwaltung von Einweisungen ergänzen die Nachweisübersicht.
- Vereinheitlichte Dialoge und verständlichere Hinweise bei der Anmeldung.
- Die lokale Datenbank kann auch ohne Verschlüsselung verwendet werden.
- Überarbeitete Funktionen zum Zurücksetzen lokaler Daten und zum Laden von Demodaten.
- Änderungen an Wochenstunden und VZÄ werden historisiert.
- Einstellungen zeigen installierte und angebotene Update-Versionen getrennt an.
- Korrigierte Auswahl der Update-Quelle, wenn keine Umgebungsvariable gesetzt ist.

## [1.7.2]

- Angepasste App-Paketierung für Windows-Updates mit Squirrel.

## [1.7.1]

- Überarbeitete Bereinigung und Aufbewahrung von Build-Dateien bei der Veröffentlichung.

## [1.7.0]

- Patient:innen in einem eigenen Dialog anlegen und bearbeiten.
- Geburtstage und Besuche von Patient:innen erscheinen im Kalender.
- Verbesserte Eingabe von Geburtsdaten und einheitliche Datumsanzeige.
- Kürzere Aufbewahrung von Build-Dateien verhindert Speicherprobleme bei der Veröffentlichung.

## [1.6.0]

- Neue Paketversion ohne zusätzliche Funktionsänderungen.

## [1.5.0]

- Patient:innenverwaltung mit Besuchsdokumentation und Bewertung nach QPR 2026.
- Kalender mit Monats-, Wochen- und Jahresansicht sowie Ereignisfiltern.
- Kommende Termine, Geburtstage und Jubiläen werden im Dashboard angezeigt.
- Verbesserte Anordnung der Dashboard-Karten auf verschiedenen Bildschirmgrößen.
- Die zwischenzeitliche Abteilungsverwaltung wurde wieder entfernt.
- Eine Content Security Policy begrenzt die im App-Fenster zulässigen Inhalte.
- Ergänzte Projektkonfiguration für Build, Typprüfung und Codeprüfung.

## [1.4.12]

- Überarbeitete Darstellung des Logos in Sidebar und Infobereich.

## [1.4.11]

- Korrigierte Erkennung des App-Namens bei der macOS-Paketierung.

## [1.4.10]

- Ergänzte lokale Signierung der macOS-App beim Erstellen der Pakete.

## [1.4.9]

- Eigener Installationsschritt für die Anwendung von Abhängigkeitspatches.

## [1.4.8]

- Unterstützung für Abhängigkeitspatches im Build ergänzt.

## [1.4.7]

- Präzisere Beschreibung der Teamübersicht und ergänztes App-Symbol.

## [1.4.6]

- Verbesserte Auswahl der Installationsdateien für Update-Metadaten.
- Der Release-Befehl erzeugt die Update-Metadaten mit.

## [1.4.5]

- GitHub-Update-Konfiguration wird im App-Paket mitgeliefert.

## [1.4.4]

- App-Symbole und typisierte Bildimporte ergänzt.

## [1.4.3]

- ClearDeck-Logo in Sidebar und Einstellungen ergänzt.

## [1.4.2]

- Name der ausführbaren Datei auf ClearDeck umgestellt.

## [1.4.1]

- Update-Metadaten werden bei der Veröffentlichung automatisch erzeugt.
- Sidebar an kleinere Bildschirmgrößen angepasst.

## [1.4.0]

- Employee DB heißt jetzt ClearDeck.
- Überarbeiteter Infobereich mit Version, Systeminformationen, Lizenz und Kontakt zum Entwickler.
- Verbesserte Darstellung der Support-Verknüpfung.

## [1.3.3]

- Authentifizierter Zugriff auf Updates aus dem privaten GitHub-Repository ergänzt.

## [1.3.2]

- Abhängigkeit zur Verarbeitung der Update-Metadaten aktualisiert.

## [1.3.1]

- Zusätzliche Teamdaten und Qualifikationen in der Teamtabelle ergänzt.

## [1.3.0]

- Neue Dialoge zum Anlegen und Bearbeiten von Teammitgliedern.
- Überarbeitete Detailansicht mit chronologischer Darstellung, Ereignissymbolen und Qualifikationen.
- Sortierbare Teamtabelle und verbesserte Formular-, Fokus- und Scroll-Darstellung.
- Überarbeitete Einstellungen mit Tabs für Datenbank, Qualifikationen und System.
- Qualifikationsübersicht und verbesserte Karten im Dashboard.
- Einheitliche Bezeichnung „Team“ sowie überarbeitete Sidebar.
- VZÄ-Berechnung ergänzt und auf maximal 1 je Person begrenzt.
- Qualifikationen und Notizen werden Beschäftigungszeiträumen zugeordnet; vereinfachte Verwaltung dieser Zeiträume.
- Neue Teammitglieder erhalten automatisch ein Eintrittsereignis.
- Ereignisse nutzen vorgegebene Bezeichnungen statt freier Titel.
- Nicht mehr verwendete Teamdatenfelder und überflüssige Statushinweise entfernt.
- Versionierte Datenbankmigrationen, reparierte Datenbankverknüpfungen und Werkzeuge zur Datenbankinspektion.
- Überarbeitete Datenbankverbindung, Verschlüsselung und Beispieldaten.
- Zentralisierte API-Aufrufe und aufgeteilte Logik für Teamverwaltung, Bestätigungen, Wiederherstellung und Updates.
- Automatisierte Tests und Typkonfiguration ergänzt.
- macOS-Installation als DMG ergänzt.

## [1.2.0]

- Wiederherstellungsschlüssel anzeigen und für die Passwortwiederherstellung verwenden.

## [1.1.8]

- Korrigierte API-Anbindung für Update-Status und Update-Prüfung.

## [1.1.7]

- Update-Hinweis mit Zurückstellfunktion in der Sidebar.
- Korrigierte Markierung der Navigation beim Anzeigen und Bearbeiten von Teammitgliedern.

## [1.1.6]

- Korrigierte Schreibberechtigungen beim Veröffentlichen von Releases.

## [1.1.5]

- Windows-kompatible Build-Konfiguration und angepasster Name der ausführbaren Datei.

## [1.1.4]

- Neue Paketversion ohne zusätzliche Funktionsänderungen.

## [1.1.3]

- Überarbeitete Versionsvergabe und Tag-Erstellung beim Veröffentlichen.
