# ClearDeck: fachliches und funktionales Gesamt-Review

Stand: 06.09.2026. Geprüfter Commit: `d36919fa9055c315d36dea7e402b968f32c097af`, Branch `feat/update-download-flow`. Der Arbeitsbaum war zu Beginn sauber. Gegenstand ist der gesamte aktuelle Funktionsumfang, nicht nur der Branch-Diff.

**Historischer Prüfstand:** Dieser Bericht beschreibt den oben genannten Ausgangscommit. Die spätere Behebung und erneute Prüfung stehen im [Behebungsbericht](2026-09-06-cleardeck-behebung.md). F14 wurde dort anhand der inzwischen ausgewerteten Anforderungen präzisiert: Die Schwelle von 36 Wochenstunden ist ausdrücklich gewünscht; fehlerhaft waren ihre uneindeutige Konfiguration und Übernahme.

ClearDeck hat einen sinnvollen Kern: historische Personalübersicht, Nachweisverwaltung und eine gemeinsame Arbeitsliste für die Pflegedienstleitung. In der vorliegenden Form würde ich es jedoch nicht als verlässliche alleinige Grundlage für Jahresnachweise, Unterweisungsfristen oder MD-Vorbereitung einsetzen. Mehrere normale Bedienwege erzeugen falsche Ergebnisse oder löschen Daten. Der Ausbau um QM-Funktionen ist dem konsistenten Datenmodell vorausgelaufen.

Diese Einschätzung beruht auf Quellcodeprüfung, eigenen Reproduktionen, einer laufenden Electron-Oberfläche mit getrenntem Testprofil und einem unabhängigen Abgleich der fachlichen Aussagen mit Primärquellen. Vorhandene Research-Dateien und ADRs wurden als Prüfgegenstand behandelt. Es wurden keine App-Funktionen geändert.

## Priorisierte, belegbare Befunde

P1 bedeutet: vor einem verlässlichen produktiven Einsatz beheben, weil Datenverlust, falsche Nachweise oder verdeckte Pflichten entstehen. P2 bedeutet: relevante Funktions- oder Modelllücke, zeitnah beheben. Die Priorität ist eine Review-Einschätzung, keine gesetzliche Einstufung. „Reproduziert“ bezeichnet eine eigene Ausführung; „Codebeleg“ einen nachvollzogenen, nicht vollständig durchgespielten Ablauf.

### F01 · P1 · Wiederherstellung entfernt den aktuellen Bestand vor der Validierung

Fundstelle: [backup.ts:168](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/backup.ts:168), [connection.ts:130](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/connection.ts:130), [export.ts:83](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/export.ts:83).

`restoreBackup` schließt die Datenbank und entfernt Arbeitsdatei sowie verschlüsselten Stand, bevor die ausgewählte Sicherung entschlüsselt und als Datenbank geöffnet wurde. Eine ungültige verschlüsselte Datei hinterlässt damit keinen aktuellen Bestand. Im Fehlerpfad wird erneut geöffnet, gegebenenfalls eine neue Datenbank angelegt und mit Demodaten befüllt. Das Sicherheits-Backup kann noch existieren; es wird aber nicht automatisch zurückgespielt.

Reproduziert mit dem tatsächlichen Backup-Modul, realen temporären Dateien und ersetzter Verbindungsverwaltung: ungültige Datei führt zu `saved: false`, beide vorherigen lokalen Datenbankdateien sind entfernt. Das erneute Öffnen war im Test ein Stub; die anschließende Demobefüllung folgt aus F03. Auch der über „Stattdessen Datei wählen“ erreichbare Import überschreibt vor einer erfolgreichen SQLite-Validierung und hat keinen Rollback. Empfehlung: Quelle zunächst separat entschlüsseln, prüfen und migrieren; den Bestand erst nach Erfolg atomar austauschen, bei Fehler unverändert lassen.

### F02 · P1 · Das Sicherheits-Backup verändert die gewählte Wiederherstellungsquelle

Fundstelle: [backup.ts:47](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/backup.ts:47), [backup.ts:65](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/backup.ts:65), [backup.ts:88](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/backup.ts:88), [backup.ts:157](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/backup.ts:157).

Zwei getrennte Auslöser wurden reproduziert. Erstens enthalten Dateinamen nur Minuten: Sicherung erstellen, Daten ändern und dieselbe Sicherung innerhalb derselben Minute wiederherstellen überschreibt die Quelle mit den geänderten Daten. Die App meldet Erfolg, hat aber den gewünschten alten Stand verloren. Zweitens entfernt `prune` nach dem Sicherheits-Backup die älteste Sicherung. Bei fünf vorhandenen Ständen und Aufbewahrung von fünf Ständen kann dies genau die ausgewählte Quelle sein. Danach läuft die Wiederherstellung in F01.

Empfehlung: eindeutige Dateinamen, Quelle vor jedem Schreibzugriff sichern und die laufende Wiederherstellungsquelle sowie das Sicherheits-Backup von der Bereinigung ausnehmen.

### F03 · P1 · Neue oder personalleere Datenbanken erhalten ungefragt Demodaten

Fundstelle: [connection.ts:141](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/connection.ts:141), [seed.ts:141](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/seed.ts:141).

`openDatabase` ruft immer `seedDatabase` auf. Dessen einzige Schranke ist, ob mindestens ein Mitarbeiter existiert. Eine Produktions-/Demo-Unterscheidung fehlt. Nach dem Einrichten des isolierten Profils zeigte die Oberfläche ohne Datenimport 72 Patient:innen und 25 Beschäftigte im Jahr 2026 sowie zahlreiche Nachweise und Aufgaben. Es gab keinen Schritt zur bewussten Auswahl eines Demobestands.

Auch ein Dienst, der zunächst ausschließlich Patient:innen pflegt, oder das Löschen des letzten Mitarbeiters kann beim nächsten Öffnen eine erneute Befüllung auslösen. Empfehlung: Referenzkataloge und Demopersonen getrennt initialisieren; Demodaten nur in einem ausdrücklich gewählten Modus.

### F04 · P1 · Jahresnachweis zeigt und exportiert das falsche Jahr

Fundstelle: [renderer.tsx:990](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/renderer.tsx:990), [renderer.tsx:1511](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/renderer.tsx:1511), [useEmployees.ts:342](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useEmployees.ts:342).

Vom Dashboard 2026 öffnet „Jahresnachweis 2025 erstellen“ nur `reportYear = 2025`. Der übergebene `dataset` bleibt 2026; der Export verwendet ebenfalls das globale `year = 2026`. In der laufenden Oberfläche stand dadurch unter „Gesamt 2025“ exakt die vorherige Summe von 25 Personen und 18,20 VZÄ aus 2026. Der tatsächliche 2025-Datensatz enthielt im selben Profil 23 Personen und 17,41 VZÄ. Erst ein zusätzlicher Jahreswechsel im Dialog synchronisiert die Auswahl.

