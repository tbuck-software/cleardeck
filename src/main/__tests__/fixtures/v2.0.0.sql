-- Synthetic v1.8.0 records migrated using the original v2.0.0 migration code.
-- Source tag: v2.0.0 (bb78aff6582554a1d998fe2dc55ccf796d6a8316).
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE audit_clients (
        auditId INTEGER NOT NULL,
        patientId INTEGER NOT NULL,
        PRIMARY KEY (auditId, patientId),
        FOREIGN KEY (auditId) REFERENCES audits(id) ON DELETE CASCADE,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );
CREATE TABLE audit_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auditId INTEGER NOT NULL,
        sectionKey TEXT NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('A', 'B', 'C', 'D', 'text', 'ok', 'no')),
        note TEXT,
        FOREIGN KEY (auditId) REFERENCES audits(id) ON DELETE CASCADE
      );
CREATE TABLE audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auditDate TEXT NOT NULL,
        inspector TEXT,
        kind TEXT CHECK(kind IN ('regel', 'anlass')),
        findings TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      , reportRef TEXT, confirmed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE competency_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      , code TEXT, category TEXT DEFAULT 'Allgemein', relevance TEXT DEFAULT 'Alle');
INSERT INTO "competency_definitions" VALUES(1,'Einarbeitung',1,'Praktische Einarbeitung im Pflegealltag',NULL,'Allgemein','Alle');
INSERT INTO "competency_definitions" VALUES(3,'Ganzwaschung',2,'Vollständige Körperpflege. Schließt P02 am selben Besuch aus.','P01','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(4,'Teilwaschung',3,'Nur Teilbereiche (z. B. Gesicht, Hände). Nicht zusammen mit P01 abrechenbar.','P02','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(5,'Ausscheidungen',4,'Hilfe bei Toilettengang, Inkontinenzversorgung, Katheterpflege. Dokumentation: Art der Ausscheidungshilfe angeben.','P03','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(6,'Selbstständige Nahrungsaufnahme',5,'Klient isst selbst - MA bereitet nur vor (richten, schneiden). Nicht kombinierbar mit P05.','P04','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(7,'Hilfe bei der Nahrungsaufnahme',6,'MA reicht aktiv an. Nicht zusammen mit P04. Bei Schluckstörung in Doku vermerken.','P05','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(8,'Sondenernährung',7,'Nur mit ärztlicher Anordnung. Behandlungspflege unter SGB V mitprüfen.','P06','SGB XI','Nur PFK');
INSERT INTO "competency_definitions" VALUES(9,'Lagern / Betten',8,'Positionierung, Bett machen. Bei Kombination mit Grundpflege Kombinations-LK prüfen.','P07','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(10,'Mobilisation',9,'Transfer, Gehen, Rollstuhl. Bei höherem Aufwand in der Doku begründen.','P08','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(11,'Behördengänge und Arztbesuche',10,'Begleitung außer Haus. Zeitaufwand dokumentieren.','P09','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(12,'Beheizen des Wohnbereichs',11,'Nur wenn Klient dies nicht selbst kann. In Doku begründen.','P10','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(13,'Einkaufen',12,'Belege als Nachweis aufbewahren lassen.','P11','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(14,'Zubereiten von warmen Mahlzeiten',13,'Nicht kombinierbar mit P04/P05 am selben Besuch, wenn Essen direkt gereicht wird.','P12','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(15,'Reinigung der Wohnung',14,'Nur pflegerelevante Bereiche. Umfang in Doku angeben.','P13','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(16,'Waschen und Pflegen der Wäsche / Kleidung',15,'Nur wenn im Pflegevertrag vereinbart.','P14','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(17,'Hausbesuchspauschale',16,'Einmal pro Besuch - unabhängig von der Anzahl der LK.','P15','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(18,'Erhöhte Hausbesuchspauschale',17,'Nur wenn vertraglich vereinbart, z. B. Nacht, Wochenende oder Feiertag.','P15a','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(19,'Erstgespräch',18,'Einmalig bei Neuaufnahme, inklusive Assessment und SIS.','P16','SGB XI','Nur PFK');
INSERT INTO "competency_definitions" VALUES(20,'Folgegespräch',19,'Regelmäßige Überprüfung der Pflegesituation und Übertrag in SIS/Maßnahmenplan.','P16a','SGB XI','Nur PFK');
INSERT INTO "competency_definitions" VALUES(21,'Beratungsbesuch § 37 Abs. 3 S. 6 SGB XI',20,'Pflicht bei Pflegegeld-Empfängern. Bericht an Pflegekasse.','P17','SGB XI','Nur PFK');
INSERT INTO "competency_definitions" VALUES(22,'Große Grundpflege m. Lagern / selbst. Nahrungsaufnahme',21,'Enthält P01 + P07 + P04. Enthaltene Einzel-LK nicht zusätzlich ziehen.','P18','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(23,'Große Grundpflege',22,'Enthält P01. P07 und P04/P05 nicht zusätzlich.','P19','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(24,'Kleine Grundpflege m. Lagern / selbst. Nahrungsaufnahme',23,'Enthält P02 + P07 + P04.','P20','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(25,'Kleine Grundpflege',24,'Enthält P02. P07 und P04/P05 nicht zusätzlich.','P21','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(26,'Große hauswirtschaftliche Versorgung',25,'Kombination mehrerer hauswirtschaftlicher Leistungen.','P22','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(27,'Große Grundpflege m. Lagern',26,'Enthält P01 + P07. P04/P05 kann zusätzlich abgerechnet werden.','P23','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(28,'Große Grundpflege m. Lagern / Hilfe Nahrungsaufnahme',27,'Enthält P01 + P07 + P05.','P24','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(29,'Kleine Grundpflege m. Lagern',28,'Enthält P02 + P07. P04/P05 kann zusätzlich abgerechnet werden.','P25','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(30,'Kleine Grundpflege m. Lagern / Hilfe Nahrungsaufnahme',29,'Enthält P02 + P07 + P05.','P26','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(31,'Kleine pflegerische Hilfestellung 1',30,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P27','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(32,'Kleine pflegerische Hilfestellung 2',31,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P28','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(33,'Kleine pflegerische Hilfestellung 3',32,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P29','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(34,'Kleine pflegerische Hilfestellung 4',33,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P30','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(35,'Pflegerische Betreuung',34,'Gespräch, Aktivierung, Beschäftigung ohne körperlichen Pflegeakt.','P31','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(36,'Hilfe bei der Sicherstellung der selbstverantworteten Haushaltsführung',35,'Aktivierend begleiten statt übernehmen.','P32','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(37,'Hauswirtschaftliche Versorgung',36,'Vollständige hauswirtschaftliche Übernahme. Abgrenzung zu P22 beachten.','P33','SGB XI','Alle');
INSERT INTO "competency_definitions" VALUES(38,'Medikamentenvorbereitung (Stellen der Medikamente)',37,'','BPf 1','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(39,'Medikamentengabe oral / sublingual',38,'','BPf 2','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(40,'Medikamentengabe inhalativ (Inhalation)',39,'','BPf 3','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(41,'Medikamentengabe transdermal (Pflaster)',40,'','BPf 4','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(42,'Subkutane Injektion (z.B. Insulin, Heparin)',41,'','BPf 5','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(43,'Intramuskuläre Injektion (nach ärztl. Anordnung)',42,'','BPf 6','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(44,'Infusionstherapie / Port-Versorgung',43,'','BPf 7','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(45,'Ernährung über PEG-Sonde',44,'','BPf 8','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(46,'Wundbeurteilung und Dokumentation (TIME-Schema)',45,'','BPf 9','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(47,'Verbandswechsel (aseptische Technik)',46,'','BPf 10','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(48,'Wundspülung / Debridement (nach Anordnung)',47,'','BPf 11','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(49,'Drainageversorgung (Wunddrainage)',48,'','BPf 12','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(50,'Transurethraler Blasenkatheter legen (Frau)',49,'','BPf 13','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(51,'Suprapubischer Katheter - Pflege und Wechsel',50,'','BPf 14','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(52,'Einlauf / Klysma / Darmentleerung',51,'','BPf 15','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(53,'Einmalkatheterisierung',52,'','BPf 16','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(54,'Tracheostomapflege (tracheal endtracheale Absaugung)',53,'','BPf 17','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(55,'Inhalationstherapie (Vernebler, Peak-Flow)',54,'','BPf 18','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(56,'Absaugung (oral / nasal)',55,'','BPf 19','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(57,'O2-Therapie (Sauerstoffgabe, Pulsoximetrie)',56,'','BPf 20','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(58,'Kompressionsverbände anlegen (Kurzzugbinde)',57,'','BPf 21','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(59,'Kompressionsstrümpfe Klasse I-III anlegen',58,'','BPf 22','SGB V','Alle');
INSERT INTO "competency_definitions" VALUES(60,'Lymphdrainage-Nachsorge / Entstauungstherapie',59,'','BPf 23','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(61,'Vitalzeichenkontrolle + Dokumentation (RR, P, T, SpO2)',60,'','BPf 24','SGB V','Alle');
INSERT INTO "competency_definitions" VALUES(62,'EKG ableiten (12-Kanal)',61,'','BPf 25','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(63,'Blutzucker-Messung + Insulin-Protokoll',62,'','BPf 26','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(64,'INR/Quick-Messung (CoaguChek)',63,'','BPf 27','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(65,'Beurteilung und Meldung krit. Vitalwerte',64,'','BPf 28','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(66,'Beratung Patient/Angehörige (Pflegeberatung § 37 SGB XI)',65,'','BPf 29','SGB V','Nur PFK');
INSERT INTO "competency_definitions" VALUES(67,'Demenzbegleitung / Validation',66,'','BPf 30','SGB V','Alle');
INSERT INTO "competency_definitions" VALUES(68,'Toursoftware sicher bedienen',999,'Dokumentation, Terminpflege und mobile Rueckmeldungen.','QM-01','Digital','Alle');
CREATE TABLE competency_history (
        id INTEGER PRIMARY KEY,employeeId INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        competencyDefinitionId INTEGER NOT NULL REFERENCES competency_definitions(id),
        changedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,level INTEGER,approvedAt TEXT,approvedBy TEXT,note TEXT,stageScheme TEXT NOT NULL
      );
CREATE TABLE employee_competencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        competencyDefinitionId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        startedAt TEXT,
        completedAt TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')), level INTEGER, approvedAt TEXT, approvedBy TEXT, stageScheme TEXT NOT NULL DEFAULT 'legacy',
        UNIQUE(employeeId, competencyDefinitionId),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (competencyDefinitionId) REFERENCES competency_definitions(id) ON DELETE CASCADE
      );
INSERT INTO "employee_competencies" VALUES(204,1,1,'open',NULL,NULL,'Alte Kompetenznotiz','2026-09-06 06:22:02',5,'2026-01-02','Altbestätigung','legacy');
CREATE TABLE "employee_events" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          eventDate TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          details TEXT,
          meta TEXT,
          previousValue TEXT,
          newValue TEXT,
          createdAt TEXT DEFAULT (datetime('now')), expiresAt TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );
INSERT INTO "employee_events" VALUES(43,1,'2025-05-01','training','Bestandsnachweis','Unverändert erhalten',NULL,NULL,NULL,'2026-09-06 06:22:02',NULL);
CREATE TABLE "employee_instructions" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          instructionDefinitionId INTEGER NOT NULL,
          dueDate TEXT,
          completedAt TEXT,
          conductedBy TEXT,
          note TEXT,
          createdAt TEXT DEFAULT (datetime('now')), evidenceRef TEXT, content TEXT, previousInstructionId INTEGER REFERENCES employee_instructions(id) ON DELETE SET NULL, scheduleReviewRequired INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
          FOREIGN KEY (instructionDefinitionId) REFERENCES instruction_definitions(id) ON DELETE CASCADE
        );
INSERT INTO "employee_instructions" VALUES(163,1,1,'2026-02-01','2026-01-03','Unterweisende Person','Originalnachweis','2026-09-06 06:22:02',NULL,NULL,NULL,0);
CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          note TEXT,
          weeklyHours REAL,
          fte REAL,
          createdAt TEXT DEFAULT (datetime('now'))
        , birthDate TEXT, department TEXT);
INSERT INTO "employees" VALUES(1,'Upgrade Test','Erhaltene Personalnotiz',27.0,0.75,'2026-09-06 06:22:02','1974-02-28',NULL);
CREATE TABLE "employment_periods" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT,
          qualification TEXT,
          note TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );
INSERT INTO "employment_periods" VALUES(1,1,'2023-01-01','2024-06-30','Pflegekraft/-helfer','Früherer Abschnitt');
INSERT INTO "employment_periods" VALUES(2,1,'2025-01-01',NULL,'Pflegefachkraft','Wiedereintritt');
CREATE TABLE employment_term_history (
      id INTEGER PRIMARY KEY,periodId INTEGER NOT NULL REFERENCES employment_periods(id) ON DELETE CASCADE,
      effectiveFrom TEXT NOT NULL,weeklyHours REAL,fte REAL,verified INTEGER,sourceRef TEXT,
      changedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "employment_term_history" VALUES(1,1,'2023-01-01',27.0,0.75,0,NULL,'2026-09-06 22:39:48');
INSERT INTO "employment_term_history" VALUES(2,2,'2025-01-01',27.0,0.75,0,NULL,'2026-09-06 22:39:48');
CREATE TABLE employment_terms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periodId INTEGER NOT NULL REFERENCES employment_periods(id) ON DELETE CASCADE,
        effectiveFrom TEXT NOT NULL,
        weeklyHours REAL,
        fte REAL NOT NULL CHECK(fte >= 0 AND fte <= 1),
        verified INTEGER NOT NULL DEFAULT 0, sourceRef TEXT,
        UNIQUE(periodId, effectiveFrom)
      );
INSERT INTO "employment_terms" VALUES(1,1,'2023-01-01',27.0,0.75,0,NULL);
INSERT INTO "employment_terms" VALUES(2,2,'2025-01-01',27.0,0.75,0,NULL);
CREATE TABLE instruction_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT UNIQUE NOT NULL,
        legalBasis TEXT,
        note TEXT,
        sortOrder INTEGER
      , intervalMonths INTEGER, intervalSource TEXT CHECK(intervalSource IN ('norm', 'betrieblich')), minorHazardInstruction INTEGER NOT NULL DEFAULT 0);
INSERT INTO "instruction_definitions" VALUES(1,'Erstunterweisung Arbeitsschutz','ArbSchG § 12 / DGUV V1 § 4','',1,12,'norm',1);
INSERT INTO "instruction_definitions" VALUES(2,'Brandschutzunterweisung','ArbStättV § 6 / ASR A2.2','',2,12,'norm',1);
INSERT INTO "instruction_definitions" VALUES(3,'Hygieneunterweisung (jährlich)','BioStoffV § 14 / TRBA 250; Hygieneplan zusätzlich IfSG § 35','',3,12,'norm',1);
INSERT INTO "instruction_definitions" VALUES(4,'MRSA - Standard Umgang & Schutz','interner Hygieneplan','',4,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(5,'Datenschutz-Grundunterweisung','DSGVO / BDSG','',5,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(6,'Schweigepflicht (§ 203 StGB)','§ 203 StGB','',6,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(7,'Reanimationstraining (BLS/AED)','interne Richtlinie','',7,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(8,'Einweisung Medizinprodukte (MPG)','MPBetreibV § 4 / § 11','',8,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(9,'Notfallmanagement / FAST-Erkennung','interne Richtlinie','',9,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(10,'Kinästhetik Grundkurs (optional)','interne Richtlinie','',10,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(11,'Bobath-Grundprinzipien (optional)','interne Richtlinie','',11,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(12,'Expertenstandard Dekubitus','DNQP','',12,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(13,'Expertenstandard Sturz','DNQP','',13,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(14,'Expertenstandard Schmerz','DNQP','',14,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(15,'Umgang mit Betäubungsmitteln (BTM)','BtMG','',15,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(16,'Abfallentsorgung nach LAGA','KrWG / LAGA','',16,12,'norm',0);
INSERT INTO "instruction_definitions" VALUES(17,'Tourenplanung & Dienstplanung','interne Richtlinie','',17,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(18,'SIS-Dokumentation (Strukturmodell)','PSG II / BMG','',18,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(19,'Pflegegradmanagement & Begutachtung','SGB XI § 18','',19,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(20,'Abrechnungssystem SGB XI / LK','SGB XI','',20,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(21,'Toursoftware 2026','interne Richtlinie','Einweisung in mobile Dokumentation und Rueckmeldelogik.',999,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(22,'Unterweisung Gefahrstoffe (Desinfektion & Reinigung)','GefStoffV § 14 Abs. 2','Tätigkeiten mit Desinfektions- und Reinigungsmitteln unterliegen der Gefahrstoffverordnung.',1000,12,'norm',1);
INSERT INTO "instruction_definitions" VALUES(23,'Ersthelfer-Fortbildung','DGUV V1 § 26 Abs. 3','Wer eine abgeschlossene Ausbildung in einem Gesundheitsberuf hat, gilt bei regelmäßiger Erste-Hilfe-Praxis als fortgebildet (§ 26 Abs. 3 S. 3).',1001,24,'norm',0);
INSERT INTO "instruction_definitions" VALUES(24,'Brandschutzhelfer-Ausbildung','ASR A2.2 Abschn. 7.3','Keine Pflichtfrist. Empfohlen werden 2 bis 5 Jahre; verbindlich ist die eigene Gefährdungsbeurteilung.',1002,NULL,NULL,0);
INSERT INTO "instruction_definitions" VALUES(25,'Hautschutzunterweisung','TRBA 250 Abschn. 4.1.3 Abs. 3','Zusätzlich vor der Verwendung neuer Präparate.',1003,12,'norm',1);
INSERT INTO "instruction_definitions" VALUES(26,'Belehrung nach IfSG § 43','IfSG § 43 Abs. 4','Anwendbarkeit anhand der Tätigkeiten nach § 42 IfSG prüfen. Eine eigene Küche ist keine notwendige Voraussetzung; die Ausnahme für private Hauswirtschaft im konkreten Dienstfall prüfen.',1004,24,'norm',0);
CREATE TABLE "patient_visits" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patientId INTEGER NOT NULL,
          visitDate TEXT NOT NULL,
          actionNeeded INTEGER NOT NULL DEFAULT 0,
          comment TEXT,
          legacyQprRating TEXT,
          createdAt TEXT DEFAULT (datetime('now')), resolvedAt TEXT, status TEXT NOT NULL DEFAULT 'completed', assignedTo TEXT, actionDueDate TEXT,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );
INSERT INTO "patient_visits" VALUES(1,1,'2026-01-05',1,'Historische Visite','D','2026-09-06 06:22:02',NULL,'completed',NULL,NULL);
CREATE TABLE patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        birthDate TEXT,
        diagnosis TEXT,
        qprStatus TEXT CHECK(qprStatus IN ('A', 'B', 'C', 'D')),
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      , contact TEXT, admissionDate TEXT, cognitionImpaired INTEGER, mobilityImpaired INTEGER, hkpCode TEXT, intensiveCare TEXT, careLevel INTEGER, legacyQprStatus TEXT, serviceStatus TEXT NOT NULL DEFAULT 'active', serviceEndDate TEXT, serviceScope TEXT NOT NULL DEFAULT 'unknown', representativeStatus TEXT NOT NULL DEFAULT 'unknown', hkpCodes TEXT NOT NULL DEFAULT '[]', assessmentSource TEXT NOT NULL DEFAULT 'unknown', assessmentDate TEXT, assessmentNote TEXT, akiSetting TEXT, phkpFirst INTEGER NOT NULL DEFAULT 0, phkpStartDate TEXT);
INSERT INTO "patients" VALUES(1,'Upgrade Pflege','1948-09-12','Synthetisch','C','Altnotiz','2026-09-06 06:22:02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'C','active',NULL,'unknown','unknown','[]','unknown',NULL,NULL,NULL,0,NULL);
CREATE TABLE qualification_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      );
INSERT INTO "qualification_types" VALUES(1,'3-jährig examiniert',1,'Pflegefachkraft mit Examen, geeignet fuer behandlungspflegerische Aufgaben.');
INSERT INTO "qualification_types" VALUES(2,'1-jährig examiniert',2,'Pflegeassistenz mit staatlicher Anerkennung.');
INSERT INTO "qualification_types" VALUES(3,'Pflegekraft/-helfer',3,'Pflegehilfskraft fuer grundpflegerische und hauswirtschaftliche Aufgaben.');
INSERT INTO "qualification_types" VALUES(4,'Sonstige',4,'Begleitdienst, Service oder individuelle Sonderrollen.');
INSERT INTO "qualification_types" VALUES(9,'Praxisanleitung',5,'Interne Zusatzrolle fuer Onboarding und Kompetenzfreigaben.');
CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
INSERT INTO "settings" VALUES('baseHours','38');
INSERT INTO "settings" VALUES('hiddenEventTypes','[]');
INSERT INTO "settings" VALUES('schema_version','21');
CREATE INDEX idx_qualification_sort ON qualification_types(sortOrder);
CREATE INDEX idx_periods_employee ON employment_periods(employeeId);
CREATE INDEX idx_periods_dates ON employment_periods(startDate, endDate);
CREATE INDEX idx_events_employee ON employee_events(employeeId);
CREATE INDEX idx_events_date ON employee_events(eventDate);
CREATE INDEX idx_events_expires ON employee_events(expiresAt);
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_qpr ON patients(qprStatus);
CREATE INDEX idx_competency_definitions_sort
        ON competency_definitions(sortOrder);
CREATE INDEX idx_employee_competencies_employee
        ON employee_competencies(employeeId);
CREATE INDEX idx_employee_competencies_definition
        ON employee_competencies(competencyDefinitionId);
CREATE INDEX idx_instruction_definitions_sort
        ON instruction_definitions(sortOrder);
CREATE INDEX idx_patients_hkp ON patients(hkpCode);
CREATE INDEX idx_visits_patient ON patient_visits(patientId);
CREATE INDEX idx_visits_date ON patient_visits(visitDate);
CREATE INDEX idx_visits_action ON patient_visits(actionNeeded);
CREATE INDEX idx_audits_date ON audits(auditDate);
CREATE INDEX idx_audit_results_audit ON audit_results(auditId);
CREATE INDEX idx_employee_instructions_employee
          ON employee_instructions(employeeId);
CREATE INDEX idx_employee_instructions_definition
          ON employee_instructions(instructionDefinitionId);
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('qualification_types',9);
INSERT INTO "sqlite_sequence" VALUES('employees',1);
INSERT INTO "sqlite_sequence" VALUES('employment_periods',2);
INSERT INTO "sqlite_sequence" VALUES('employee_events',43);
INSERT INTO "sqlite_sequence" VALUES('patients',1);
INSERT INTO "sqlite_sequence" VALUES('competency_definitions',68);
INSERT INTO "sqlite_sequence" VALUES('employee_competencies',204);
INSERT INTO "sqlite_sequence" VALUES('instruction_definitions',26);
INSERT INTO "sqlite_sequence" VALUES('patient_visits',1);
INSERT INTO "sqlite_sequence" VALUES('employee_instructions',163);
INSERT INTO "sqlite_sequence" VALUES('employment_terms',2);
COMMIT;
PRAGMA foreign_keys=ON;
