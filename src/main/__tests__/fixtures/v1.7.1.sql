PRAGMA foreign_keys=OFF;
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
INSERT INTO settings ("key","value") VALUES ('baseHours','36');
INSERT INTO settings ("key","value") VALUES ('schema_version','10');
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (1,'3-jährig examiniert',1,NULL);
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (2,'1-jährig examiniert',2,NULL);
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (3,'Pflegekraft/-helfer',3,NULL);
INSERT INTO qualification_types ("id","name","sortOrder","note") VALUES (4,'Sonstige',4,NULL);
INSERT INTO employees ("id","name","note","weeklyHours","fte","createdAt","birthDate","department") VALUES (1,'Upgrade Test','Erhaltene Personalnotiz',27,0.75,'2026-09-06 06:21:15','1974-02-28',NULL);
INSERT INTO employment_periods ("id","employeeId","startDate","endDate","qualification","note") VALUES (1,1,'2023-01-01','2024-06-30','Pflegekraft/-helfer','Früherer Abschnitt');
INSERT INTO employment_periods ("id","employeeId","startDate","endDate","qualification","note") VALUES (2,1,'2025-01-01',NULL,'Pflegefachkraft','Wiedereintritt');
INSERT INTO employee_events ("id","employeeId","eventDate","type","title","details","meta","previousValue","newValue","createdAt","expiresAt") VALUES (1,1,'2025-05-01','training','Bestandsnachweis','Unverändert erhalten',NULL,NULL,NULL,'2026-09-06 06:21:15',NULL);
INSERT INTO patients ("id","name","birthDate","diagnosis","qprStatus","note","createdAt") VALUES (1,'Upgrade Pflege','1948-09-12','Synthetisch','C','Altnotiz','2026-09-06 06:21:15');
INSERT INTO patient_visits ("id","patientId","visitDate","qprRating","comment","createdAt") VALUES (1,1,'2026-01-05','D','Historische Visite','2026-09-06 06:21:15');
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
PRAGMA foreign_keys=ON;