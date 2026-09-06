/// <reference types="vitest/globals" />

import {
  MINOR_MAX_INTERVAL_MONTHS,
  describeInterval,
  effectiveIntervalMonths,
  nextDueDate,
} from '../instructionSchedule';

describe('nextDueDate', () => {
  it('rechnet ab dem Durchführungsdatum, nicht ab dem Kalenderjahr', () => {
    expect(nextDueDate(12, null, '2026-11-28')).toBe('2027-11-28');
    expect(nextDueDate(24, null, '2026-03-01')).toBe('2028-03-01');
  });

  it('erzeugt ohne Intervall keine Fälligkeit', () => {
    // Medizinprodukte: die MPBetreibV kennt kein Zeitintervall.
    expect(nextDueDate(null, null, '2026-09-05')).toBeNull();
    expect(nextDueDate(undefined, '1990-01-01', '2026-09-05')).toBeNull();
  });

  it('rutscht bei kurzen Monaten nicht in den Folgemonat', () => {
    expect(nextDueDate(1, null, '2026-01-31')).toBe('2026-02-28');
    expect(nextDueDate(1, null, '2028-01-31')).toBe('2028-02-29');
  });
});

describe('Deckelung bei Minderjährigen (JArbSchG § 29 Abs. 2)', () => {
  it('verkürzt auf ein halbes Jahr', () => {
    // Bei der Durchführung 16 Jahre alt.
    expect(effectiveIntervalMonths(12, '2010-01-01', '2026-09-05', true)).toBe(
      MINOR_MAX_INTERVAL_MONTHS,
    );
    expect(nextDueDate(12, '2010-01-01', '2026-09-05', true)).toBe('2027-03-05');
  });

  it('verlängert ein ohnehin kürzeres Intervall nicht', () => {
    expect(effectiveIntervalMonths(3, '2010-01-01', '2026-09-05', true)).toBe(3);
  });

  it('richtet sich nach dem Alter bei der Durchführung', () => {
    // Am 05.09.2026 bereits 18 — ab da gilt das reguläre Intervall.
    expect(effectiveIntervalMonths(12, '2008-08-01', '2026-09-05', true)).toBe(12);
    // Einen Monat vorher noch 17 — dann greift die Deckelung.
    expect(effectiveIntervalMonths(12, '2008-10-01', '2026-09-05', true)).toBe(6);
  });

  it('lässt einer minderjährigen Person keine zweijährliche Gefahrenunterweisung durchgehen', () => {
    // Der Fall, den eine Prüfung am Fälligkeitstag übersehen hätte.
    expect(effectiveIntervalMonths(24, '2010-01-01', '2026-09-05', true)).toBe(6);
  });

  it('greift ohne Geburtsdatum nicht, statt ein Alter zu raten', () => {
    expect(effectiveIntervalMonths(12, null, '2026-09-05', true)).toBe(12);
    expect(effectiveIntervalMonths(12, '0000-05-20', '2026-09-05', true)).toBe(12);
  });
});

describe('describeInterval', () => {
  it('macht die Herkunft sichtbar', () => {
    expect(describeInterval(12, 'norm')).toBe('jährlich · aus der Rechtsgrundlage');
    expect(describeInterval(24, 'betrieblich')).toBe('alle zwei Jahre · betriebliche Festlegung');
    expect(describeInterval(9, 'betrieblich')).toBe('alle 9 Monate · betriebliche Festlegung');
  });

  it('nennt das Fehlen eines Intervalls beim Namen', () => {
    expect(describeInterval(null)).toBe('kein festes Intervall');
  });
});

describe('Jugendregel betrifft nur Gefahrenunterweisungen', () => {
  it('lässt fachliche Fortbildungsintervalle unverändert', () => {
    expect(nextDueDate(24, '2010-01-01', '2026-09-05', false)).toBe('2028-09-05');
    expect(nextDueDate(null, '2010-01-01', '2026-09-05', false)).toBeNull();
    expect(nextDueDate(null, '2010-01-01', '2026-09-05', true)).toBe('2027-03-05');
  });
});
