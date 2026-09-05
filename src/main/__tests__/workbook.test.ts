/// <reference types="vitest/globals" />
// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as XLSX from 'xlsx';
import { buildPersonListRows, buildPersonListWorkbook, writeWorkbook } from '../workbook';
import type { Patient } from '../../shared/types';

const patients: Patient[] = [
  {
    id: 2,
    name: 'Werner Fuchs',
    birthDate: '1936-01-25',
    contact: 'Betreuer Hr. Lange · 0431 998877',
    cognitionImpaired: true,
    mobilityImpaired: true,
    hkpCode: '31a',
    intensiveCare: null,
    careLevel: 4,
  },
  {
    id: 1,
    name: 'Erika Mustermann',
    birthDate: '1941-03-02',
    contact: null,
    cognitionImpaired: true,
    mobilityImpaired: false,
    hkpCode: null,
    intensiveCare: null,
    careLevel: 3,
  },
  {
    id: 3,
    name: 'Kurt Ziegler',
    birthDate: null,
    contact: null,
    cognitionImpaired: null,
    mobilityImpaired: null,
    hkpCode: '8',
    intensiveCare: 'AKI-B',
    careLevel: null,
  },
];

describe('buildPersonListRows', () => {
  it('sortiert alphabetisch, wie Anlage 7 es verlangt', () => {
    expect(buildPersonListRows(patients).map((row) => row.Name)).toEqual([
      'Erika Mustermann',
      'Kurt Ziegler',
      'Werner Fuchs',
    ]);
  });

  it('leitet die Teilgruppe ab und hält HKP davon getrennt', () => {
    const [erika, kurt, werner] = buildPersonListRows(patients);

    expect(erika.Teilgruppe).toBe('C');
    expect(erika['Aufwändige HKP (Ziffer)']).toBe('');

    expect(werner.Teilgruppe).toBe('A');
    expect(werner['Aufwändige HKP (Ziffer)']).toBe('31a');
    expect(werner['Aufwändige HKP (Leistung)']).toBe('Wundversorgung chronische, schwer heilende Wunde');

    // Ohne Gutachten-Daten bleibt die Teilgruppe leer statt geraten.
    expect(kurt.Teilgruppe).toBe('');
    expect(kurt['AKI / pHKP']).toBe('AKI mit Beatmung');
  });

  it('lässt fehlende Angaben leer, statt sie zu erfinden', () => {
    const [erika] = buildPersonListRows(patients);

    expect(erika['Bevollmächtigte / Betreuung (mit Telefon)']).toBe('');
    expect(buildPersonListRows(patients)[1].Pflegegrad).toBe('');
  });
});

describe('writeWorkbook', () => {
  // Regression: XLSX.writeFile() resolves fs through a dynamic require that
  // webpack strips, and then throws "cannot save file".
  it('schreibt die Datei ohne das interne fs-Handle von xlsx', () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-')), 'Anlage-7.xlsx');

    expect(() => writeWorkbook(buildPersonListWorkbook(patients), target)).not.toThrow();
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.statSync(target).size).toBeGreaterThan(0);

    const reread = XLSX.read(fs.readFileSync(target));
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(reread.Sheets['Anlage 7']);
    expect(rows).toHaveLength(3);
    expect(rows[0].Name).toBe('Erika Mustermann');

    fs.rmSync(path.dirname(target), { recursive: true, force: true });
  });
});