Empfehlung: Der Bericht muss einen eigenen, zum Berichtjahr geladenen Datensatz besitzen. Anzeige, Prüfung und Export müssen dasselbe Jahr verwenden.

### F05 · P1 · Heutige Stundenänderungen verändern historische VZÄ

Fundstelle: [employees.ts:105](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:105), [employees.ts:224](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:224), [employeeHistory.ts](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/employeeHistory.ts).

Wochenstunden und VZÄ liegen global an der Person. Historische Beschäftigungsperioden tragen diese Werte nicht. Änderungsereignisse werden zwar geschrieben, bei Jahresauswertungen aber nicht zur Rekonstruktion verwendet. Reproduziert: Die Jahresübersicht 2024 zeigte zunächst 1,00 VZÄ. Nach einer Stundenänderung auf 0,50 im heutigen Bestand zeigte dieselbe Übersicht 2024 ebenfalls 0,50.

Dies widerspricht dem Kernziel, historische Stellenanteile ohne erneute Aktenrecherche nachzuweisen. Empfehlung: wirksame Zeiträume für Stunden/Stellenanteil, getrennt von Erfassungszeitpunkten; vergangene Berichte aus diesen Zeiträumen berechnen.

### F06 · P1 · Ein- und Austrittsereignisse widersprechen Beschäftigungsperioden

Fundstelle: [employees.ts:75](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:75), [employees.ts:116](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:116), [employees.ts:134](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:134), [dashboard.ts:215](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/dashboard.ts:215).

Die Vorauswahl erfolgt anhand der Perioden. Danach überschreiben die jeweils spätesten Ein-/Austrittsereignisse sämtlicher Jahre die Datumswerte. Die Zugehörigkeit zum Zieljahr wird anschließend nicht erneut geprüft. Reproduziert: Ein Austritt am 30.06.2024 ließ die Person 2025 als „aktiv“ erscheinen. Ein Wiedereintritt am 01.03.2026 setzte in der Übersicht 2024 das Eintrittsdatum auf 2026. Andere Kennzahlen bestimmen aktive Beschäftigung wiederum nur aus Perioden.

Empfehlung: eine maßgebliche Beschäftigungshistorie, aus der Listen, Status, Kalender und Fristen dieselben Zeiträume ableiten. Ereignisse dürfen keine zweite konkurrierende Wahrheit bilden.

### F07 · P1 · Der ausgewiesene Stichtagsnachweis zählt Beschäftigung irgendwann im Jahr

Fundstelle: [ReportModal.tsx:63](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/ReportModal.tsx:63), [employees.ts:38](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:38), [employees.ts:116](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:116).

Der Bericht bestätigt „Stichtag 31.12.“, summiert aber alle Personen mit irgendeiner Überschneidung zum Jahr. Reproduziert: Eine Vollzeitkraft mit Austritt am 30.06.2024 zählt im angeblichen Stichtagsnachweis 2024 weiterhin mit einer Person und 1,00 VZÄ. Eine Jahresdurchschnittsrechnung findet ebenfalls nicht statt.

Eine Liste aller im Jahr Beschäftigten ist als historische Übersicht sinnvoll. Sie ist fachlich eine andere Auswertung. Welche Kennzahl der konkrete Krankenkassenverband verlangt, ist ohne dessen Formular/Vertrag nicht abschließend bekannt. Unabhängig davon ist die Stichtagsbeschriftung der jetzigen Rechnung falsch. Empfehlung: Auswertungsart explizit festlegen und entsprechend rechnen.

### F08 · P1 · Speichern einer Unterweisungsdefinition entfernt ihr Intervall

Fundstelle: [useEmployees.ts:511](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useEmployees.ts:511), [instructions.ts:80](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/instructions.ts:80), [InstructionModal.tsx:63](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/InstructionModal.tsx:63).

Das Formular zeigt Wiederholungsintervall und Herkunft, der Speicherhandler sendet aber nur Thema, Rechtsgrundlage und Notiz. Das Repository ersetzt die ausgelassenen Intervallfelder mit `null`. Damit verlieren bestehende Themen schon durch unverändertes Speichern ihre Wiederholung. Neue Themen speichern die gewählte Wiederholung ebenfalls nicht.

Zusätzlich zur Repository-Probe in der laufenden Oberfläche bestätigt: Arbeitsschutz öffnen, „Speichern“, erneut öffnen. Aus „jährlich · aus der Rechtsgrundlage“ wurde „Ohne Intervall wird nichts automatisch fällig“. Empfehlung: vollständige Übergabe und Prüfung des gespeicherten Zustands durch den echten Formularweg.

### F09 · P1 · Entfernen eines Unterweisungsnachweises löscht die ganze Themenhistorie

Fundstelle: [useEmployees.ts:814](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useEmployees.ts:814), [instructions.ts:277](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/instructions.ts:277), [EmployeeInstructionModal.tsx:50](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/EmployeeInstructionModal.tsx:50).

Das Modal bearbeitet einen konkreten Nachweis, „Entfernen“ löscht jedoch nach Mitarbeiter und Definition statt nach Nachweis-ID. Seit Einführung wiederkehrender Nachweise können mehrere Zeilen existieren. Reproduziert: Ein abgeschlossener Nachweis und seine offene Wiedervorlage verschwanden gemeinsam, Anzahl zwei auf null.

Empfehlung: Einzelnen Nachweis über seine ID entfernen. Das Beenden einer zukünftigen Pflichtzuordnung muss ein eigener Vorgang sein, der abgeschlossene Nachweise erhält.

### F10 · P1 · Gute MD-Ergebnisse entstehen ohne eine Eingabe

Fundstelle: [renderer.tsx:74](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/renderer.tsx:74), [renderer.tsx:779](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/renderer.tsx:779), [audits.ts:128](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/audits.ts:128).

Neue Prüfungen sind mit A für QB 1–3 und „erfüllt“ für QB 5 sowie Abrechnung vorbelegt. Ohne Prüfstelle, Befunde oder geprüfte Personen lässt sich sofort speichern. In der laufenden Oberfläche reproduziert: „Prüfung erfassen“, „Speichern“ ergibt A und „0 Klient:innen“. Der gespeicherte Datensatz enthält tatsächlich alle guten Bewertungen. Auch eine leere Ergebnisliste wird von `worstResult` zu A zusammengefasst.

