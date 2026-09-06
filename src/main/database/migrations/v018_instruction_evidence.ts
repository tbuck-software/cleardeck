import type { Migration } from './index';

export const v018_instruction_evidence: Migration = {
  version: 18,
  description: 'Scope youth hazard instructions and preserve evidence and follow-up relationships',
  up: (db) => {
    db.transaction(() => {
      const add = (table: string, name: string, type: string) => {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        if (!columns.some((c) => c.name === name))
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      };
      add('instruction_definitions', 'minorHazardInstruction', 'INTEGER NOT NULL DEFAULT 0');
      add('employee_instructions', 'evidenceRef', 'TEXT');
      add('employee_instructions', 'content', 'TEXT');
      add(
        'employee_instructions',
        'previousInstructionId',
        'INTEGER REFERENCES employee_instructions(id) ON DELETE SET NULL',
      );
      add('employee_instructions', 'scheduleReviewRequired', 'INTEGER NOT NULL DEFAULT 0');
      for (const topic of [
        'Erstunterweisung Arbeitsschutz',
        'Brandschutzunterweisung',
        'Hygieneunterweisung (jährlich)',
        'Unterweisung Gefahrstoffe (Desinfektion & Reinigung)',
        'Hautschutzunterweisung',
      ]) {
        db.prepare('UPDATE instruction_definitions SET minorHazardInstruction=1 WHERE topic=?').run(
          topic,
        );
      }
      // Historical due dates may be deliberate stricter rules. Do not rewrite
      // them; require review when the previous blanket youth rule could apply.
      db.exec(`UPDATE employee_instructions SET scheduleReviewRequired=1
        WHERE completedAt IS NULL AND instructionDefinitionId IN
          (SELECT id FROM instruction_definitions WHERE minorHazardInstruction=0 AND intervalMonths>6)
        AND employeeId IN (SELECT id FROM employees WHERE birthDate IS NOT NULL
          AND birthDate > date('now','-20 years'))`);
    })();
  },
};
