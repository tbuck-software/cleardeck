const normalize = (value: string): string => value.toLowerCase().trim();

export const deriveQualificationTags = (qualification: string): Set<string> => {
  const value = normalize(qualification);
  const tags = new Set<string>();

  if (!value) return tags;

  const assistant = /1[- ](?:jährig|jaehrig)|pflegehilf|pflege(?:fach)?assist|helfer/.test(value);
  if (
    !assistant &&
    (value.includes('pflegefach') ||
      value.includes('fachkraft') ||
      value.includes('3-jährig') ||
      value.includes('3-jaehrig'))
  ) {
    tags.add('Nur PFK');
  }

  if (/pflege(?:fach)?assist/.test(value)) tags.add('Nur PFA');

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
  const hkpGroup = deriveHkpGroup(qualification);
  if (hkpGroup) tags.add(hkpGroup);
  if (tags.has(rule)) return true;

  return rule
    .split(/[;,/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => tags.has(part));
};

/** Deliberately narrower than the legacy tags: generic assistants/helpers stay unclassified. */
export const deriveHkpGroup = (qualification: string): string | undefined => {
  const value = normalize(qualification);
  const explicit = /^hkp g[1-4]$/.test(value);
  if (explicit) return qualification.trim().toUpperCase();
  if (/azubi|auszub|schüler|schueler|student/.test(value)) return undefined;
  if (/krankenpflege(?:helfer|assisten)|medizinische.{0,2}fachangestellte|arzthelfer|^mfa$/.test(value)) return 'HKP G2';
  if (/pflegefachassist/.test(value)) return 'HKP G3';
  if (/altenpflegehelf|heilerziehungspfleg|familienpfleg|rettungsassisten|ambulante.{0,3}pflegeassist/.test(value)) return 'HKP G4';
  if (/helfer|assist|hilf|betreuung/.test(value)) return undefined;
  if (/pflegefach(?:kraft|frau|mann|person)|krankenschwester|krankenpfleger|kinderkrankenpfleger|altenpfleger|notfallsanitäter|notfallsanitaeter|3[- ](?:jährig|jaehrig)/.test(value)) return 'HKP G1';
  return undefined;
};