Empfehlung: zunächst „nicht erfasst“ und bei Bedarf „nicht geprüft/nicht anwendbar“ verwenden. Ein guter Befund muss eine bewusste Eingabe sein; ein Entwurf darf nicht wie ein abgeschlossener Prüfbericht erscheinen.

### F11 · P1 · „Heute zu tun“ kann fällige Unterweisungen vollständig verbergen

Fundstelle: [useDashboardWidgets.ts:102](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useDashboardWidgets.ts:102), [dashboard.ts:371](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/dashboard.ts:371), [dashboardTasks.ts:117](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/dashboardTasks.ts:117).

Die Datenquelle lädt insgesamt nur 20 offene Unterweisungen. Auch die vollständige Aufgabenseite baut auf dieser begrenzten Liste auf. Bei mehr als 20 fälligen Einträgen fehlen weitere ohne Hinweis oder Nachladen. Die Abfrage filtert ausgeschiedene Personen nicht aus; deren Altpflichten können die ersten Plätze belegen. Einträge ohne Fälligkeitsdatum fehlen ebenfalls komplett.

Empfehlung: vollständige oder paginierte Arbeitsliste, gesonderte Vorschau auf dem Dashboard, klare Behandlung von ausgeschiedenen Personen und „Termin noch festzulegen“. Anzahl und Vollständigkeit müssen nachvollziehbar sein. Codebeleg; die vorhandenen Tests decken den durchgehenden Weg mit mehr als 20 Pflichten nicht ab.

### F12 · P1 · Personenliste kann aktuellen Versorgungsbestand nicht abgrenzen

Fundstelle: [patients.ts:89](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:89), [patients.ts:57](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:57), [export.ts:208](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/export.ts:208), [v014_qpr_stichprobe.ts:127](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/migrations/v014_qpr_stichprobe.ts:127).

Patient:innen haben keinen Versorgungsstatus, kein Versorgungsende und keine abgrenzbare Leistungsgrundlage. Der Anlage-7-Export übernimmt jede gespeicherte Person. Entlassene Personen bleiben darin; ausgeschlossene reine Leistungsarten lassen sich nicht gezielt herausfiltern. Löschen entfernt dagegen auch Visiten und die Zuordnung zu alten Prüfungen.

Die Grundgesamtheit ist in QPR Kap. 8 Abs. 1–3 geregelt. Empfehlung: aktive Versorgung und Leistungsumfang unabhängig von der Personenakte verwalten. Historie behalten, Export aus dem einschlägigen aktuellen Bestand bilden. [QPR, Kap. 8](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=25).

### F13 · P2 · Periodenpflege löscht das Geburtsdatum

Fundstelle: [useEventsPeriods.ts:148](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useEventsPeriods.ts:148), [employees.ts:202](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/employees.ts:202).

Der Handler für eine neue oder bearbeitete Beschäftigungsperiode sendet Mitarbeiterstammdaten ohne `birthDate`. Der gemeinsame Speicherweg setzt diesen Wert dann auf `null`. Reproduziert mit dem tatsächlichen Payload-Muster. Dies löscht einen bereits bekannten Wert und beeinflusst auch die Minderjährigenregel für Unterweisungen. Empfehlung: Perioden getrennt speichern oder ausgelassene Stammdaten unverändert lassen.

### F14 · P2 · VZÄ-Basis und angezeigte Berechnung sind inkonsistent

Fundstelle: [fte.ts:1](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/fte.ts:1), [useAuth.ts:161](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useAuth.ts:161), [useSettingsDb.ts:33](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useSettingsDb.ts:33).

Die Berechnung erklärt jede Wochenstundenzahl ab 36 unabhängig von der eingestellten Vollzeitbasis zu 1,00. Reproduziert: 36 Stunden bei Basis 40 ergeben 1,00 statt 0,90. Zusätzlich lädt der eigentliche Login-/Einrichtungsweg die gespeicherte Basis nicht wie die initiale Zustandsermittlung. Im frischen Testprofil waren per API 38 Stunden gespeichert, während Dashboard und Bericht Basis 36 zeigten.

Empfehlung: genau eine Berechnungsdefinition und eine geladene Basis verwenden. Eine betriebliche 36-Stunden-Grenze müsste ausdrücklich erklärt werden; sie ist keine allgemein nachgewiesene VZÄ-Regel.

### F15 · P2 · Anlage-7-Angaben passen nicht vollständig in das Datenmodell

Fundstelle: [patients.ts:89](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:89), [PatientModal.tsx](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/patients/PatientModal.tsx), [workbook.ts:37](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/workbook.ts:37).

`hkpCode` speichert nur eine Ziffer. `intensiveCare` enthält keine separate EV/MV-Angabe und keine hinreichenden Angaben für die zeitabhängige pHKP-Erstverordnung. Der Export kann fehlende Daten nicht ergänzen. Das betrifft reale Kombinationen, die bereits das amtliche Listenmuster zeigt. Empfehlung: mehrere HKP-Ziffern und die benötigten Spezialversorgungsmerkmale abbilden, sofern diese Versorgung unterstützt werden soll. [QPR, Anlage 7](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=291).

### F16 · P2 · Einstufungsquelle und Aktualität sind nicht prüfbar

Fundstelle: [patients.ts:89](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:89), [PatientModal.tsx](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/patients/PatientModal.tsx), [dashboardTasks.ts:72](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/dashboardTasks.ts:72).

Die App speichert nur die beiden Beeinträchtigungsmerkmale. Gutachtendatum, Quelle und Zeitpunkt einer eigenen Einschätzung fehlen. Eine einmal ausgefüllte Einstufung gilt in den Vollständigkeitsanzeigen unbegrenzt als vollständig. Ausgewählte Ja-/Nein-Werte lassen sich im Formular zudem nicht wieder auf unbekannt zurücksetzen. „Gutachten-Daten fehlen“ ist als Aufgabenname zu eng, weil eine eigene Einschätzung vorgesehen ist.

Die QPR verlangt bei fehlendem oder über ein Jahr altem Begutachtungsergebnis eine eigene Einschätzung. Empfehlung: Quelle und Stand erfassen, unbekannt von nein unterscheiden, erneute Prüfung gezielt anfordern. [QPR, Kap. 8 Abs. 3](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=26).

### F17 · P2 · Stichprobenanzeige behauptet ein Verfahren für alle Dienste

Fundstelle: [AuditPage.tsx:66](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/AuditPage.tsx:66), [AuditPage.tsx:105](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/AuditPage.tsx:105).

