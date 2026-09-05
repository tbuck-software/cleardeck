/**
 * QPR ambulant — Teilgruppen, aufwändige HKP und Pflegevisiten-Fälligkeit.
 *
 * Rules and their sources live in docs/adr/0001; this module is the single
 * place the app derives them, so the letters never drift between screens.
 */

import type { HkpCode, IntensiveCare, Patient, Teilgruppe } from '../shared/types';

/** Sampling target per group (QPR Kap. 8.1). Under-filled groups are not topped up. */
export const TEILGRUPPE_TARGET: Record<Teilgruppe | 'D', number> = {
  A: 2,
  B: 2,
  C: 2,
  D: 3,
  none: 0,
};

export const TEILGRUPPE_LABEL: Record<Teilgruppe, string> = {
  A: 'Mobilität und Kognition beeinträchtigt',
  B: 'Mobilität beeinträchtigt, Kognition nicht',
  C: 'Kognition beeinträchtigt, Mobilität nicht',
  none: 'Ohne Beeinträchtigung — nur über HKP stichprobenrelevant',
};

export const TEILGRUPPE_SHORT: Record<Teilgruppe, string> = {
  A: 'mobil + kognitiv beeinträchtigt',
  B: 'mobil beeinträchtigt',
  C: 'kognitiv beeinträchtigt',
  none: 'ohne Beeinträchtigung',
};

export const HKP_LABEL: Record<HkpCode, string> = {
  '6': 'Absaugen',
  '8': 'Bedienung/Überwachung Beatmungsgerät',
  '29': 'Wechsel/Pflege Trachealkanüle',
  '31a': 'Wundversorgung chronische, schwer heilende Wunde',
};

export const HKP_SHORT: Record<HkpCode, string> = {
  '6': 'Absaugen',
  '8': 'Beatmung',
  '29': 'Trachealkanüle',
  '31a': 'chron. Wunde',
};

export const HKP_CODES: HkpCode[] = ['6', '8', '29', '31a'];

export const INTENSIVE_CARE_LABEL: Record<IntensiveCare, string> = {
  AKI: 'AKI',
  'AKI-B': 'AKI mit Beatmung',
  pHKP: 'pHKP',
  'pHKP-EV': 'pHKP Erstverordnung',
};

/** Days after admission a first Pflegevisite is expected when none exists yet. */
export const FIRST_VISIT_DAYS = 14;

export const DEFAULT_VISIT_INTERVAL_DAYS = 90;

/**
 * Teilgruppe from the Pflegegrad assessment (Modul 1 Mobilität / Modul 2 Kognition).
 * Returns null while either dimension is unrecorded — that person cannot be
 * placed in the sample yet, which is a data gap the app has to surface.
 */
export const teilgruppeOf = (
  cognitionImpaired?: boolean | null,
  mobilityImpaired?: boolean | null,
): Teilgruppe | null => {
  if (cognitionImpaired == null || mobilityImpaired == null) return null;
  if (cognitionImpaired && mobilityImpaired) return 'A';
  if (mobilityImpaired) return 'B';
  if (cognitionImpaired) return 'C';
  return 'none';
};

/** D is an additional mark alongside A–C, never a replacement for it. */
export const hasTeilgruppeD = (patient: Pick<Patient, 'hkpCode'>): boolean =>
  patient.hkpCode != null;

/** "B + HKP 31a", "A", "—" — the compact form used in lists and exports. */
export const teilgruppeLabel = (patient: Pick<Patient, 'cognitionImpaired' | 'mobilityImpaired' | 'hkpCode'>): string => {
  const group = teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
  const base = group == null ? '—' : group === 'none' ? 'ohne' : group;
  return patient.hkpCode ? `${base} + HKP ${patient.hkpCode}` : base;
};

const MS_PER_DAY = 86_400_000;

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / MS_PER_DAY);

export type VisitDue = {
  dueDate: string;
  daysUntilDue: number;
  overdue: boolean;
  /** No visit documented yet — the due date counts from admission. */
  first: boolean;
  label: string;
};

/**
 * When the next Pflegevisite is due. Without a documented visit the clock runs
 * from admission instead, so newly admitted people surface as a first visit
 * rather than silently sitting at "no visits".
 */
export const visitDue = (
  input: { latestVisitDate?: string | null; admissionDate?: string | null },
  today: string,
  intervalDays: number = DEFAULT_VISIT_INTERVAL_DAYS,
): VisitDue => {
  const first = !input.latestVisitDate;
  const anchor = input.latestVisitDate ?? input.admissionDate ?? today;
  const dueDate = addDays(anchor, first ? FIRST_VISIT_DAYS : intervalDays);
  const daysUntilDue = daysBetween(today, dueDate);
  return {
    dueDate,
    daysUntilDue,
    overdue: daysUntilDue < 0,
    first,
    label:
      daysUntilDue < 0
        ? `überfällig seit ${-daysUntilDue} T.`
        : daysUntilDue === 0
          ? 'heute'
          : `in ${daysUntilDue} Tagen`,
  };
};
