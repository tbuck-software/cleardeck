PRAGMA foreign_keys=OFF;
CREATE TABLE competency_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      , code TEXT, category TEXT DEFAULT 'Allgemein', relevance TEXT DEFAULT 'Alle');
CREATE TABLE employee_competencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        competencyDefinitionId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        startedAt TEXT,
        completedAt TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')), level INTEGER, approvedAt TEXT, approvedBy TEXT,
        UNIQUE(employeeId, competencyDefinitionId),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (competencyDefinitionId) REFERENCES competency_definitions(id) ON DELETE CASCADE
      );
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
CREATE TABLE employee_instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId INTEGER NOT NULL,
        instructionDefinitionId INTEGER NOT NULL,
        dueDate TEXT,
        completedAt TEXT,
        conductedBy TEXT,
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        UNIQUE(employeeId, instructionDefinitionId),
        FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (instructionDefinitionId) REFERENCES instruction_definitions(id) ON DELETE CASCADE
      );
CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          note TEXT,
          weeklyHours REAL,
          fte REAL,
          createdAt TEXT DEFAULT (datetime('now'))
        , birthDate TEXT, department TEXT);
CREATE TABLE "employment_periods" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employeeId INTEGER NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT,
          qualification TEXT,
          note TEXT,
          FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
        );
CREATE TABLE instruction_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT UNIQUE NOT NULL,
        legalBasis TEXT,
        note TEXT,
        sortOrder INTEGER
      );
CREATE TABLE patient_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patientId INTEGER NOT NULL,
        visitDate TEXT NOT NULL,
        qprRating TEXT NOT NULL CHECK(qprRating IN ('A', 'B', 'C', 'D')),
        comment TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );
CREATE TABLE patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        birthDate TEXT,
        diagnosis TEXT,
        qprStatus TEXT CHECK(qprStatus IN ('A', 'B', 'C', 'D')),
        note TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );
CREATE TABLE qualification_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sortOrder INTEGER,
        note TEXT
      );
CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
INSERT INTO settings ("key","value") VALUES ('schema_version','13');
INSERT INTO settings ("key","value") VALUES ('baseHours','38');
INSERT INTO settings ("key","value") VALUES ('hiddenEventTypes','[]');
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (1,'3-jährig examiniert',1,'Pflegefachkraft mit Examen, geeignet fuer behandlungspflegerische Aufgaben.');
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (2,'1-jährig examiniert',2,'Pflegeassistenz mit staatlicher Anerkennung.');
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (3,'Pflegekraft/-helfer',3,'Pflegehilfskraft fuer grundpflegerische und hauswirtschaftliche Aufgaben.');
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (4,'Sonstige',4,'Begleitdienst, Service oder individuelle Sonderrollen.');
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (9,'Praxisanleitung',5,'Interne Zusatzrolle fuer Onboarding und Kompetenzfreigaben.');
INSERT INTO employees ("id","name","note","weeklyHours","fte","createdAt","birthDate","department") VALUES (1,'Upgrade Test','Erhaltene Personalnotiz',27,0.75,'2026-09-06 06:22:02','1974-02-28',NULL);
INSERT INTO employment_periods ("id","employeeId","startDate","endDate","qualification","note") VALUES (1,1,'2023-01-01','2024-06-30','Pflegekraft/-helfer','Früherer Abschnitt');
INSERT INTO employment_periods ("id","employeeId","startDate","endDate","qualification","note") VALUES (2,1,'2025-01-01',NULL,'Pflegefachkraft','Wiedereintritt');
INSERT INTO employee_events ("id","employeeId","eventDate","type","title","details","meta","previousValue","newValue","createdAt","expiresAt") VALUES (43,1,'2025-05-01','training','Bestandsnachweis','Unverändert erhalten',NULL,NULL,NULL,'2026-09-06 06:22:02',NULL);
INSERT INTO patients ("id","name","birthDate","diagnosis","qprStatus","note","createdAt") VALUES (1,'Upgrade Pflege','1948-09-12','Synthetisch','C','Altnotiz','2026-09-06 06:22:02');
INSERT INTO patient_visits ("id","patientId","visitDate","qprRating","comment","createdAt") VALUES (1,1,'2026-01-05','D','Historische Visite','2026-09-06 06:22:02');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (1,'Einarbeitung',1,'Praktische Einarbeitung im Pflegealltag',NULL,'Allgemein','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (3,'Ganzwaschung',2,'Vollständige Körperpflege. Schließt P02 am selben Besuch aus.','P01','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (4,'Teilwaschung',3,'Nur Teilbereiche (z. B. Gesicht, Hände). Nicht zusammen mit P01 abrechenbar.','P02','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (5,'Ausscheidungen',4,'Hilfe bei Toilettengang, Inkontinenzversorgung, Katheterpflege. Dokumentation: Art der Ausscheidungshilfe angeben.','P03','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (6,'Selbstständige Nahrungsaufnahme',5,'Klient isst selbst - MA bereitet nur vor (richten, schneiden). Nicht kombinierbar mit P05.','P04','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (7,'Hilfe bei der Nahrungsaufnahme',6,'MA reicht aktiv an. Nicht zusammen mit P04. Bei Schluckstörung in Doku vermerken.','P05','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (8,'Sondenernährung',7,'Nur mit ärztlicher Anordnung. Behandlungspflege unter SGB V mitprüfen.','P06','SGB XI','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (9,'Lagern / Betten',8,'Positionierung, Bett machen. Bei Kombination mit Grundpflege Kombinations-LK prüfen.','P07','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (10,'Mobilisation',9,'Transfer, Gehen, Rollstuhl. Bei höherem Aufwand in der Doku begründen.','P08','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (11,'Behördengänge und Arztbesuche',10,'Begleitung außer Haus. Zeitaufwand dokumentieren.','P09','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (12,'Beheizen des Wohnbereichs',11,'Nur wenn Klient dies nicht selbst kann. In Doku begründen.','P10','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (13,'Einkaufen',12,'Belege als Nachweis aufbewahren lassen.','P11','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (14,'Zubereiten von warmen Mahlzeiten',13,'Nicht kombinierbar mit P04/P05 am selben Besuch, wenn Essen direkt gereicht wird.','P12','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (15,'Reinigung der Wohnung',14,'Nur pflegerelevante Bereiche. Umfang in Doku angeben.','P13','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (16,'Waschen und Pflegen der Wäsche / Kleidung',15,'Nur wenn im Pflegevertrag vereinbart.','P14','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (17,'Hausbesuchspauschale',16,'Einmal pro Besuch - unabhängig von der Anzahl der LK.','P15','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (18,'Erhöhte Hausbesuchspauschale',17,'Nur wenn vertraglich vereinbart, z. B. Nacht, Wochenende oder Feiertag.','P15a','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (19,'Erstgespräch',18,'Einmalig bei Neuaufnahme, inklusive Assessment und SIS.','P16','SGB XI','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (20,'Folgegespräch',19,'Regelmäßige Überprüfung der Pflegesituation und Übertrag in SIS/Maßnahmenplan.','P16a','SGB XI','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (21,'Beratungsbesuch § 37 Abs. 3 S. 6 SGB XI',20,'Pflicht bei Pflegegeld-Empfängern. Bericht an Pflegekasse.','P17','SGB XI','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (22,'Große Grundpflege m. Lagern / selbst. Nahrungsaufnahme',21,'Enthält P01 + P07 + P04. Enthaltene Einzel-LK nicht zusätzlich ziehen.','P18','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (23,'Große Grundpflege',22,'Enthält P01. P07 und P04/P05 nicht zusätzlich.','P19','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (24,'Kleine Grundpflege m. Lagern / selbst. Nahrungsaufnahme',23,'Enthält P02 + P07 + P04.','P20','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (25,'Kleine Grundpflege',24,'Enthält P02. P07 und P04/P05 nicht zusätzlich.','P21','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (26,'Große hauswirtschaftliche Versorgung',25,'Kombination mehrerer hauswirtschaftlicher Leistungen.','P22','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (27,'Große Grundpflege m. Lagern',26,'Enthält P01 + P07. P04/P05 kann zusätzlich abgerechnet werden.','P23','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (28,'Große Grundpflege m. Lagern / Hilfe Nahrungsaufnahme',27,'Enthält P01 + P07 + P05.','P24','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (29,'Kleine Grundpflege m. Lagern',28,'Enthält P02 + P07. P04/P05 kann zusätzlich abgerechnet werden.','P25','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (30,'Kleine Grundpflege m. Lagern / Hilfe Nahrungsaufnahme',29,'Enthält P02 + P07 + P05.','P26','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (31,'Kleine pflegerische Hilfestellung 1',30,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P27','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (32,'Kleine pflegerische Hilfestellung 2',31,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P28','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (33,'Kleine pflegerische Hilfestellung 3',32,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P29','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (34,'Kleine pflegerische Hilfestellung 4',33,'Kurzer Einsatz. Nicht zusammen mit P01-P08 oder Kombinations-LK abrechenbar.','P30','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (35,'Pflegerische Betreuung',34,'Gespräch, Aktivierung, Beschäftigung ohne körperlichen Pflegeakt.','P31','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (36,'Hilfe bei der Sicherstellung der selbstverantworteten Haushaltsführung',35,'Aktivierend begleiten statt übernehmen.','P32','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (37,'Hauswirtschaftliche Versorgung',36,'Vollständige hauswirtschaftliche Übernahme. Abgrenzung zu P22 beachten.','P33','SGB XI','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (38,'Medikamentenvorbereitung (Stellen der Medikamente)',37,'','BPf 1','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (39,'Medikamentengabe oral / sublingual',38,'','BPf 2','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (40,'Medikamentengabe inhalativ (Inhalation)',39,'','BPf 3','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (41,'Medikamentengabe transdermal (Pflaster)',40,'','BPf 4','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (42,'Subkutane Injektion (z.B. Insulin, Heparin)',41,'','BPf 5','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (43,'Intramuskuläre Injektion (nach ärztl. Anordnung)',42,'','BPf 6','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (44,'Infusionstherapie / Port-Versorgung',43,'','BPf 7','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (45,'Ernährung über PEG-Sonde',44,'','BPf 8','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (46,'Wundbeurteilung und Dokumentation (TIME-Schema)',45,'','BPf 9','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (47,'Verbandswechsel (aseptische Technik)',46,'','BPf 10','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (48,'Wundspülung / Debridement (nach Anordnung)',47,'','BPf 11','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (49,'Drainageversorgung (Wunddrainage)',48,'','BPf 12','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (50,'Transurethraler Blasenkatheter legen (Frau)',49,'','BPf 13','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (51,'Suprapubischer Katheter - Pflege und Wechsel',50,'','BPf 14','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (52,'Einlauf / Klysma / Darmentleerung',51,'','BPf 15','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (53,'Einmalkatheterisierung',52,'','BPf 16','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (54,'Tracheostomapflege (tracheal endtracheale Absaugung)',53,'','BPf 17','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (55,'Inhalationstherapie (Vernebler, Peak-Flow)',54,'','BPf 18','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (56,'Absaugung (oral / nasal)',55,'','BPf 19','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (57,'O2-Therapie (Sauerstoffgabe, Pulsoximetrie)',56,'','BPf 20','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (58,'Kompressionsverbände anlegen (Kurzzugbinde)',57,'','BPf 21','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (59,'Kompressionsstrümpfe Klasse I-III anlegen',58,'','BPf 22','SGB V','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (60,'Lymphdrainage-Nachsorge / Entstauungstherapie',59,'','BPf 23','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (61,'Vitalzeichenkontrolle + Dokumentation (RR, P, T, SpO2)',60,'','BPf 24','SGB V','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (62,'EKG ableiten (12-Kanal)',61,'','BPf 25','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (63,'Blutzucker-Messung + Insulin-Protokoll',62,'','BPf 26','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (64,'INR/Quick-Messung (CoaguChek)',63,'','BPf 27','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (65,'Beurteilung und Meldung krit. Vitalwerte',64,'','BPf 28','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (66,'Beratung Patient/Angehörige (Pflegeberatung § 37 SGB XI)',65,'','BPf 29','SGB V','Nur PFK');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (67,'Demenzbegleitung / Validation',66,'','BPf 30','SGB V','Alle');
INSERT INTO competency_definitions ("id","name","sortOrder","note","code","category","relevance") VALUES (68,'Toursoftware sicher bedienen',999,'Dokumentation, Terminpflege und mobile Rueckmeldungen.','QM-01','Digital','Alle');
INSERT INTO employee_competencies ("id","employeeId","competencyDefinitionId","status","startedAt","completedAt","note","createdAt","level","approvedAt","approvedBy") VALUES (204,1,1,'open',NULL,NULL,'Alte Kompetenznotiz','2026-09-06 06:22:02',5,'2026-01-02','Altbestätigung');
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (1,'Erstunterweisung Arbeitsschutz','ArbSchG § 12','',1);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (2,'Brandschutzunterweisung','ArbStättV','',2);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (3,'Hygieneunterweisung (jährlich)','IfSG / KRINKO','',3);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (4,'MRSA - Standard Umgang & Schutz','VA-HYG-003','',4);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (5,'Datenschutz-Grundunterweisung','DSGVO / BDSG','',5);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (6,'Schweigepflicht (§ 203 StGB)','§ 203 StGB','',6);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (7,'Reanimationstraining (BLS/AED)','interne Richtlinie','',7);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (8,'Einweisung Medizinprodukte (MPG)','MDR / MPDG','',8);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (9,'Notfallmanagement / FAST-Erkennung','interne Richtlinie','',9);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (10,'Kinästhetik Grundkurs (optional)','interne Richtlinie','',10);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (11,'Bobath-Grundprinzipien (optional)','interne Richtlinie','',11);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (12,'Expertenstandard Dekubitus','DNQP','',12);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (13,'Expertenstandard Sturz','DNQP','',13);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (14,'Expertenstandard Schmerz','DNQP','',14);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (15,'Umgang mit Betäubungsmitteln (BTM)','BtMG','',15);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (16,'Abfallentsorgung nach LAGA','KrWG / LAGA','',16);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (17,'Tourenplanung & Dienstplanung','interne Richtlinie','',17);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (18,'SIS-Dokumentation (Strukturmodell)','PSG II / BMG','',18);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (19,'Pflegegradmanagement & Begutachtung','SGB XI § 18','',19);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (20,'Abrechnungssystem SGB XI / LK','SGB XI','',20);
INSERT INTO instruction_definitions ("id","topic","legalBasis","note","sortOrder") VALUES (21,'Toursoftware 2026','interne Richtlinie','Einweisung in mobile Dokumentation und Rueckmeldelogik.',999);
INSERT INTO employee_instructions ("id","employeeId","instructionDefinitionId","dueDate","completedAt","conductedBy","note","createdAt") VALUES (163,1,1,'2026-02-01','2026-01-03','Unterweisende Person','Originalnachweis','2026-09-06 06:22:02');
CREATE INDEX idx_qualification_sort ON qualification_types(sortOrder);
CREATE INDEX idx_periods_employee ON employment_periods(employeeId);
CREATE INDEX idx_periods_dates ON employment_periods(startDate, endDate);
CREATE INDEX idx_events_employee ON employee_events(employeeId);
CREATE INDEX idx_events_date ON employee_events(eventDate);
CREATE INDEX idx_events_expires ON employee_events(expiresAt);
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_qpr ON patients(qprStatus);
CREATE INDEX idx_visits_patient ON patient_visits(patientId);
CREATE INDEX idx_visits_date ON patient_visits(visitDate);
CREATE INDEX idx_visits_rating ON patient_visits(qprRating);
CREATE INDEX idx_competency_definitions_sort
        ON competency_definitions(sortOrder);
CREATE INDEX idx_employee_competencies_employee
        ON employee_competencies(employeeId);
CREATE INDEX idx_employee_competencies_definition
        ON employee_competencies(competencyDefinitionId);
CREATE INDEX idx_instruction_definitions_sort
        ON instruction_definitions(sortOrder);
CREATE INDEX idx_employee_instructions_employee
        ON employee_instructions(employeeId);
CREATE INDEX idx_employee_instructions_definition
        ON employee_instructions(instructionDefinitionId);
PRAGMA foreign_keys=ON;