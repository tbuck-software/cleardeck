import type { Migration } from './index';
export const v021_catalog_actions: Migration = {
  version: 21,
  description: 'Correct untouched catalogue guidance and track visit action ownership',
  up: (db) =>
    db.transaction(() => {
      db.exec('ALTER TABLE patient_visits ADD COLUMN assignedTo TEXT');
      db.exec('ALTER TABLE patient_visits ADD COLUMN actionDueDate TEXT');
      db.prepare('UPDATE instruction_definitions SET note=? WHERE topic=? AND note=?').run(
        'Anwendbarkeit anhand der Tätigkeiten nach § 42 IfSG prüfen. Eine eigene Küche ist keine notwendige Voraussetzung; die Ausnahme für private Hauswirtschaft im konkreten Dienstfall prüfen.',
        'Belehrung nach IfSG § 43',
        'Nur bei eigener Küche oder Gemeinschaftsverpflegung. Der private hauswirtschaftliche Bereich ist nach § 42 Abs. 1 S. 3 ausgenommen.',
      );
      db.prepare(
        'UPDATE instruction_definitions SET legalBasis=? WHERE topic=? AND legalBasis=?',
      ).run(
        'BioStoffV § 14 / TRBA 250; Hygieneplan zusätzlich IfSG § 35',
        'Hygieneunterweisung (jährlich)',
        'BioStoffV § 14 / TRBA 250',
      );
    })(),
};
