import type { Migration } from './index';

/** The seeded catch-all entry must not read like its own category. */
export const v023_generic_service_label: Migration = {
  version: 23,
  description: 'Name the generic treatment-care catalogue entry as a catch-all',
  up: (db) => {
    db.prepare(
      "UPDATE service_definitions SET name=? WHERE serviceType='s37-hkp' AND name=? COLLATE NOCASE AND NOT EXISTS (SELECT 1 FROM service_definitions other WHERE other.name=? COLLATE NOCASE)",
    ).run(
      'Sonstige Behandlungspflege nach § 37 SGB V',
      'Behandlungspflege nach § 37 SGB V',
      'Sonstige Behandlungspflege nach § 37 SGB V',
    );
  },
};
