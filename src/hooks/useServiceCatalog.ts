import { useCallback, useState } from 'react';
import api from '../services/api';
import type { ConfirmActionOptions, ServiceDefinitionModalState } from '../types/ui';
import type { ServiceDefinition } from '../shared/types';

export const emptyServiceDefinitionModal = (): ServiceDefinitionModalState => ({
  open: false,
  name: '',
  serviceType: 's36-care',
});

const serviceDefinitionToModal = (entry: ServiceDefinition): ServiceDefinitionModalState => ({
  open: true,
  id: entry.id,
  name: entry.name,
  serviceType: entry.serviceType,
});

type Params = {
  handleError: (err: unknown) => void;
  setToast: (message: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    options?: ConfirmActionOptions,
  ) => void;
  /** Patients carry catalogue labels and order, so they follow every change. */
  refreshPatients: () => Promise<void> | void;
};

const useServiceCatalog = ({ handleError, setToast, confirmAction, refreshPatients }: Params) => {
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
      await refreshPatients();
      setToast('Leistung gespeichert.');
    } catch (error) {
      handleError(error);
    }
  }, [handleError, refreshPatients, serviceDefinitionModal, setToast]);

  const toggleServiceDefinition = useCallback(
    (id: number, active: boolean) => {
      confirmAction(
        active ? 'Leistung wieder aktivieren?' : 'Leistung deaktivieren?',
        async () => {
          try {
            setServiceDefinitions(await api.services.setActive(id, active));
            await refreshPatients();
            setToast(active ? 'Leistung aktiviert.' : 'Leistung deaktiviert.');
          } catch (error) {
            handleError(error);
          }
        },
        { confirmLabel: active ? 'Aktivieren' : 'Deaktivieren', danger: !active },
      );
    },
    [confirmAction, handleError, refreshPatients, setToast],
  );

  const reorderServiceDefinitions = useCallback(
    async (ids: number[]) => {
      try {
        setServiceDefinitions(await api.services.reorder(ids));
        await refreshPatients();
      } catch (error) {
        handleError(error);
      }
    },
    [handleError, refreshPatients],
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
