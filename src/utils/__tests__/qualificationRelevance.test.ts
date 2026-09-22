/// <reference types="vitest/globals" />

import { deriveQualificationTags, matchesQualificationRelevance } from '../qualificationRelevance';

describe('qualification relevance helpers', () => {
  it('erkennt pflegefachkraft als PFK', () => {
    expect(deriveQualificationTags('Pflegefachkraft')).toContain('Nur PFK');
    expect(matchesQualificationRelevance('Pflegefachkraft', 'Nur PFK')).toBe(true);
    expect(matchesQualificationRelevance('Pflegefachkraft', 'Nur PHK')).toBe(false);
  });

  it('erkennt pflegehilfskraft als PHK', () => {
    expect(deriveQualificationTags('Pflegehilfskraft')).toContain('Nur PHK');
    expect(matchesQualificationRelevance('Pflegehilfskraft', 'Nur PHK')).toBe(true);
  });

  it.each(['Pflegefachassistenz', 'Pflegefachassistent', 'Pflegeassistenz'])(
    'unterscheidet %s von Pflegefachkräften', (qualification) => {
      expect(matchesQualificationRelevance(qualification, 'Nur PFK')).toBe(false);
      expect(matchesQualificationRelevance(qualification, 'Nur PFA')).toBe(true);
    },
  );

  it('laesst allgemeine kompetenzen immer zu', () => {
    expect(matchesQualificationRelevance('Pflegefachkraft', 'Alle')).toBe(true);
    expect(matchesQualificationRelevance('Pflegefachkraft', null)).toBe(true);
  });
});

it.each([
  ['Gesundheits- und Krankenpfleger', 'HKP G1'], ['Altenpfleger', 'HKP G1'],
  ['Notfallsanitäter', 'HKP G1'], ['3-jährig examiniert', 'HKP G1'],
  ['Krankenpflegehelfer', 'HKP G2'], ['Krankenpflegeassistentin', 'HKP G2'],
  ['Medizinische Fachangestellte', 'HKP G2'], ['Arzthelferin', 'HKP G2'],
  ['Pflegefachassistentin', 'HKP G3'], ['Pflegefachassistenz', 'HKP G3'],
  ['Altenpflegehelferin', 'HKP G4'], ['Heilerziehungspflegerin', 'HKP G4'],
  ['Ambulante Pflegeassistentin', 'HKP G4'], ['Rettungsassistent', 'HKP G4'],
])('uses the distinct source group for %s', (qualification, expected) => {
  for (const group of ['HKP G1', 'HKP G2', 'HKP G3', 'HKP G4']) {
    expect(matchesQualificationRelevance(qualification, group)).toBe(group === expected);
  }
});

it.each(['Pflegeassistenz', 'Pflegehilfskraft', '1-jährig examiniert', 'Pflegekraft/-helfer', 'Sonstige', 'Auszubildende Pflegefachfrau', 'Betreuungsfachkraft'])(
  'does not infer HKP evidence or a precise qualification from %s', (qualification) => {
    expect(matchesQualificationRelevance(qualification, 'HKP G1; HKP G2; HKP G3; HKP G4')).toBe(false);
  },
);
