import React from 'react';
import Dialog from '../ui/Dialog';
import { SERVICE_TYPES, SERVICE_TYPE_LABEL } from '../../shared/services';
import type { ServiceType } from '../../shared/types';
import type { ServiceDefinitionModalState } from '../../types/ui';

type Props = {
  state: ServiceDefinitionModalState;
  /** State of the saved service, not of the form. */
  active?: boolean;
  onChange: (next: Partial<ServiceDefinitionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleActive?: () => void;
};

const ServiceDefinitionModal = ({
  state,
  active,
  onChange,
  onClose,
  onSave,
  onToggleActive,
}: Props) => (
  <Dialog
    open={state.open}
    width={520}
    title={state.id ? 'Leistung bearbeiten' : 'Neue Leistung'}
    subtitle="Leistungen bleiben bei bestehenden Zuordnungen nachvollziehbar. Nicht mehr angebotene Leistungen lassen sich deaktivieren."
    primaryLabel="Speichern"
    primaryDisabled={!state.name.trim()}
    onPrimary={onSave}
    secondaryLabel={
      state.id && onToggleActive ? (active === false ? 'Aktivieren' : 'Deaktivieren') : undefined
    }
    onSecondary={state.id && onToggleActive ? onToggleActive : undefined}
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
        {SERVICE_TYPES.map((value) => (
          <option key={value} value={value}>
            {SERVICE_TYPE_LABEL[value]}
          </option>
        ))}
      </select>
    </div>
  </Dialog>
);

export default ServiceDefinitionModal;
