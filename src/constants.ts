import type { EmployeeWithPeriod } from './shared/types';

export const statusLabels: Record<EmployeeWithPeriod['status'], string> = {
  active: 'aktiv',
  left: 'ausgeschieden',
};

export const fteHelp =
  'Betriebliche VZÄ-Regel: ab 36 Wochenstunden 1,0; darunter Anteil am Bezugswert (Standard 36), höchstens 1,0. Historische erfasste Werte bleiben erhalten.';
