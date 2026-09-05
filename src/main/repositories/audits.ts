/**
 * MD-Prüfung Repository
 *
 * External inspection results (QPR ambulant). QB 1–3 are graded A–D per
 * quality aspect, QB 4 is descriptive, QB 5 and Abrechnung are pass/fail —
 * so `result` is a union, not a number, and the scale lives with the section.
 */

import type { Audit, AuditResult, AuditSectionDefinition, AuditWithDetails } from '../../shared/types';
import { getDb } from '../database/connection';

/** Fixed by the QPR; the app never invents or reorders these. */
export const AUDIT_SECTIONS: AuditSectionDefinition[] = [
  {
    key: 'qb1',
    name: 'QB 1 · Unabhängig von vereinbarten Leistungen (Aufnahme, Risiken, Destabilisierung)',
    scale: 'abcd',
  },
  { key: 'qb2', name: 'QB 2 · Individuell vereinbarte Leistungen', scale: 'abcd' },
  { key: 'qb3', name: 'QB 3 · Ärztlich verordnete Leistungen', scale: 'abcd' },
  {
    key: 'qb4',
    name: 'QB 4 · Sonstige personenbezogene Aspekte (Angehörige, Gewalt/Vernachlässigung)',
    scale: 'text',
  },
  { key: 'qb5', name: 'QB 5 · Qualitätsmanagement, Hygiene, verantwortliche PFK', scale: 'yesno' },
  { key: 'billing', name: 'Abrechnungsprüfung', scale: 'yesno' },
];

export const AUDIT_RESULT_LABEL: Record<string, string> = {
  A: 'Keine Auffälligkeiten',
  B: 'Auffälligkeiten ohne Risiko negativer Folgen',
  C: 'Defizite mit Risiko negativer Folgen',
  D: 'Defizite mit eingetretenen negativen Folgen',
  ok: 'erfüllt',
  no: 'nicht erfüllt / Auffälligkeiten',
  text: 'beschreibend',
};

export const listAudits = (): AuditWithDetails[] => {
  const db = getDb();
  const audits = db
    .prepare('SELECT id, auditDate, inspector, kind, findings, createdAt FROM audits ORDER BY auditDate DESC')
    .all() as Audit[];

  if (audits.length === 0) return [];

  const results = db
    .prepare('SELECT auditId, sectionKey, result, note FROM audit_results')
    .all() as (AuditResult & { auditId: number })[];
  const clients = db
    .prepare('SELECT auditId, patientId FROM audit_clients')
    .all() as { auditId: number; patientId: number }[];

  return audits.map((audit) => ({
    ...audit,
    results: results
      .filter((row) => row.auditId === audit.id)
      .map(({ sectionKey, result, note }) => ({ sectionKey, result, note })),
    clientIds: clients.filter((row) => row.auditId === audit.id).map((row) => row.patientId),
  }));
};

export const saveAudit = (input: {
  id?: number;
  auditDate: string;
  inspector?: string | null;
  kind?: 'regel' | 'anlass' | null;
  findings?: string | null;
  results: AuditResult[];
  clientIds: number[];
}): AuditWithDetails[] => {
  const db = getDb();

  const write = db.transaction(() => {
    let auditId = input.id;

    if (auditId) {
      db.prepare(
        'UPDATE audits SET auditDate = @auditDate, inspector = @inspector, kind = @kind, findings = @findings WHERE id = @id',
      ).run({
        id: auditId,
        auditDate: input.auditDate,
        inspector: input.inspector ?? null,
        kind: input.kind ?? null,
        findings: input.findings ?? null,
      });
      db.prepare('DELETE FROM audit_results WHERE auditId = ?').run(auditId);
      db.prepare('DELETE FROM audit_clients WHERE auditId = ?').run(auditId);
    } else {
      const info = db
        .prepare(
          'INSERT INTO audits (auditDate, inspector, kind, findings) VALUES (@auditDate, @inspector, @kind, @findings)',
        )
        .run({
          auditDate: input.auditDate,
          inspector: input.inspector ?? null,
          kind: input.kind ?? null,
          findings: input.findings ?? null,
        });
      auditId = Number(info.lastInsertRowid);
    }

    const insertResult = db.prepare(
      'INSERT INTO audit_results (auditId, sectionKey, result, note) VALUES (?, ?, ?, ?)',
    );
    input.results.forEach((row) => {
      insertResult.run(auditId, row.sectionKey, row.result, row.note ?? null);
    });

    const insertClient = db.prepare(
      'INSERT OR IGNORE INTO audit_clients (auditId, patientId) VALUES (?, ?)',
    );
    input.clientIds.forEach((patientId) => insertClient.run(auditId, patientId));
  });

  write();
  return listAudits();
};

export const deleteAudit = (id: number): AuditWithDetails[] => {
  const db = getDb();
  db.prepare('DELETE FROM audits WHERE id = ?').run(id);
  return listAudits();
};

/** Weakest QB 1–3 letter — the single grade shown in the audit list. */
export const worstResult = (results: AuditResult[]): 'A' | 'B' | 'C' | 'D' => {
  const letters = results
    .filter((row) => ['A', 'B', 'C', 'D'].includes(row.result))
    .map((row) => row.result);
  return (['D', 'C', 'B', 'A'] as const).find((letter) => letters.includes(letter)) ?? 'A';
};
