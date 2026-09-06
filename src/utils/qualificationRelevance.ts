const normalize = (value: string): string => value.toLowerCase().trim();

export const deriveQualificationTags = (qualification: string): Set<string> => {
  const value = normalize(qualification);
  const tags = new Set<string>();

  if (!value) return tags;

  const assistant = /1[- ](?:jährig|jaehrig)|pflegehilf|pflegeassist|helfer/.test(value);
  if (
    !assistant &&
    (value.includes('pflegefach') ||
      value.includes('fachkraft') ||
      value.includes('3-jährig') ||
      value.includes('3-jaehrig'))
  ) {
    tags.add('Nur PFK');
  }

  if (
    value.includes('pflegehilf') ||
    value.includes('pflegekraft/-helfer') ||
    value.includes('pflegekraft') ||
    value.includes('helfer') ||
    value.includes('1-jährig') ||
    value.includes('1-jaehrig')
  ) {
    tags.add('Nur PHK');
  }

  if (value.includes('azubi') || value.includes('auszub')) {
    tags.add('Azubi');
  }

  if (value.includes('praxisanleitung') || value.includes('praxisanleiter')) {
    tags.add('Praxisanleitung');
    if (!assistant) tags.add('Nur PFK');
  }

  if (
    value.includes('qmb') ||
    value.includes('qualitätsmanagement') ||
    value.includes('qualitaetsmanagement')
  ) {
    tags.add('QMB');
  }

  return tags;
};

export const matchesQualificationRelevance = (
  qualification: string,
  relevance?: string | null,
): boolean => {
  const rule = (relevance ?? 'Alle').trim();
  if (!rule || rule === 'Alle') return true;

  const tags = deriveQualificationTags(qualification);
  if (tags.has(rule)) return true;

  return rule
    .split(/[;,/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => tags.has(part));
};
