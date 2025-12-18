import type { EmployeeWithPeriod } from './shared/types';

export const statusLabels: Record<EmployeeWithPeriod['status'], string> = {
  active: 'aktiv',
  left: 'ausgeschieden',
};

export const fteHelp = 'VZÄ (Vollzeitäquivalent) auf Basis der konfigurierten Vollzeitstunden (Standard 36).';