Die Seite zeigt immer A/B/C je zwei und D drei, auch wenn AKI/pHKP angezeigt wird. Eine Dienst-/Vertragskonfiguration zur Wahl des einschlägigen Verfahrens fehlt. In der Testoberfläche stand die pauschale Ziehungsanweisung unmittelbar neben „AKI/pHKP 4“. Für spezialisierte Dienste gelten Kap. 8.2/8.3. Zudem zählt `countNone` Personen ohne Beeinträchtigung unabhängig von HKP, beschriftet sie aber als „ohne HKP“ und nicht stichprobenrelevant. [QPR, Kap. 8.1–8.3](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=28).

Empfehlung: Umfang klar auf allgemeine ambulante Pflege begrenzen oder Vertrags-/Versorgungsprofil berücksichtigen. Bestandszahlen sind außerdem keine Simulation der tatsächlichen Zufallsauswahl und sollten nicht als bestätigte Stichprobeneignung erscheinen.

### F18 · P2 · Prüfergebnis wird auf der falschen Ebene gespeichert

Fundstelle: [audits.ts:47](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/audits.ts:47), [AuditModal.tsx:125](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/AuditModal.tsx:125), [v014_qpr_stichprobe.ts:117](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/migrations/v014_qpr_stichprobe.ts:117).

Die App speichert einen Wert pro Qualitätsbereich und Prüfung. Eine Zuordnung zu Person und Qualitätsaspekt fehlt. Der Dialog verlangt trotzdem „Ergebnisse aus dem Prüfbericht“. Die amtlichen personenbezogenen Ergebnisse sind damit nicht verlustfrei übertragbar. Auch QB 5 und Abrechnung werden auf einen pauschalen Schalter verdichtet. Maßgeblich sind QPR Kap. 7.2/7.3 und Anlage 6. [QPR, Anlage 6](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=287).

Empfehlung: entweder ausdrücklich nur eine interne Kurznotiz mit Verweis auf den Originalbericht anbieten oder die Einzelbefunde modellieren. Der schwächste Buchstabe darf nicht den Zugang zu den Befunden ersetzen. Das ADR weist bereits auf diese Grenze hin; die Implementierung löst sie nicht.

### F19 · P2 · Eine zukünftige Visite gilt schon als durchgeführt und kann Handlungsbedarf aufheben

Fundstelle: [patients.ts:63](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:63), [patients.ts:190](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:190), [VisitModal.tsx](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/patients/VisitModal.tsx).

Es gibt keinen Unterschied zwischen geplanter und durchgeführter Visite. Die datumsmäßig letzte Zeile bestimmt den Handlungsbedarf, auch wenn sie in der Zukunft liegt. Reproduziert: aktuelle Visite mit Handlungsbedarf, danach zukünftige Visite ohne Flag. Die Person verschwindet sofort aus der Handlungsbedarfsabfrage. Die Demodaten zeigen künftige Termine gleichzeitig als „Letzte Visite“.

Empfehlung: Planung und Durchführung trennen; zukünftige Planung darf keinen bestehenden Befund erledigen. Bei mehreren Visiten am selben Datum braucht die Auswahl der letzten Durchführung zudem eine eindeutige Reihenfolge, die aktuelle Sortierung nur nach Datum reicht nicht.

### F20 · P2 · Ohne Aufnahmedatum wird eine Erstvisite niemals fällig

Fundstelle: [qpr.ts:119](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/qpr.ts:119).

Fehlen letzte Visite und Aufnahmedatum, wird „heute“ als Ausgangspunkt verwendet. Die Fälligkeit bleibt dadurch jeden Tag „in 14 Tagen“. Reproduziert am 06.09. und 06.10. mit derselben leeren Eingabe. Empfehlung: fehlendes Bezugsdatum als Datenlücke darstellen oder einen festen, fachlich vereinbarten Ausgangspunkt speichern. Die 14 Tage sind eine interne Produktregel, keine hier nachgewiesene QPR-Frist.

### F21 · P2 · Kalender und Dashboard zeigen unterschiedliche Arten von Fristen

Fundstelle: [useCalendar.ts:134](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useCalendar.ts:134), [unifyEvents.ts:45](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/unifyEvents.ts:45), [dashboard.ts:23](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/dashboard.ts:23).

Der Kalender lädt nur Mitarbeiterereignisse, Patientengeburtstage und gespeicherte Visiten. Unterweisungs-Wiedervorlagen, aus Stammdaten abgeleitete Mitarbeitergeburtstage und Zertifikatsabläufe fehlen in dieser Datenquelle. Das Dashboard verwendet andere Quellen und zeigt deshalb Ereignisse, die beim Wechsel in den Kalender verschwinden. Der Filter „Einweisungen“ suggeriert mehr, als die Datenquelle liefert.

Bereits abgelaufene Fortbildungszertifikate werden außerdem durch `expiresAt >= today` aus der Vorschau ausgeschlossen und tauchen in der Aufgabenberechnung gar nicht auf. Empfehlung: einen gemeinsamen Termin-/Fristenbestand für Vorschau und Kalender verwenden; abgelaufene Nachweise ausdrücklich als offene Arbeit führen.

### F22 · P2 · Kalenderdaten verschieben sich durch UTC-Umwandlung

Fundstelle: [patients.ts:320](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/patients.ts:320), [Dashboard.tsx:84](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/Dashboard.tsx:84), [useCalendar.ts:61](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useCalendar.ts:61), [useCalendar.ts:191](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/hooks/useCalendar.ts:191).

Lokales Mitternacht wird teilweise mit `toISOString` in UTC umgerechnet und dann als Kalendertag abgeschnitten. Reproduziert in Europe/Berlin: Geburtstag 10.09. wird als 09.09. ausgegeben. In der laufenden Oberfläche stand oben Sonntag, 06.09., während ein Termin am 05.09. als „heute“ erschien. Dasselbe Muster betrifft Tagesgrenzen von Abfragen. Unabhängig davon überspringt die Monatsnavigation mit `setMonth` bei einem Ausgangsdatum 31.01. den Februar.

Empfehlung: reine Kalendertage ohne Zeitzonenkonvertierung verarbeiten, lokale Tagesgrenzen einheitlich bestimmen und Monatsnavigation auf den Monatsersten setzen.

### F23 · P2 · Minderjährigenregel wird auf sachfremde Themen übertragen

Fundstelle: [instructionSchedule.ts:37](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/instructionSchedule.ts:37), [ADR 0002:34](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/docs/adr/0002-unterweisungsintervalle-und-wiedervorlage.md:34).

