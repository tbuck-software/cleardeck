import type { ServiceType } from './types';

/** Categories used by the QPR inclusion rule and the service catalogue. */
export const SERVICE_TYPES: ServiceType[] = [
  's36-care',
  's36-support',
  's39-prevention',
  's37-hkp',
  's37c-aki',
  'household',
  'relief',
  's37-consultation',
];

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  's36-care': 'Körperbezogene Pflege nach § 36 SGB XI',
  's36-support': 'Pflegerische Betreuung nach § 36 SGB XI',
  's39-prevention': 'Verhinderungspflege nach § 39 SGB XI',
  's37-hkp': 'Häusliche Krankenpflege nach § 37 SGB V',
  's37c-aki': 'Außerklinische Intensivpflege nach § 37c SGB V',
  household: 'Hilfe bei der Haushaltsführung nach SGB XI',
  relief: 'Betreuung oder Entlastung nach § 45a/45b SGB XI',
  's37-consultation': 'Nur Beratungsbesuch nach § 37 Abs. 3 SGB XI',
};
