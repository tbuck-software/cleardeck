import { useCallback, useState } from 'react';
import api from '../services/api';
import type { ConfirmActionOptions } from '../types/ui';
import type { ServiceDefinition } from '../shared/types';
import type { ServiceDefinitionModalState } from '../components/modals/ServiceDefinitionModal';
import { emptyServiceDefinitionModal, serviceDefinitionToModal } from '../components/modals/ServiceDefinitionModal';

type Params = {
  handleError: (err: unknown) => void;
  setToast: (message: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    options?: ConfirmActionOptions,
  ) => void;
};

const useServiceCatalog = ({ handleError, setToast, confirmAction }: Params) => {
  const [serviceDefinitions, setServiceDefinitions] = useState<ServiceDefinition[]>([]);
  const [serviceDefinitionModal, setServiceDefinitionModal] = useState<ServiceDefinitionModalState>(
    emptyServiceDefinitionModal(),
  );

  const loadServiceDefinitions = useCallback(async () => {
    try {
      setServiceDefinitions(await api.services.list());
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  const saveServiceDefinition = useCallback(async () => {
    try {
      const list = serviceDefinitionModal.id
        ? await api.services.update({
            id: serviceDefinitionModal.id,
            name: serviceDefinitionModal.name,
            serviceType: serviceDefinitionModal.serviceType,
          })
        : await api.services.add({
            name: serviceDefinitionModal.name,
            serviceType: serviceDefinitionModal.serviceType,
          });
      setServiceDefinitions(list);
      setServiceDefinitionModal(emptyServiceDefinitionModal());
      setToast('Leistung gespeichert.');
    } catch (error) {
      handleError(error);
    }
  }, [handleError, serviceDefinitionModal, setToast]);

  const toggleServiceDefinition = useCallback(
    (id: number, active: boolean) => {
      confirmAction(
        active ? 'Leistung wieder aktivieren?' : 'Leistung deaktivieren?',
        async () => {
          try {
            setServiceDefinitions(await api.services.setActive(id, active));
            setToast(active ? 'Leistung aktiviert.' : 'Leistung deaktiviert.');
          } catch (error) {
            handleError(error);
          }
        },
        { confirmLabel: active ? 'Aktivieren' : 'Deaktivieren', danger: !active },
      );
    },
    [confirmAction, handleError, setToast],
  );

  const reorderServiceDefinitions = useCallback(
    async (ids: number[]) => {
      try {
        setServiceDefinitions(await api.services.reorder(ids));
      } catch (error) {
        handleError(error);
      }
    },
    [handleError],
  );

  return {
    state: { serviceDefinitions, serviceDefinitionModal },
    setters: { setServiceDefinitions, setServiceDefinitionModal },
    actions: {
      loadServiceDefinitions,
      saveServiceDefinition,
      toggleServiceDefinition,
      reorderServiceDefinitions,
      openCreate: () => setServiceDefinitionModal({ ...emptyServiceDefinitionModal(), open: true }),
      openEdit: (entry: ServiceDefinition) => setServiceDefinitionModal(serviceDefinitionToModal(entry)),
    },
  };
};

export default useServiceCatalog;
