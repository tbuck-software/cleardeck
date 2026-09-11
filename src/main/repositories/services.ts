import type { ServiceDefinition, ServiceType } from '../../shared/types';
import { SERVICE_TYPES } from '../../shared/services';
import { getDb } from '../database/connection';

type ServiceDefinitionRow = Omit<ServiceDefinition, 'active'> & { active: number };

const mapDefinition = (row: ServiceDefinitionRow): ServiceDefinition => ({
  ...row,
  active: row.active === 1,
});

export const listServiceDefinitions = (): ServiceDefinition[] => {
  const rows = getDb()
    .prepare(
      'SELECT id,name,serviceType,active,sortOrder FROM service_definitions ORDER BY sortOrder,id',
    )
    .all() as ServiceDefinitionRow[];
  return rows.map(mapDefinition);
};

const cleanName = (name: string): string => {
  const value = name.trim().replace(/\s+/g, ' ');
  if (!value) throw new Error('Leistungsbezeichnung darf nicht leer sein.');
  return value;
};

const nameKey = (name: string): string => cleanName(name).normalize('NFKC').toLocaleLowerCase('de-DE');

const assertUniqueName = (id: number | undefined, name: string): void => {
  const duplicate = listServiceDefinitions().find(
    (entry) =>
      entry.id !== id && nameKey(entry.name) === nameKey(name),
  );
  if (duplicate) throw new Error('Diese Leistung gibt es im Katalog bereits.');
};

const validateType = (serviceType: string): ServiceType => {
  if (!SERVICE_TYPES.includes(serviceType as ServiceType))
    throw new Error('Ungültige Leistungskategorie.');
  return serviceType as ServiceType;
};

export const addServiceDefinition = (input: {
  name: string;
  serviceType: ServiceType;
}): ServiceDefinition[] => {
  const db = getDb();
  const name = cleanName(input.name);
  const serviceType = validateType(input.serviceType);
  assertUniqueName(undefined, name);
  const maxSort = db.prepare('SELECT MAX(sortOrder) as mx FROM service_definitions').get() as {
    mx: number | null;
  };
  try {
    db.prepare(
      'INSERT INTO service_definitions(name,serviceType,active,sortOrder) VALUES (?,?,1,?)',
    ).run(name, serviceType, (maxSort.mx ?? 0) + 1);
  } catch (error) {
    if (String(error).toLowerCase().includes('unique'))
      throw new Error('Diese Leistung gibt es in der Kategorie bereits.');
    throw error;
  }
  return listServiceDefinitions();
};

export const updateServiceDefinition = (input: {
  id: number;
  name: string;
  serviceType: ServiceType;
}): ServiceDefinition[] => {
  const db = getDb();
  const name = cleanName(input.name);
  const serviceType = validateType(input.serviceType);
  const old = db
    .prepare('SELECT serviceType FROM service_definitions WHERE id=?')
    .get(input.id) as { serviceType?: ServiceType } | undefined;
  if (!old) throw new Error('Leistung nicht gefunden.');
  assertUniqueName(input.id, name);
  if (old?.serviceType && old.serviceType !== serviceType) {
    const usage = db
      .prepare('SELECT COUNT(*) as count FROM patient_services WHERE serviceDefinitionId=?')
      .get(input.id) as { count: number };
    if (usage.count)
      throw new Error(
        `Kategorie kann nicht geändert werden: ${usage.count} bestehende Zuordnung(en) verwenden diese Leistung. Lege eine neue Leistung an.`,
      );
  }
  try {
    db.prepare('UPDATE service_definitions SET name=?,serviceType=? WHERE id=?').run(
      name,
      serviceType,
      input.id,
    );
  } catch (error) {
    if (String(error).toLowerCase().includes('unique'))
      throw new Error('Diese Leistung gibt es in der Kategorie bereits.');
    throw error;
  }
  return listServiceDefinitions();
};

export const setServiceDefinitionActive = (id: number, active: boolean): ServiceDefinition[] => {
  getDb().prepare('UPDATE service_definitions SET active=? WHERE id=?').run(active ? 1 : 0, id);
  return listServiceDefinitions();
};

export const reorderServiceDefinitions = (orderedIds: number[]): ServiceDefinition[] => {
  const update = getDb().prepare('UPDATE service_definitions SET sortOrder=? WHERE id=?');
  orderedIds.forEach((id, index) => update.run(index, id));
  return listServiceDefinitions();
};
