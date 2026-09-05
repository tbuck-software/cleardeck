/// <reference types="vitest/globals" />

import {
  FIRST_VISIT_DAYS,
  TEILGRUPPE_TARGET,
  addDays,
  daysBetween,
  teilgruppeLabel,
  teilgruppeOf,
  visitDue,
} from '../qpr';

describe('teilgruppeOf', () => {
  it('leitet A–C aus Mobilität und Kognition ab', () => {
    expect(teilgruppeOf(true, true)).toBe('A');
    expect(teilgruppeOf(false, true)).toBe('B');
    expect(teilgruppeOf(true, false)).toBe('C');
    expect(teilgruppeOf(false, false)).toBe('none');
  });

  it('gibt null zurück, solange Gutachten-Daten fehlen', () => {
    expect(teilgruppeOf(null, true)).toBeNull();
    expect(teilgruppeOf(true, null)).toBeNull();
    expect(teilgruppeOf(undefined, undefined)).toBeNull();
  });
});

describe('teilgruppeLabel', () => {
  it('führt D zusätzlich zu A–C, nicht anstelle', () => {
    expect(
      teilgruppeLabel({ cognitionImpaired: false, mobilityImpaired: true, hkpCode: '31a' }),
    ).toBe('B + HKP 31a');
  });

  it('kennzeichnet fehlende Gutachten-Daten', () => {
    expect(teilgruppeLabel({ cognitionImpaired: null, mobilityImpaired: null, hkpCode: null })).toBe('—');
  });

  it('zeigt HKP auch ohne Beeinträchtigung', () => {
    expect(
      teilgruppeLabel({ cognitionImpaired: false, mobilityImpaired: false, hkpCode: '6' }),
    ).toBe('ohne + HKP 6');
  });
});

describe('Sollzahlen der Stichprobe', () => {
  it('entspricht 2/2/2 für A–C und 3 für D', () => {
    expect(TEILGRUPPE_TARGET).toMatchObject({ A: 2, B: 2, C: 2, D: 3 });
  });
});

describe('visitDue', () => {
  it('rechnet ab der letzten Visite mit dem eingestellten Intervall', () => {
    const due = visitDue({ latestVisitDate: '2026-06-01' }, '2026-07-01', 90);
    expect(due.dueDate).toBe('2026-08-30');
    expect(due.first).toBe(false);
    expect(due.overdue).toBe(false);
    expect(due.daysUntilDue).toBe(60);
  });

  it('rechnet ohne Visite ab der Aufnahme', () => {
    const due = visitDue({ latestVisitDate: null, admissionDate: '2026-08-28' }, '2026-09-05', 90);
    expect(due.first).toBe(true);
    expect(due.dueDate).toBe(addDays('2026-08-28', FIRST_VISIT_DAYS));
  });

  it('meldet Überfälligkeit mit Tagen', () => {
    const due = visitDue({ latestVisitDate: '2026-01-01' }, '2026-05-01', 90);
    expect(due.overdue).toBe(true);
    expect(due.label).toBe('überfällig seit 30 T.');
  });

  it('bezeichnet den Fälligkeitstag selbst als heute', () => {
    const due = visitDue({ latestVisitDate: '2026-06-01' }, '2026-08-30', 90);
    expect(due.label).toBe('heute');
    expect(due.overdue).toBe(false);
  });
});

describe('Datumsrechnung', () => {
  it('zählt über Monats- und Jahresgrenzen', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('bleibt über eine Sommerzeitumstellung ganztägig', () => {
    // In Deutschland wird am 29.03.2026 auf Sommerzeit umgestellt.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
});
