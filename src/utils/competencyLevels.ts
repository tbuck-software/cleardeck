/** Labels for the current practical induction model. */
export const COMPETENCY_LEVELS = [
  'Offen',
  'Stufe 1',
  'Stufe 2',
  'Stufe 3',
  'Stufe 4',
  'Stufe 5',
  'Abgeschlossen',
];

/** What each stage of the current model means in practice. */
export const COMPETENCY_LEVEL_DESCRIPTIONS = [
  'Noch keine Einarbeitung erfolgt',
  'Gesehen / Erklärt',
  'Unter Anleitung / Aufsicht',
  'Selbstständig unter Nachkontrolle',
  'Selbstständig / Sicher',
  'Routiniert / Vertieft',
  'Abgeschlossen / Anleitend',
];

/** Short label plus meaning, e.g. "Stufe 2 · Unter Anleitung / Aufsicht". */
export const competencyLevelOption = (level: number) =>
  level === 0
    ? `Offen · ${COMPETENCY_LEVEL_DESCRIPTIONS[0]}`
    : `Stufe ${level} · ${COMPETENCY_LEVEL_DESCRIPTIONS[level]}`;

export const LEGACY_COMPETENCY_LEVELS = [
  'Offen',
  'Unterwiesen',
  'Beobachtet',
  'Unter Aufsicht',
  'Selbstständig',
  'Kann anleiten',
];
