import type { Migration } from './index';

/**
 * Store the services behind the Anlage-7 conclusion. Existing explicit
 * eligible/excluded choices remain legacy decisions until a person is edited.
 */
export const v022_patient_service_scope: Migration = {
  version: 22,
  description: 'Record service choices and preserve legacy Anlage-7 decisions',
  up: (db) => {
    const columns = db.prepare("PRAGMA table_info('patients')").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'serviceScopeSource'))
      db.exec("ALTER TABLE patients ADD COLUMN serviceScopeSource TEXT NOT NULL DEFAULT 'legacy'");
    db.exec(`
      CREATE TABLE IF NOT EXISTS service_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        serviceType TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      );
      DROP INDEX IF EXISTS idx_service_definitions_name;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_service_definitions_name
        ON service_definitions(name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_service_definitions_active
        ON service_definitions(active, sortOrder);
      CREATE TABLE IF NOT EXISTS patient_services (
        patientId INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        serviceDefinitionId INTEGER NOT NULL REFERENCES service_definitions(id),
        labelSnapshot TEXT NOT NULL,
        PRIMARY KEY (patientId, serviceDefinitionId)
      );
      CREATE INDEX IF NOT EXISTS idx_patient_services_definition
        ON patient_services(serviceDefinitionId);
    `);
    const defaults: Array<[string, string]> = [
      ['Große Grundpflege', 's36-care'],
      ['Kleine Grundpflege', 's36-care'],
      ['Große Grundpflege mit Lagern/Betten', 's36-care'],
      ['Kleine Grundpflege mit Lagern/Betten', 's36-care'],
      ['Ganzwaschung', 's36-care'],
      ['Teilwaschung', 's36-care'],
      ['Kleine pflegerische Hilfestellung 1', 's36-care'],
      ['Kleine pflegerische Hilfestellung 2', 's36-care'],
      ['Kleine pflegerische Hilfestellung 3', 's36-care'],
      ['Kleine pflegerische Hilfestellung 4', 's36-care'],
      ['Ausscheidungen', 's36-care'],
      ['Mobilisation', 's36-care'],
      ['Selbstständige Nahrungsaufnahme', 's36-care'],
      ['Pflegerische Betreuung nach § 36 SGB XI', 's36-support'],
      ['Verhinderungspflege nach § 39 SGB XI', 's39-prevention'],
      ['Behandlungspflege nach § 37 SGB V', 's37-hkp'],
      ['Medizinische Kompressionsstrümpfe anziehen', 's37-hkp'],
      ['Medizinische Kompressionsstrümpfe ausziehen', 's37-hkp'],
      ['Medikamente richten / Medikamentenbox stellen', 's37-hkp'],
      ['Medikamente verabreichen', 's37-hkp'],
      ['Außerklinische Intensivpflege nach § 37c SGB V', 's37c-aki'],
      ['Hilfe bei der Haushaltsführung nach SGB XI', 'household'],
      ['Betreuung oder Entlastung nach § 45a/45b SGB XI', 'relief'],
      ['Beratungsbesuch nach § 37 Abs. 3 SGB XI', 's37-consultation'],
    ];
    const insert = db.prepare(
      'INSERT OR IGNORE INTO service_definitions (name, serviceType, sortOrder) VALUES (?, ?, ?)',
    );
    defaults.forEach(([name, serviceType], index) => insert.run(name, serviceType, index));
  },
};
