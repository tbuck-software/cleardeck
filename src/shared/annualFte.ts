export type AnnualFteMethod = 'month-end-average' | 'year-average';
export const DEFAULT_ANNUAL_FTE_METHOD: AnnualFteMethod = 'month-end-average';
export const annualFteLabel = (method: AnnualFteMethod): string =>
  method === 'month-end-average' ? 'Durchschnitt aus 12 Monatsenden' : 'Taggewichteter Jahresdurchschnitt';
