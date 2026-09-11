/// <reference types="vitest/globals" />

import {
  FIRST_VISIT_DAYS,
  TEILGRUPPE_TARGET,
  addDays,
  daysBetween,
  teilgruppeLabel,
  teilgruppeOf,
  visitDue,
  deriveServiceScope,
  serviceScopeOf,
  SERVICE_SCOPE_LABEL,
  SERVICES_NOT_RECORDED,
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

describe('QPR-Leistungsumfang', () => {
  it('nimmt §36-Körperpflege und pflegerische Betreuung auf', () => {
    expect(deriveServiceScope(['s36-care']).scope).toBe('eligible');
    expect(deriveServiceScope(['s36-support']).scope).toBe('eligible');
  });

  it('schließt reine Haushaltshilfe, Entlastung und Beratung aus', () => {
    expect(deriveServiceScope(['household', 'relief']).scope).toBe('excluded');
    expect(deriveServiceScope(['s37-consultation']).scope).toBe('excluded');
  });

  it('nimmt gemischte Leistungen auf und ignoriert Pflegegradfelder', () => {
    expect(deriveServiceScope(['relief', 's37-hkp']).scope).toBe('eligible');
    expect(
      serviceScopeOf({
        serviceScope: 'unknown',
        serviceScopeSource: 'services',
        services: [],
      }).scope,
    ).toBe('unknown');
  });

  it('zeigt die Herkunft einer alten expliziten Entscheidung', () => {
    expect(
      serviceScopeOf({ serviceScope: 'eligible', serviceScopeSource: 'legacy' }),
    ).toMatchObject({ scope: 'eligible', reason: expect.stringContaining('Übernommene') });
  });

  it('begründet ohne das Ergebnis zu wiederholen und nennt die Liste im Label', () => {
    expect(deriveServiceScope(['s36-care']).reason).toBe(
      'Körperbezogene Pflege nach § 36 SGB XI gehört zum Versorgungsumfang.',
    );
    expect(deriveServiceScope(['s36-care']).reason).not.toMatch(/weil/);
    expect(SERVICE_SCOPE_LABEL.eligible).toBe('MD-Personenliste: ja');
    expect(SERVICE_SCOPE_LABEL.excluded).toBe('MD-Personenliste: nein');
    expect(SERVICE_SCOPE_LABEL.unknown).toBe('MD-Personenliste: offen');
  });

  it('nennt den unbekannten Zustand überall gleich', () => {
    expect(deriveServiceScope([]).reason).toBe(SERVICES_NOT_RECORDED);
    expect(serviceScopeOf({ serviceScope: 'unknown', serviceScopeSource: 'legacy' }).reason).toBe(
      SERVICES_NOT_RECORDED,
    );
  });
});
