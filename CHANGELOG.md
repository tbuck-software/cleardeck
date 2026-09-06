# Änderungen in ClearDeck

## [Unreleased]

## [2.0.0]

- Neu gestaltete Oberfläche mit Übersicht, Team, Patient:innen, MD-Prüfung, Kalender und eigenen Einstellungsseiten. Hilfe ist direkt am jeweiligen Formular erreichbar.
- „Heute zu tun“ sammelt offene Fristen, Visiten, Maßnahmen und Datenlücken. Globale Suche mit Strg+K führt zu Personen, Seiten und Aktionen.
- Kleine Fenster zeigen eine kompakte Navigation und gestapelte Listen. Der Aufgabenzähler bleibt als „9+“ lesbar; Tooltip und breite Navigation zeigen die genaue Anzahl.
- Patientenlisten lassen sich nach Name, Diagnose, Teilgruppe, Visitenanzahl und Terminen auf- oder absteigend sortieren. Fehlende Werte bleiben am Ende.
- Beschäftigungsabschnitte, Wiedereintritte, Qualifikationen und historische Wochenstunden bleiben nachvollziehbar. Stichtags- und Jahresmittelauswertungen berücksichtigen den jeweils gültigen Stellenanteil.
- Personalbestände aus Excel/CSV mit Vorschau und Prüfung übernehmen. Jahresnachweise und Excel-Exporte verwenden die ausgewählten Zeiträume und Werte.
- Einweisungen dokumentieren Durchführung, Inhalte, Beleg und Folgetermin getrennt. Sammelzuordnung und regelbezogene Wiedervorlagen ergänzen den korrigierten Katalog; die Jugendregel gilt nur für die dafür einschlägigen Unterweisungen.
- Einarbeitung und Kompetenzen dokumentieren Stufen, Bestätigung und Verlauf. Offene Nachweise bleiben von durchgeführten Einweisungen unterscheidbar.
- QPR-Stichprobenmerkmale werden aus Mobilität und Kognition ermittelt. Mehrere aufwändige HKP-Leistungen, Einstufungsquelle, Gutachtendatum und ungeklärte Angaben bleiben getrennt erfasst.
- Personenliste nach Anlage 7 exportieren, einschließlich Versorgungsumfang, Vertretung und AKI/pHKP. Die MD-Seite zeigt Merkmalsbestände und Vorbereitungsbedarf; sie führt keine offizielle Zufallsziehung durch.
- Pflegevisiten als geplant oder durchgeführt dokumentieren. Maßnahmen erhalten Zuständigkeit, Termin und Erledigung. Bisherige Visitenbewertungen bleiben als historische Angaben erhalten.
- MD-Prüfungen enthalten Entwurfsstatus, Qualitätsbereiche und eine Referenz zum vollständigen Originalbericht. Interne Zusammenfassungen werden nicht als offizieller Gesamtbuchstabe ausgegeben.
- Datenbestände aus 1.7.1 und 1.8.0 werden beim ersten Öffnen automatisch weitergeführt. Vor einer Migration entsteht automatisch eine Sicherheitskopie. Fehler verändern den Originalbestand nicht; bisheriges Passwort und Schlüssel bleiben gültig.
- Verbesserte Sicherung und Wiederherstellung, einstellbarer Sicherungsordner und Aufbewahrung. Ältere Backups bleiben nach einem Passwortwechsel verwendbar. Fehlende Datenbanken oder fehlerhafte Konfigurationen führen nicht zu einem leeren Ersatzbestand.
- Updates gezielt herunterladen, Fortschritt und geschätzte Restzeit sehen, anschließend installieren und neu starten. Updatefehler bleiben sichtbar und kopierbar; Neuerungen übersprungener Versionen sind nachlesbar.
- Windows-Update-Metadaten verwenden eindeutige Installationsdateinamen. Lokale Logs und bereinigte Diagnoseexporte erleichtern die Fehlerklärung.
- Separater Entwicklungsmodus mit umfangreichem synthetischem Demo-Bestand und automatischer Übernahme von Codeänderungen. Produktionsdaten werden dabei nicht verwendet.

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
