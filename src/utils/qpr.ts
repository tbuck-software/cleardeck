/**
 * QPR ambulant — Teilgruppen, aufwändige HKP und Pflegevisiten-Fälligkeit.
 *
 * Rules and their sources live in docs/adr/0001; this module is the single
 * place the app derives them, so the letters never drift between screens.
 */

import type {
  HkpCode,
  IntensiveCare,
  Patient,
  ServiceScope,
  ServiceType,
  Teilgruppe,
} from '../shared/types';
import { SERVICE_TYPE_LABEL, SERVICE_TYPES } from '../shared/services';

export type ServiceScopeResult = {
  scope: ServiceScope;
  /** Stands alone as a sentence and never repeats the verdict. */
  reason: string;
};

/** One wording for "no services recorded yet", shared by every screen. */
export const SERVICES_NOT_RECORDED = 'Leistungen sind noch nicht erfasst.';

export const SERVICE_SCOPE_LABEL: Record<ServiceScope, string> = {
  eligible: 'MD-Personenliste: ja',
  excluded: 'MD-Personenliste: nein',
  unknown: 'MD-Personenliste: offen',
};

const INCLUDED_SERVICE_TYPES = new Set<ServiceType>([
  's36-care',
  's36-support',
  's39-prevention',
  's37-hkp',
  's37c-aki',
]);

/** Normalize catalogue categories before deriving the QPR conclusion. */
export const normalizeServiceTypes = (serviceTypes?: ServiceType[] | null): ServiceType[] => {
  const types = [...new Set(serviceTypes ?? [])].filter((type): type is ServiceType =>
    SERVICE_TYPES.includes(type),
  );
  return SERVICE_TYPES.filter((type) => types.includes(type));
};

/**
 * QPR chapter 8 inclusion/exclusion, independent of care grade and assessment
 * data. Verified against the official MD Bund source:
 * https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf#page=25
 */
export const deriveServiceScope = (
  serviceTypes?: ServiceType[] | null,
): ServiceScopeResult => {
  const types = normalizeServiceTypes(serviceTypes);
  if (types.length === 0) return { scope: 'unknown', reason: SERVICES_NOT_RECORDED };
  const included = types.filter((type) => INCLUDED_SERVICE_TYPES.has(type));
  if (included.length) {
    const labels = included.map((type) => SERVICE_TYPE_LABEL[type]).join(', ');
    const extras = types.some((type) => type === 'relief' || type === 'household')
      ? ' Zusätzliche Haushalts-, Betreuungs- oder Entlastungsleistungen ändern daran nichts.'
      : '';
    return {
      scope: 'eligible',
      reason: `${labels} ${included.length === 1 ? 'gehört' : 'gehören'} zum Versorgungsumfang.${extras}`,
    };
  }
  if (types.length === 1 && types[0] === 's37-consultation')
    return {
      scope: 'excluded',
      reason:
        'Ein Beratungsbesuch nach § 37 Abs. 3 SGB XI allein zählt nicht zum Versorgungsumfang.',
    };
  return {
    scope: 'excluded',
    reason:
      'Haushaltshilfe, Betreuung oder Entlastung nach § 45a/45b SGB XI und der Beratungsbesuch nach § 37 Abs. 3 SGB XI zählen nicht zum Versorgungsumfang.',
  };
};

/** Resolve the current conclusion while preserving an explicit pre-service legacy decision. */
export const serviceScopeOf = (
  patient: Pick<
    Patient,
    | 'serviceScope'
    | 'serviceScopeSource'
    | 'services'
  >,
): ServiceScopeResult => {
  const serviceTypes = patient.services?.map((service) => service.serviceType);
  const hasServiceRecord =
    patient.serviceScopeSource === 'services' ||
    (serviceTypes?.length ?? 0) > 0;
  if (!hasServiceRecord && patient.serviceScopeSource !== 'services' && patient.serviceScope) {
    return {
      scope: patient.serviceScope,
      reason:
        patient.serviceScope === 'unknown'
          ? SERVICES_NOT_RECORDED
          : `Übernommene Entscheidung aus der früheren Erfassung. ${SERVICES_NOT_RECORDED}`,
    };
  }
  return deriveServiceScope(serviceTypes);
};

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
export const hasTeilgruppeD = (patient: Pick<Patient, 'hkpCode' | 'hkpCodes'>): boolean =>
  hkpCodesOf(patient).length > 0;

/** "B + HKP 31a", "A", "—" — the compact form used in lists and exports. */
export const teilgruppeLabel = (
  patient: Pick<Patient, 'cognitionImpaired' | 'mobilityImpaired' | 'hkpCode' | 'hkpCodes'>,
): string => {
  const group = teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired);
  const base = group == null ? '—' : group === 'none' ? 'ohne' : group;
  const codes = hkpCodesOf(patient);
  return codes.length ? `${base} + HKP ${codes.join(', ')}` : base;
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
  Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / MS_PER_DAY,
  );

export type VisitDue = {
  dueDate: string;
  daysUntilDue: number;
  overdue: boolean;
  /** No visit documented yet — the due date counts from admission. */
  first: boolean;
  missingAnchor?: boolean;
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
  if (!input.latestVisitDate && !input.admissionDate)
    return {
      dueDate: '',
      daysUntilDue: 0,
      overdue: false,
      first: true,
      missingAnchor: true,
      label: 'Aufnahmedatum fehlt; Fälligkeit ungeklärt',
    };
  const anchor = input.latestVisitDate ?? input.admissionDate!;
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

/** The full code list is authoritative; the scalar remains a legacy compatibility field. */
export const hkpCodesOf = (patient: Pick<Patient, 'hkpCode' | 'hkpCodes'>): HkpCode[] =>
  patient.hkpCodes ?? (patient.hkpCode ? [patient.hkpCode] : []);

export const isActivePatient = (patient: Patient, today = toIsoDate(new Date())): boolean =>
  patient.serviceStatus !== 'ended' &&
  (!patient.admissionDate || patient.admissionDate <= today) &&
  (!patient.serviceEndDate || patient.serviceEndDate >= today);

export const representativeMissing = (patient: Patient): boolean =>
  patient.representativeStatus !== 'none' && !patient.contact?.trim();

export const needsAssessment = (patient: Patient, today = toIsoDate(new Date())): boolean => {
  if (
    teilgruppeOf(patient.cognitionImpaired, patient.mobilityImpaired) == null ||
    !patient.assessmentDate ||
    !patient.assessmentSource ||
    patient.assessmentSource === 'unknown' ||
    patient.assessmentDate > today
  )
    return true;
  if (patient.assessmentSource === 'own') return !patient.assessmentNote?.trim();
  const date = new Date(`${patient.assessmentDate}T12:00:00`);
  const month = date.getMonth();
  date.setFullYear(date.getFullYear() + 1);
  if (date.getMonth() !== month) date.setDate(0);
  return toIsoDate(date) < today;
};

export const intensiveCareForList = (patient: Patient, today = toIsoDate(new Date())): string => {
  if (!patient.intensiveCare) return '';
  if (patient.intensiveCare.startsWith('AKI'))
    return `AKI${patient.intensiveCare === 'AKI-B' ? ' B' : ''} ${patient.akiSetting ?? '(EV/MV fehlt)'}`;
  const days = patient.phkpStartDate ? daysBetween(patient.phkpStartDate, today) : -1;
  return patient.phkpFirst && days >= 0 && days < 28 ? 'pHKP E' : 'pHKP';
};
