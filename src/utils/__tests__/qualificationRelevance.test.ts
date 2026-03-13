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

  it('laesst allgemeine kompetenzen immer zu', () => {
    expect(matchesQualificationRelevance('Pflegefachkraft', 'Alle')).toBe(true);
    expect(matchesQualificationRelevance('Pflegefachkraft', null)).toBe(true);
  });
});
