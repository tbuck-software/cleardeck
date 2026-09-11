import React from 'react';
import Dialog from '../ui/Dialog';
import { SERVICE_TYPE_LABEL } from '../../shared/services';
import type { ServiceDefinition, ServiceType } from '../../shared/types';

export type ServiceDefinitionModalState = {
  open: boolean;
  id?: number;
  name: string;
  serviceType: ServiceType;
};

type Props = {
  state: ServiceDefinitionModalState;
  onChange: (next: Partial<ServiceDefinitionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const SERVICE_OPTIONS: ServiceType[] = [
  's36-care',
  's36-support',
  's39-prevention',
  's37-hkp',
  's37c-aki',
  'household',
  'relief',
  's37-consultation',
];

const ServiceDefinitionModal = ({ state, onChange, onClose, onSave }: Props) => (
  <Dialog
    open={state.open}
    width={520}
    title={state.id ? 'Leistung bearbeiten' : 'Neue Leistung'}
    subtitle="Leistungen bleiben bei bestehenden Zuordnungen nachvollziehbar. Deaktiviere sie, wenn sie nicht mehr angeboten werden."
    primaryLabel="Speichern"
    primaryDisabled={!state.name.trim()}
    onPrimary={onSave}
    onClose={onClose}
  >
    <div className="field">
      <label htmlFor="service-definition-name">Bezeichnung</label>
      <input
        id="service-definition-name"
        className="input"
        value={state.name}
        placeholder="z. B. Medikamentengabe"
        onChange={(event) => onChange({ name: event.target.value })}
      />
    </div>
    <div className="field">
      <label htmlFor="service-definition-type">Kategorie für die MD-Personenliste</label>
      <select
        id="service-definition-type"
        className="input"
        value={state.serviceType}
        onChange={(event) => onChange({ serviceType: event.target.value as ServiceType })}
      >
        {SERVICE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {SERVICE_TYPE_LABEL[value]}
          </option>
        ))}
      </select>
    </div>
  </Dialog>
);

export const emptyServiceDefinitionModal = (): ServiceDefinitionModalState => ({
  open: false,
  name: '',
  serviceType: 's36-care',
});

export const serviceDefinitionToModal = (entry: ServiceDefinition): ServiceDefinitionModalState => ({
  open: true,
  id: entry.id,
  name: entry.name,
  serviceType: entry.serviceType,
});

export default ServiceDefinitionModal;
