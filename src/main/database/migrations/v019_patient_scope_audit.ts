import type { Migration } from './index';

export const v019_patient_scope_audit: Migration = {
  version: 19,
  description: 'Preserve care scope, assessment provenance, multiple HKP and audit drafts',
  up: (db) => {
    db.transaction(() => {
      const add = (table: string, name: string, type: string) => {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        if (!cols.some((c) => c.name === name))
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      };
      for (const [name, type] of Object.entries({
        serviceStatus: "TEXT NOT NULL DEFAULT 'active'",
        serviceEndDate: 'TEXT',
        serviceScope: "TEXT NOT NULL DEFAULT 'unknown'",
        representativeStatus: "TEXT NOT NULL DEFAULT 'unknown'",
        hkpCodes: "TEXT NOT NULL DEFAULT '[]'",
        assessmentSource: "TEXT NOT NULL DEFAULT 'unknown'",
        assessmentDate: 'TEXT',
        assessmentNote: 'TEXT',
        akiSetting: 'TEXT',
        phkpFirst: 'INTEGER NOT NULL DEFAULT 0',
        phkpStartDate: 'TEXT',
      }))
        add('patients', name, type);
      db.exec(
        "UPDATE patients SET hkpCodes=json_array(hkpCode) WHERE hkpCode IS NOT NULL AND hkpCodes='[]'",
      );
      db.exec(
        "UPDATE patients SET representativeStatus='present' WHERE TRIM(COALESCE(contact,''))<>''",
      );
      // Existing pHKP-EV lacks a date and therefore remains unverified.
      db.exec("UPDATE patients SET phkpFirst=1 WHERE intensiveCare='pHKP-EV'");
      add('patient_visits', 'resolvedAt', 'TEXT');
      add('patient_visits', 'status', "TEXT NOT NULL DEFAULT 'completed'");
      db.exec("UPDATE patient_visits SET status='planned' WHERE visitDate>date('now','localtime')");
      add('employee_competencies', 'stageScheme', "TEXT NOT NULL DEFAULT 'legacy'");
      db.exec(`CREATE TABLE IF NOT EXISTS competency_history (
        id INTEGER PRIMARY KEY,employeeId INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        competencyDefinitionId INTEGER NOT NULL REFERENCES competency_definitions(id),
        changedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,level INTEGER,approvedAt TEXT,approvedBy TEXT,note TEXT,stageScheme TEXT NOT NULL
      )`);
      add('audits', 'reportRef', 'TEXT');
      add('audits', 'confirmed', 'INTEGER NOT NULL DEFAULT 0');
    })();
  },
};
