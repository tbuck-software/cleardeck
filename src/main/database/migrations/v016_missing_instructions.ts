/**
 * Migration v016: add the mandatory instructions the original catalogue missed.
 *
 * From the research of 05.09.2026; the decision is recorded in docs/adr/0002 § 7.
 * A catalogue entry is only a definition — nothing falls due until it is
 * assigned to someone — so adding entries is safe for existing databases.
 *
 * Additions are named explicitly rather than synced from defaultCatalog.ts on
 * every run: a blind sync would resurrect entries a service deliberately
 * deleted. Each future addition gets its own migration.
 */

import type { Migration } from './index';
import { defaultInstructionCatalog } from '../defaultCatalog';

const ADDED_TOPICS = [
  'Unterweisung Gefahrstoffe (Desinfektion & Reinigung)',
  'Ersthelfer-Fortbildung',
  'Brandschutzhelfer-Ausbildung',
  'Hautschutzunterweisung',
  'Belehrung nach IfSG § 43',
];

export const v016_missing_instructions: Migration = {
  version: 16,
  description: 'Add mandatory instructions missing from the original catalogue',
  up: (db) => {
    const maxSort = (
      db.prepare('SELECT MAX(sortOrder) as mx FROM instruction_definitions').get() as {
        mx: number | null;
      }
    ).mx;

    // topic is UNIQUE, so an entry a service already created itself is kept.
    const insert = db.prepare(
      `
      INSERT OR IGNORE INTO instruction_definitions
        (topic, legalBasis, note, sortOrder, intervalMonths, intervalSource)
      VALUES (@topic, @legalBasis, @note, @sortOrder, @intervalMonths, @intervalSource)
    `,
    );

    let sortOrder = maxSort ?? 0;
    ADDED_TOPICS.forEach((topic) => {
      const entry = defaultInstructionCatalog.find((item) => item.topic === topic);
      if (!entry) return;
      sortOrder += 1;
      insert.run({
        topic: entry.topic,
        legalBasis: entry.legalBasis ?? null,
        note: entry.note || null,
        sortOrder,
        intervalMonths: 'intervalMonths' in entry ? entry.intervalMonths : null,
        intervalSource: 'intervalSource' in entry ? entry.intervalSource : null,
      });
    });
  },
};
