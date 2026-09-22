import type { Migration } from './index';

export const v024_competency_templates: Migration = {
  version: 24,
  description: 'Track competency template origin and separate catalogue review from employee assessments',
  up: (db) => db.transaction(() => {
    db.exec('ALTER TABLE competency_definitions ADD COLUMN templateKey TEXT');
    db.exec('ALTER TABLE competency_definitions ADD COLUMN reviewStatus TEXT');
  })(),
};
