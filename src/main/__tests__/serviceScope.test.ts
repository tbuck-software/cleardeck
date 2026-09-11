/// <reference types="vitest/globals" />
// @vitest-environment node

import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import {
  addServiceDefinition,
  listServiceDefinitions,
  setServiceDefinitionActive,
  updateServiceDefinition,
} from '../repositories/services';
import { getPatient, savePatient } from '../repositories/patients';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../database/connection', () => ({ getDb: () => state.db }));

describe('Leistungskatalog und Personenlistenzuordnung', () => {
  let db: SqliteAdapter;

  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
  });

  afterEach(() => db.close());

  it('seedet die vereinbarten §36-Auswahlen und speichert Zuordnungen per ID', () => {
    const catalog = listServiceDefinitions();
    const large = catalog.find((entry) => entry.name === 'Große Grundpflege')!;
    const relief = catalog.find((entry) => entry.serviceType === 'relief')!;
    const patient = savePatient({
      name: 'Synthetische Person',
      serviceDefinitionIds: [large.id!, relief.id!],
      cognitionImpaired: null,
      mobilityImpaired: null,
      careLevel: null,
    }).find((entry) => entry.name === 'Synthetische Person')!;

    expect(patient.serviceDefinitionIds).toEqual([large.id, relief.id]);
    expect(patient.services?.map((service) => service.label)).toEqual([
      'Große Grundpflege',
      'Betreuung oder Entlastung nach § 45a/45b SGB XI',
    ]);
    expect(patient.serviceScope).toBe('eligible');
    expect(patient.careLevel).toBeNull();
  });

  it('seedet Behandlungspflege-Aufgaben und leitet daraus nur die Einschlussentscheidung ab', () => {
    const catalog = listServiceDefinitions();
    const taskNames = [
      'Medizinische Kompressionsstrümpfe anziehen',
      'Medizinische Kompressionsstrümpfe ausziehen',
      'Medikamente richten / Medikamentenbox stellen',
      'Medikamente verabreichen',
    ];
    const tasks = taskNames.map((name) => catalog.find((entry) => entry.name === name)!);
    expect(tasks.every((entry) => entry.serviceType === 's37-hkp')).toBe(true);

    const patient = savePatient({
      name: 'Behandlungspflege Person',
      serviceDefinitionIds: tasks.map((entry) => entry.id!),
      careLevel: null,
      cognitionImpaired: null,
      mobilityImpaired: null,
      hkpCodes: [],
    }).find((entry) => entry.name === 'Behandlungspflege Person')!;

    expect(patient.serviceScope).toBe('eligible');
    expect(patient.careLevel).toBeNull();
    expect(patient.cognitionImpaired).toBeNull();
    expect(patient.mobilityImpaired).toBeNull();
    expect(patient.hkpCodes).toEqual([]);
  });

  it('lässt unbekannte Leistungen speichern und erhält alte Entscheidungen bis zur Bearbeitung', () => {
    const legacy = savePatient({
      name: 'Legacy Person',
      serviceScope: 'eligible',
      careLevel: 4,
    }).find((entry) => entry.name === 'Legacy Person')!;
    expect(legacy.serviceScopeSource).toBe('legacy');
    expect(legacy.serviceDefinitionIds).toEqual([]);

    const unknown = savePatient({ name: 'Noch offen', serviceDefinitionIds: [] }).find(
      (entry) => entry.name === 'Noch offen',
    )!;
    expect(unknown.serviceScope).toBe('unknown');
    expect(unknown.id && getPatient(unknown.id)?.serviceScope).toBe('unknown');
  });

  it('verhindert eine nachträgliche Kategorieänderung bei vorhandenen Zuordnungen', () => {
    const entry = listServiceDefinitions().find((item) => item.name === 'Große Grundpflege')!;
    savePatient({ name: 'Zugeordnet', serviceDefinitionIds: [entry.id!] });
    expect(() =>
      updateServiceDefinition({ id: entry.id!, name: entry.name, serviceType: 'household' }),
    ).toThrow(/bestehende Zuordnung/);
  });

  it('behält einen alten Label-Snapshot nach Umbenennung', () => {
    const entry = listServiceDefinitions().find((item) => item.name === 'Ganzwaschung')!;
    const patient = savePatient({ name: 'Snapshot Person', serviceDefinitionIds: [entry.id!] })[0];
    updateServiceDefinition({ id: entry.id!, name: 'Ganzkörperwäsche', serviceType: 's36-care' });
    expect(getPatient(patient.id!)?.services?.[0]).toMatchObject({
      label: 'Ganzkörperwäsche',
      labelSnapshot: 'Ganzwaschung',
    });

    savePatient({ id: patient.id!, name: 'Snapshot Person aktualisiert' });
    expect(getPatient(patient.id!)?.services?.[0]).toMatchObject({
      label: 'Ganzkörperwäsche',
      labelSnapshot: 'Ganzwaschung',
    });
    expect(getPatient(patient.id!)?.serviceScope).toBe('eligible');
  });

  it('verhindert neue Zuordnungen inaktiver Leistungen und Unicode-Duplikate', () => {
    const custom = addServiceDefinition({ name: '  Große Hilfe  ', serviceType: 's36-care' }).find(
      (entry) => entry.name === 'Große Hilfe',
    )!;
    expect(() => addServiceDefinition({ name: 'GROẞE HILFE', serviceType: 's36-care' })).toThrow(
      /bereits/,
    );
    expect(() => addServiceDefinition({ name: 'Große Hilfe', serviceType: 'household' })).toThrow(
      /Katalog/,
    );
    const existing = savePatient({ name: 'Bestehende Auswahl', serviceDefinitionIds: [custom.id!] })[0];
    setServiceDefinitionActive(custom.id!, false);
    expect(() => savePatient({ name: 'Inaktive Auswahl', serviceDefinitionIds: [custom.id!] })).toThrow(
      /Inaktive/,
    );
    expect(savePatient({ id: existing.id!, name: 'Bestehende Auswahl geändert', serviceDefinitionIds: [custom.id!] })).toHaveLength(1);
  });

  it('weist Aktualisierungen unbekannter Katalog-IDs zurück', () => {
    expect(() =>
      updateServiceDefinition({ id: 999999, name: 'Nicht vorhanden', serviceType: 's36-care' }),
    ).toThrow(/nicht gefunden/);
  });

  it('rollt Patient und Zuordnungen bei einem Fehler gemeinsam zurück', () => {
    const entry = listServiceDefinitions().find((item) => item.name === 'Ganzwaschung')!;
    const patient = savePatient({ name: 'Unveränderte Person' })[0];
    db.exec(`
      CREATE TRIGGER fail_patient_service_insert
      BEFORE INSERT ON patient_services
      BEGIN
        SELECT RAISE(ABORT, 'synthetischer Zuordnungsfehler');
      END;
    `);

    expect(() =>
      savePatient({
        id: patient.id,
        name: 'Darf nicht gespeichert werden',
        serviceDefinitionIds: [entry.id!],
      }),
    ).toThrow(/synthetischer Zuordnungsfehler/);
    expect(getPatient(patient.id!)).toMatchObject({
      name: 'Unveränderte Person',
      serviceDefinitionIds: [],
    });
  });
});