`effectiveIntervalMonths` verkürzt jedes bekannte Intervall bei Minderjährigen auf höchstens sechs Monate. Das ADR behauptet ausdrücklich, § 29 JArbSchG gelte „für alle Themen dieser Person“. Das trägt die Norm nicht: Absatz 2 bezieht sich auf die in Absatz 1 geregelte Unterweisung über Unfall- und Gesundheitsgefahren. Daraus folgt keine automatische halbjährliche Wiederholung beliebiger Softwarekurse, Datenschutzthemen oder jedes anderen Katalogeintrags. [§ 29 JArbSchG](https://www.gesetze-im-internet.de/jarbschg/__29.html).

Empfehlung: sachlichen Anwendungsbereich je Thema bestimmen. Eine bewusst strengere betriebliche Regel ist möglich, muss aber als solche bezeichnet werden. ADR und Recherche entsprechend korrigieren, nicht nur den Code.

### F24 · P2 · Qualifikationsvorschläge behandeln einjährig Examinierte als „Nur PFK“

Fundstelle: [qualificationRelevance.ts:9](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/qualificationRelevance.ts:9), [defaultCatalog.ts:38](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/defaultCatalog.ts:38).

Das Teilwort „examiniert“ genügt für das PFK-Merkmal. Reproduziert: `1-jährig examiniert` erhält sowohl „Nur PFK“ als auch „Nur PHK“ und passt auf einen „Nur PFK“-Eintrag. Die Vorschläge widersprechen damit bereits der eigenen Unterscheidung im Katalog.

Empfehlung: eindeutige Qualifikationsklassen und bewusst gepflegte Berechtigungs-/Empfehlungsregeln. Die Empfehlung ist keine rechtliche Einsatzfreigabe. Ob bestimmte Behandlungspflege im konkreten Dienst delegierbar ist, lässt sich ohne dessen Verträge und Qualifikationsnachweise nicht abschließend beurteilen.

### F25 · P2 · Erledigt-Datum ersetzt keinen vollständigen Unterweisungsnachweis

Fundstelle: [EmployeeInstructionModal.tsx:91](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/EmployeeInstructionModal.tsx:91), [instructions.ts:150](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/instructions.ts:150).

Ein Durchführungstag genügt für „erledigt“. Inhalt kann über Thema/Notiz nur grob beschrieben werden; Unterschrift, Belegdatei oder verbindlicher Verweis auf einen Nachweis sind nicht modelliert. Für einschlägige Biostoff-/Gefahrstoffunterweisungen verlangen die Normen schriftlich festgehaltenen Inhalt und Zeitpunkt sowie die Bestätigung durch die Unterwiesenen. [§ 14 Abs. 3 BioStoffV](https://www.gesetze-im-internet.de/biostoffv_2013/__14.html), [§ 14 Abs. 2 GefStoffV](https://www.gesetze-im-internet.de/gefstoffv_2010/__14.html).

Als Fristenregister neben vorhandenen unterschriebenen Nachweisen kann die App sinnvoll sein. Sie sollte diesen Unterschied aber kenntlich machen und den Nachweis auffindbar verknüpfen. Dies ist keine Feststellung, dass ein konkreter Dienst seine Pflichten verletzt; dessen externe Unterlagen lagen nicht vor.

### F26 · P2 · Backupformat und Wiederanlauf nach Geräteverlust sind unvollständig

Fundstelle: [BackupTransferModal.tsx:37](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/BackupTransferModal.tsx:37), [renderer.tsx:1444](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/renderer.tsx:1444), [export.ts:83](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/export.ts:83), [backup.ts:175](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/backup.ts:175).

Verschlüsselte Exporte hängen am Datenschlüssel der bisherigen Installation. Die sichtbaren Importwege verwenden den aktuellen Schlüssel bzw. den aktuellen Speichermodus. Ein klarer Ablauf „neues Gerät, alte Sicherung, alter Recovery-Key“ fehlt. Im unverschlüsselten Modus bleibt die Exportoption „Verschlüsselt“ auswählbar, obwohl kein Schlüssel vorhanden ist. Automatische `.cdb`-Backups können je nach Modus Klartext oder verschlüsselt sein, ohne dass das Format die Auswahl steuert.

Bei „Stattdessen Datei wählen“ aktualisiert der erfolgreiche Import außerdem nur den Mitarbeiterdatensatz, nicht alle bereits geladenen Patient:innen, Prüfungen und Kataloge. Empfehlung: überprüfbares Backupformat mit Format-/Schlüsselerkennung, dokumentierter Wiederanlauf auf einem leeren Gerät und vollständiges Neuladen des Bestands. Automatische Backupfehler dürfen nicht still verschwinden; `runAutoBackupIfDue` ignoriert derzeit das Fehlerergebnis.

### F27 · P2 · „Verschlüsselt“ schützt die offene Arbeitsdatei nicht

Fundstelle: [connection.ts:96](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/connection.ts:96), [connection.ts:147](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/connection.ts:147), [Anforderungsdokument](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/docs/anforderungsdokument.md).

Während der Benutzung liegt die entschlüsselte SQLite-Datenbank als Datei auf dem Datenträger. Verschlüsselung und Entfernung der Klartextdatei erfolgen beim Persistieren/Sperren/Beenden. Ein Prozessabbruch kann sie zurücklassen. Das widerspricht der dokumentierten Anforderung „Nutzung im Arbeitsspeicher, kein Klartext-Storage“.

Empfehlung: tatsächliches Schutzziel entscheiden und entweder die Umsetzung anpassen oder die Anforderung und Sicherheitsanzeige präzisieren. Das ist eine belegte Architekturgrenze, keine pauschale Aussage zur DSGVO-Konformität eines konkreten Betriebs.

### F28 · P2 · Excel-Export enthält die angezeigte Jahreszusammenfassung nicht

Fundstelle: [ReportModal.tsx:91](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/ReportModal.tsx:91), [export.ts:153](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/export.ts:153).

Der Jahresnachweis zeigt Personen/VZÄ je Qualifikation und Gesamtsummen. „Als Excel exportieren“ erzeugt jedoch nur das Blatt `Team` mit Einzelpersonen. Die sichtbare Zusammenfassung, Stichtag und Rechenbasis fehlen. Damit muss die für den Empfänger gedachte Übersicht wieder manuell hergestellt werden. Empfehlung: ein Berichtsblatt mit denselben geprüften Aggregationen und Rahmenangaben zusätzlich zur Personenliste exportieren.

### F29 · P2 · Die Erinnerungseinstellung wirkt nicht auf die Aufgabenliste

Fundstelle: [SettingsGeneral.tsx](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/settings/SettingsGeneral.tsx), [renderer.tsx:389](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/renderer.tsx:389), [dashboardTasks.ts:119](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/dashboardTasks.ts:119).

Die Einstellung verspricht, dass 14/30/60 Tage steuern, wann eine Einweisung in „Heute zu tun“ erscheint. Die Aufgabenfunktion verwendet fest 30 Tage; `instructionReminderDays` wird ihr nicht übergeben. Empfehlung: die gespeicherte Einstellung durchgängig in Aufgaben, Kennzahlen und Detailstatus anwenden.

### F30 · P2 · Ein optionaler Kontakt wird als dauerhafte Datenlücke behandelt

Fundstelle: [dashboardTasks.ts:103](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/dashboardTasks.ts:103), [AuditPage.tsx:93](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/AuditPage.tsx:93).

Jede Person ohne Kontakttext erzeugt „Bevollmächtigte/Betreuung fehlt“, obwohl dieselbe Oberfläche ausdrücklich „sofern vorhanden, sonst leer lassen“ erklärt. Eine Person ohne Vertretung lässt sich deshalb nicht als vollständig geprüft markieren. Empfehlung: „nicht vorhanden“, „unbekannt“ und vorhandene Kontaktdaten unterscheiden. Ein Kontakttext wie „keine“ darf nicht der notwendige Umweg zur Bereinigung der Arbeitsliste sein.

## Fachliche Prüfung der Dokumente

Die QPR-Recherche bleibt als ausdrücklich auf die Originalfassung bezogene Recherche sinnvoll. Die Produktentscheidungen gehören weiterhin nach `docs/adr`; die Recherche nach `docs/research`. Ein ADR belegt eine Entscheidung, aber nicht deren fachliche Richtigkeit oder Implementierung. Dieses Gesamt-Review gehört deshalb nach `docs/reviews`.

| Dokument/Aussage | Ergebnis des unabhängigen Abgleichs |
| --- | --- |
| QPR-Originalfassung 19.05.2025 als historischer Bezug | Zulässig, wenn als Originalfassung bezeichnet. Für den heutigen Betrieb ist die konsolidierte Fassung ab 30.07.2026 heranzuziehen. Laut MD Bund wurde ausschließlich die Ankündigung in Kap. 4 Abs. 2 geändert. [MD-Mitteilung vom 29.07.2026](https://md-bund.de/aktuell/aktuelle-meldungen/neue-qualitaetspruefungs-richtlinien-fuer-ambulante-pflege-und-betreuungsdienste.html). |
| Ankündigung zwei Arbeitstage | Bestätigt. Die Formulierung bei Anlassprüfungen sollte das normative „sollen unangemeldet erfolgen“ erhalten. [QPR, Kap. 4 Abs. 2](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=15). |
| QPR-Stichprobe und Bewertungsarten | Kern der Recherche bestätigt: A–C je zwei, D drei; D zusätzlich als Merkmal; HKP 6/8/29/31a; keine beliebige Auffüllung. Stichprobenmerkmale sind keine Qualitätsnoten. Einschränkungen für Spezialversorgung und Einzelbefunde müssen in der App erhalten bleiben, siehe F15–F18. [QPR, Kap. 7/8 und Anlage 7](https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=22). |
| ADR 0001, mehrere HKP/unklare Einstufung/Ergebnisgranularität | Die Präzisierungen im hinteren Dokumentteil sind fachlich wichtige Einschränkungen. Die App setzt sie noch nicht vollständig um. Die frontale Modellskizze und die spätere Präzisierung sollten künftig zu einem eindeutigen Zielmodell zusammengeführt werden. |
| ADR 0002, sechs Monate für jedes Thema bei Minderjährigen | Fachlich zu weit, siehe F23. Die Halbjahresregel betrifft Gefahrenunterweisungen nach § 29 JArbSchG, keine unterschiedslose Verkürzung aller Katalogintervalle. [§ 29 JArbSchG](https://www.gesetze-im-internet.de/jarbschg/__29.html). |
| Unterweisungsrecherche, Hygiene nur aus Arbeitsschutzrecht, IfSG nur mögliche Überwachung | Unvollständig und in dieser Ausschließlichkeit falsch. § 35 Abs. 1 IfSG nennt ambulante Pflegedienste ausdrücklich, verpflichtet zu Infektionsprävention und Hygieneplänen und regelt die Überwachung. Dass § 23 die Dienste nicht selbst aufzählt, erledigt den IfSG-Bezug nicht. Das jährliche Beschäftigten-Unterweisungsintervall lässt sich weiterhin aus dem Arbeitsschutzrecht begründen. [§ 35 IfSG](https://www.gesetze-im-internet.de/ifsg/__35.html), [§ 14 Abs. 3 BioStoffV](https://www.gesetze-im-internet.de/biostoffv_2013/__14.html). |
| Zwei Jahre Ersthelfer-Fortbildung | Grundsätzlich bestätigt, einschließlich „in der Regel“ und der Voraussetzungen/Ausnahmen für Personen mit Gesundheitsberuf und regelmäßiger Erste-Hilfe-Praxis. Kein pauschaler BLS/AED-Pflichtzyklus für alle Mitarbeiter. [DGUV Vorschrift 1, § 26 Abs. 3, S. 19–20](https://publikationen.dguv.de/widgets/pdf/download/article/2909#page=20). |
| Zwei Jahre Lebensmittelbelehrung | § 43 Abs. 4 bestätigt Wiederholung nach Tätigkeitsaufnahme und anschließend alle zwei Jahre bei einschlägigen Tätigkeiten. Erstbescheinigung und deren Aufbewahrung sind eigene Anforderungen. Die pauschale Übertragung der Privathaushaltsausnahme auf jede gewerbliche Leistung im Haushalt wird hier nicht abschließend bestätigt; dafür sind Tätigkeit und örtliche Vollzugshinweise zu prüfen. [§ 43 IfSG](https://www.gesetze-im-internet.de/ifsg/__43.html). |
| Medizinprodukte ohne allgemeines Jahresintervall | Im Grundsatz richtig. Einweisung hängt am Produkt; auch relevante Softwareänderungen können sie auslösen. Ein einziges allgemeines Thema „Medizinprodukte erledigt“ trägt diesen Nachweis nicht. Ausnahmen und Betreiber-/Benutzerrolle sind zu beachten. [§ 4 MPBetreibV](https://www.gesetze-im-internet.de/mpbetreibv_2025/__4.html). |
| Katalog als allgemein gültige Leistungs-/Berechtigungsmatrix | Nicht belegt. P12/P19 enthalten Abrechnungsausschlüsse ohne Vertragsfassung; BPf 29 trägt „SGB V“, bezeichnet aber eine Beratung nach SGB XI. Landes-/vertragsbezogene Regeln und interne Kompetenzcodes müssen gekennzeichnet werden. [defaultCatalog.ts:14](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/defaultCatalog.ts:14), [defaultCatalog.ts:66](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/database/defaultCatalog.ts:66). |

Die Originalrecherche zur QPR sollte nicht still zu einer neuen Fassung umgeschrieben werden. Sinnvoll ist ein datierter Nachtrag zur aktuellen Fassung. ADR 0002 benötigt dagegen eine inhaltliche Korrektur seiner Regelherleitung. Eine neue ADR sollte die korrigierte Entscheidung und ihre Ablösung der bisherigen Regel nachvollziehbar festhalten.

## Produktbewertung: Ergibt die App im Arbeitsalltag Sinn?

Die folgenden Punkte sind begründete Gestaltungsurteile. Sie sind weder eigenständige Rechtsverstöße noch behauptete Pflichten der QPR.

### Den historischen Personalnachweis als Kern zuerst verlässlich machen

Das [Anforderungsdokument](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/docs/anforderungsdokument.md) beschreibt einen konkreten Schmerz: Stellenanteile und Beschäftigung vergangener Jahre müssen aus verstreuten Unterlagen rekonstruiert werden. Dafür sind Jahreswahl, Qualifikationsgruppen, Perioden und Excel-Export die richtigen Bausteine. F04–F07 betreffen aber genau dieses Nutzenversprechen. Zusätzliche QM-Dashboards gleichen die fehlende historische Verlässlichkeit nicht aus.

Ich würde zuerst einen nachvollziehbaren Ablauf abschließen: Person erfassen, Eintritt dokumentieren, Stundenänderung mit Wirksamkeitsdatum, Austritt/Wiedereintritt, geprüftes Berichtjahr, Export mit Rechenbasis. Die App muss nicht zu einer Lohnabrechnung werden. Sie braucht für ihre eigene Kennzahl jedoch ausreichend Zeitbezug.

### „Heute zu tun“ braucht fachlich abschließbare Aufgaben

Die gemeinsame Arbeitsliste und direkte Links zur Person sind nützlich. Problematisch ist die Bedeutung des Hakens: Er blendet einen Punkt nur für die Sitzung aus. Wenn alle Punkte angehakt wurden, lautet die Leermeldung trotzdem „alle Fristen und Stammdaten sind aktuell“. Das folgt nicht aus dem Wegklicken. [TasksPage.tsx:50](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/TasksPage.tsx:50), [Dashboard.tsx:166](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/pages/Dashboard.tsx:166).

Sinnvoller wären getrennte Aktionen für „heute zurückstellen“, „nicht zutreffend“ und eine dokumentierte fachliche Erledigung. Visiten-Handlungsbedarf braucht eine Maßnahme mit Termin und Status. Die aktuelle Aufforderung „Folgevisite dokumentieren“ zwingt eine fachliche Lösung in einen Dokumentationstyp, obwohl beispielsweise ein Telefonat oder eine angepasste Maßnahme genügen kann. Freitextmaßnahmen aus MD-Prüfungen erscheinen überhaupt nicht als terminierte Arbeit.

### Nach Dringlichkeit und bearbeitbarem Fall ordnen

Alle offenen Visitenbefunde stehen vor allen überfälligen Fristen; innerhalb derselben Gewichtung wird alphabetisch sortiert. Damit kann eine neue Lücke vor einem lange überfälligen Nachweis stehen. Eine Person kann parallel als Visite, Einstufungslücke und Kontaktlücke erscheinen. [dashboardTasks.ts:48](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/utils/dashboardTasks.ts:48).

Für die PDL wäre eine bündelbare Fallansicht mit Fälligkeit, Alter des Befunds und fachlich gesetzter Dringlichkeit besser. Name eignet sich als letzte Sortierstufe. Geburtstage bleiben im Kalender sinnvoll, sollten aber kritische Nachweise nicht durch begrenzte Vorschauen verdrängen. Ein historischer Jahresfilter sollte außerdem nicht unbemerkt den personellen Teil der aktuellen Arbeitsliste verändern.

### Pflichtzuordnung, Termin und Nachweis auseinanderhalten

Der Unterweisungskatalog mischt Arbeitsschutz-Unterweisungen, Lebensmittelbelehrung, Fortbildung, Geräteeinweisung und optionale Kurse. Der Sammelname „Pflichtunterweisungen“ ist dafür zu weit. Eine Zuordnung ohne Intervall kann korrekt sein; ebenso kann ein Thema gar nicht auf eine Person zutreffen. „Null“ bedeutet derzeit zu häufig gleichzeitig unbekannt, nicht nötig und nicht terminiert.

Sinnvoll wären eine Tätigkeit/Rolle als Begründung der Zuordnung, ein optionaler Wiederholungszyklus, ein tatsächlich durchgeführter Termin und ein auffindbarer Beleg. Mehrere Themen einer gemeinsamen Schulung sollten gemeinsam abgeschlossen werden können. Sonst entsteht viel Einzelpflege, obwohl dieselbe Veranstaltung zugrunde liegt. Die vorhandene Sammelzuordnung hilft beim Anlegen, ersetzt diesen Abschlussablauf aber nicht.

### Kompetenzstufe und Einsatzfreigabe müssen eine klare Bedeutung haben

Die Abstufung von „unterwiesen“ bis „kann anleiten“ ist als Einarbeitungsinstrument verständlich. Die zusätzliche Freigabe wird jedoch nicht konsistent abgegrenzt: Die Statistik zählt ein Freigabedatum oder schon Stufe ≥ 4 als freigegeben. Stufe 0 mit Datum kann gleichzeitig offen und freigegeben sein. [dashboard.ts:269](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/main/repositories/dashboard.ts:269), [EmployeeCompetencyModal.tsx:68](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/src/components/modals/EmployeeCompetencyModal.tsx:68).

Vor weiteren Automatismen sollte feststehen, ob eine Stufe eine beobachtete Fähigkeit, eine interne Freigabe oder nur eine Selbsteinschätzung ist. Prüfer:in, Beobachtungsdatum, Tätigkeitsgrenzen und Nachweis müssen dazu passen. Namensbasierte Vorschläge können die Zuordnung erleichtern, aber diese Entscheidung nicht treffen.

### Patienten-QM als begrenztes Zusatzmodul führen

Die Trennung von Stichprobenmerkmalen und interner Pflegevisite ist fachlich richtig. Ein kleines QM-Register kann neben der eigentlichen Pflegedokumentation nützlich sein, wenn es offene Maßnahmen und den aktuellen Versorgungsbestand zuverlässig führt. Der jetzige Ansatz erzeugt zusätzliche Stammdatenpflege mit Diagnose, Pflegegrad, Vertretung und Begutachtung, ohne Importabgleich oder Herkunftsverweis.

Deshalb sollte die Zuständigkeit klar sein: Welche Daten werden hier führend gepflegt, welche aus der Pflegesoftware übernommen, wer aktualisiert Änderungen? Sonst entstehen zwei Bestände. Die App sollte weder eine vollständige Pflegevisite noch eine bestätigte MD-Prüfbereitschaft suggerieren, wenn sie nur Datum, Freitext und ein Flag kennt.

### Einführung und Betrieb gehören zum Nutzungsablauf

Ein leerer produktiver Start, die Übernahme vorhandener Listen, nachvollziehbare Dokumentverweise und ein geprobter Rechnerwechsel bringen mehr Nutzen als weitere Kennzahlen. Das Anforderungsdokument sieht den NAS-Dokumentenbezug vor; derzeit fehlen dafür strukturierte Verweise im Nachweisweg. Ein Einzelplatzmodell ist für eine verantwortliche Person plausibel. Gleichzeitige Arbeit mehrerer PDL/QM-Mitarbeiter ist damit nicht gelöst und sollte nicht über das gemeinsame Öffnen derselben SQLite-Datei auf einem NAS improvisiert werden.

Für die erste Einführung würde ich einen kleinen, bewusst gewählten Funktionsumfang sichtbar machen. Die rechtlich klingenden Kataloge sollten als prüfbare betriebliche Vorlagen starten. Zuständigkeits- und Vertragsannahmen gehören an die jeweilige Regel, nicht nur in Entwicklerdokumente.

## Abdeckung und Nachweise

| Bereich | Geprüft | Grenzen |
| --- | --- | --- |
| Personal, Perioden, Ereignisse, VZÄ | Datenmodell, Speicherwege, Jahresauswahl, Aggregation, eigener SQLite-Reproduktionstest, Team- und Berichtsoberfläche | Empfängervertrag/Formular nicht vorhanden; keine Aussage zur endgültig verlangten Nachweisform |
| Qualifikationen und Kompetenzen | Kataloge, Empfehlungen, Erfassung, Freigabelogik, vorhandene Tests | Keine fachliche Einzelabnahme jeder delegierbaren Maßnahme; Bundesland/Versorgungsverträge unbekannt |
| Unterweisungen/Fortbildungen | Definitionen, Intervalle, Zuordnung, Historie, Löschung, Minderjährigenregel, Erinnerung, Nachweisgrenzen; Intervallverlust über echte Oberfläche | Keine Prüfung externer unterschriebener Belege; nicht jede denkbare Kombination durchgespielt |
| Patient:innen, Visiten und QPR | Merkmale, Fälligkeit, Zukunftsdaten, Exportgrundlage, Stichprobenhinweise, Prüferfassung, ADR und Quellen | Kein realer MD-Prüfbericht oder betrieblicher Pflegedokumentationsbestand importiert |
| Dashboard, Aufgaben, Kalender | Datenquellen, Begrenzungen, Datumslogik, Navigation der laufenden Oberfläche, Produktzweck | Kein vollständiger visueller Responsive-/Screenreader-Test |
| Auth, Verschlüsselung, Backup, Import/Export | Lebenszyklus, Schlüssel-/Formatannahmen, Codepfade, vorhandene Tests; Backupreproduktionen mit temporären Dateien | Kein echter NAS-Ausfall oder Geräteverlust; keine kryptografische Vollprüfung; Backup-Verbindungsverwaltung in eigener Probe ersetzt |
| Einstellungen, Diagnose, Updates | Relevante Einstellungen, Fehlermeldungs-/Betriebsbezug, vorhandene Testabdeckung | Kein echter Release-Download/Installerlauf, keine Windows-Laufzeitprüfung oder Signaturabnahme |

Ausgeführt wurden `npx vitest run`: 46 Testdateien, 253 Tests bestanden, und `npx tsc --noEmit`: bestanden. Diese Checks bestätigen den bestehenden Testumfang, nicht die fachliche Richtigkeit der beschriebenen Abläufe. Die eigenen Reproduktionen ergänzen gerade die dort fehlenden durchgehenden Fälle.

Für die laufende Prüfung wurden Renderer und Preload aus dem aktuellen Quellstand in ein temporäres Verzeichnis gebaut. Electron startete mit einem eigens angelegten `appData`-Verzeichnis. Die Oberfläche wurde über ihre tatsächlichen Bedienelemente und Electron DevTools-Protokoll angesprochen. Weder vorhandene produktive Profile noch reale Personenbestände wurden verwendet. Die von der App selbst erzeugten Demopersonen dienten nur im isolierten Testprofil als Testdaten.

Die ergänzenden [Reproduktionsergebnisse](/Volumes/WD-Black-SN850X/tbuck/repos/_self/employee-db/docs/reviews/2026-09-06-cleardeck-fachliches-review-evidence.json) enthalten synthetische Repository-Fälle, Backup-Fälle und bestätigte Beobachtungen aus der Oberfläche. Der SQLite-Test verwendete die echten Migrationen und Repositories mit einem kleinen Adapter für `node:sqlite`. Er ist kein Ersatz für sämtliche Tests mit dem produktiven `better-sqlite3`-Treiber. Die Oberfläche lief zusätzlich mit dem tatsächlichen Electron-/Datenbankweg.

## Empfohlene Reihenfolge

1. Wiederherstellung und Import verlustsicher machen; automatische Demobefüllung aus produktiven Beständen entfernen.
2. Berichtjahr, Beschäftigungshistorie, VZÄ und Stichtagsdefinition konsistent machen; die angezeigte Zusammenfassung tatsächlich exportieren.
3. Unterweisungsintervalle und Einzelnachweise erhalten; vollständige offene Pflichten anzeigen; Minderjährigenregel fachlich begrenzen.
4. Geplante und durchgeführte Visiten sowie offene Maßnahmen unterscheiden; Versorgungsstatus und QPR-Exportumfang vervollständigen.
5. Prüfergebnisse als Entwurf/Einzelbefunde oder ausdrücklich interne Kurznotiz gestalten; Quellen und ADRs korrigieren.
6. Erst danach weitere Produktfunktionen ergänzen. Den Kernablauf mit einer PDL anhand eines abgeschlossenen Berichtsjahres und eines realistischen Schulungszyklus abnehmen.

Die offenen fachlichen Punkte sind konkret: anzuwendendes Nachweisformular, betriebliche VZÄ-Definition, Bundesland und Leistungs-/Versorgungsverträge, unterstützte Spezialversorgung sowie Ablageort und Verantwortlichkeit für Originalnachweise. Sie verhindern die oben belegten Fehlerfeststellungen nicht; sie begrenzen die Bewertung noch nicht festgelegter Fachregeln.
