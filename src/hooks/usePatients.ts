import { localDate } from '../utils/calendarDate';
import { useCallback, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import type { PatientWithLatestVisit, PatientVisit } from '../shared/types';
import { isActivePatient, needsAssessment, hasTeilgruppeD, teilgruppeOf } from '../utils/qpr';
import type {
  ConfirmActionOptions,
  PatientModalState,
  TeilgruppeFilter,
  VisitModalState,
} from '../types/ui';

export const emptyPatientModal = (): PatientModalState => ({
  open: false,
  mode: 'create',
  name: '',
  birthDate: '',
  diagnosis: '',
  note: '',
  contact: '',
  admissionDate: '',
  cognitionImpaired: null,
  mobilityImpaired: null,
  hkpCode: null,
  intensiveCare: null,
  careLevel: null,
  serviceDefinitionIds: [],
  serviceScopeSource: 'services',
});

export const emptyVisitModal = (patientId = 0): VisitModalState => ({
  open: false,
  patientId,
  visitDate: localDate(),
  actionNeeded: false,
  comment: '',
});

type UsePatientsParams = {
  handleError: (err: unknown) => void;
  setLoading: (val: boolean) => void;
  setToast: (msg: string | null, timeout?: number) => void;
  confirmAction: (
    message: string,
    action: () => Promise<void> | void,
    opts?: ConfirmActionOptions,
  ) => void;
};

const usePatients = ({ handleError, setLoading, setToast, confirmAction }: UsePatientsParams) => {
  const [patients, setPatients] = useState<PatientWithLatestVisit[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientWithLatestVisit | null>(null);
  const selectedPatientRef = useRef(selectedPatient);
  selectedPatientRef.current = selectedPatient;
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [patientModal, setPatientModal] = useState<PatientModalState>(emptyPatientModal());
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<TeilgruppeFilter>('all');
  const [visitModal, setVisitModal] = useState<VisitModalState>(emptyVisitModal());

  const refreshPatients = useCallback(async () => {
    try {
      const data = await api.patients.list();
      setPatients(data);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const loadVisits = useCallback(
    async (patientId: number) => {
      try {
        const data = await api.patients.listVisits(patientId);
        setVisits(data);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const handleSelectPatient = useCallback(
    async (patient: PatientWithLatestVisit) => {
      setSelectedPatient(patient);
      if (patient.id) {
        await loadVisits(patient.id);
      }
    },
    [loadVisits],
  );

  const handleSavePatient = useCallback(async () => {
    if (!patientModal.name.trim()) {
      handleError(new Error('Name darf nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const { serviceDefinitionIds, serviceScopeSource, ...modalFields } = patientModal;
      const updated = await api.patients.save({
        ...modalFields,
        id: patientModal.id,
        name: patientModal.name,
        birthDate: patientModal.birthDate || null,
        diagnosis: patientModal.diagnosis || null,
        note: patientModal.note || null,
        contact: patientModal.contact || null,
        admissionDate: patientModal.admissionDate || null,
        cognitionImpaired: patientModal.cognitionImpaired,
        mobilityImpaired: patientModal.mobilityImpaired,
        hkpCode: patientModal.hkpCode,
        intensiveCare: patientModal.intensiveCare,
        careLevel: patientModal.careLevel,
        ...(serviceScopeSource === 'legacy' && patientModal.id
          ? { serviceScopeSource: 'legacy' as const }
          : {
              serviceDefinitionIds: serviceDefinitionIds ?? [],
              serviceScopeSource: 'services' as const,
            }),
      });
      setPatients(updated);
      // Update selectedPatient if we edited the currently selected patient
      if (patientModal.mode === 'edit' && patientModal.id) {
        const refreshed = updated.find((p) => p.id === patientModal.id);
        if (refreshed) {
          setSelectedPatient(refreshed);
        }
      }
      setToast('Patient:in gespeichert.');
      setPatientModal(emptyPatientModal());
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  }, [patientModal, handleError, setLoading, setToast]);

  const handleDeletePatient = useCallback(
    async (id: number) => {
      setLoading(true);
      try {
        const updated = await api.patients.delete(id);
        setPatients(updated);
        setSelectedPatient(null);
        setPatientModal(emptyPatientModal());
        setToast('Versorgung beendet; Historie bleibt erhalten.');
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
        setTimeout(() => setToast(null), 2000);
      }
    },
    [handleError, setLoading, setToast],
  );

  const confirmDeletePatient = useCallback(
    (id?: number) => {
      if (!id) return;
      confirmAction(
        'Versorgung beenden und aus der aktiven Personenliste nehmen? Die Historie bleibt erhalten.',
        () => handleDeletePatient(id),
        {
          confirmLabel: 'Versorgung beenden',
          danger: true,
        },
      );
    },
    [confirmAction, handleDeletePatient],
  );

  const handleSaveVisit = useCallback(async () => {
    if (!visitModal.patientId) return;
    setLoading(true);
    try {
      const updatedVisits = await api.patients.saveVisit({
        id: visitModal.id,
        patientId: visitModal.patientId,
        visitDate: visitModal.visitDate,
        actionNeeded: visitModal.actionNeeded,
        comment: visitModal.comment || null,
        resolvedAt: visitModal.resolvedAt ?? null,
        status: visitModal.status,
        assignedTo: visitModal.assignedTo,
        actionDueDate: visitModal.actionDueDate,
      });
      setVisits(updatedVisits);
      // Refresh patients so the list picks up the new latest visit
      const updatedPatients = await api.patients.list();
      setPatients(updatedPatients);
      // Update selected patient if it exists (use ref to avoid dependency)
      if (selectedPatientRef.current?.id === visitModal.patientId) {
        const refreshed = updatedPatients.find((p) => p.id === visitModal.patientId);
        if (refreshed) setSelectedPatient(refreshed);
      }
      setToast('Visite gespeichert.');
      setVisitModal(emptyVisitModal());
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  }, [handleError, setLoading, setToast, visitModal]);

  const handleDeleteVisit = useCallback(
    async (id: number, patientId: number) => {
      setLoading(true);
      try {
        const updatedVisits = await api.patients.deleteVisit(id, patientId);
        setVisits(updatedVisits);
        setVisitModal(emptyVisitModal());
        setToast('Visite geloescht.');
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
        setTimeout(() => setToast(null), 2000);
      }
    },
    [handleError, setLoading, setToast],
  );

  const confirmDeleteVisit = useCallback(
    (id: number, patientId: number) => {
      confirmAction('Visite wirklich loeschen?', () => handleDeleteVisit(id, patientId), {
        confirmLabel: 'Loeschen',
        danger: true,
      });
    },
    [confirmAction, handleDeleteVisit],
  );

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.diagnosis?.toLowerCase().includes(search.toLowerCase()) ?? false);
      // D is an additional mark, so it matches on the HKP code, not the group.
      if (groupFilter === 'archived') return matchesSearch && !isActivePatient(p);
      if (!isActivePatient(p)) return false;
      const matchesGroup =
        groupFilter === 'all'
          ? true
          : groupFilter === 'D'
            ? hasTeilgruppeD(p)
            : !needsAssessment(p) &&
              teilgruppeOf(p.cognitionImpaired, p.mobilityImpaired) === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [patients, search, groupFilter]);

  const openCreatePatientModal = useCallback(() => {
    setPatientModal({ ...emptyPatientModal(), open: true, mode: 'create' });
  }, []);

  const openEditPatientModal = useCallback((patient: PatientWithLatestVisit) => {
    setPatientModal({
      ...patient,
      open: true,
      mode: 'edit',
      id: patient.id,
      name: patient.name,
      birthDate: patient.birthDate ?? '',
      diagnosis: patient.diagnosis ?? '',
      note: patient.note ?? '',
      contact: patient.contact ?? '',
      admissionDate: patient.admissionDate ?? '',
      cognitionImpaired: patient.cognitionImpaired ?? null,
      mobilityImpaired: patient.mobilityImpaired ?? null,
      hkpCode: patient.hkpCode ?? null,
      intensiveCare: patient.intensiveCare ?? null,
      careLevel: patient.careLevel ?? null,
      serviceDefinitionIds: patient.serviceDefinitionIds ?? [],
      serviceScopeSource: patient.serviceScopeSource ?? 'legacy',
    });
  }, []);

  const closePatientModal = useCallback(() => {
    setPatientModal(emptyPatientModal());
  }, []);

  const openVisitModal = useCallback((patientId: number, visit?: PatientVisit) => {
    if (visit) {
      setVisitModal({
        open: true,
        id: visit.id,
        patientId,
        visitDate: visit.visitDate,
        actionNeeded: visit.actionNeeded,
        comment: visit.comment ?? '',
        resolvedAt: visit.resolvedAt ?? null,
        status: visit.status,
        assignedTo: visit.assignedTo,
        actionDueDate: visit.actionDueDate,
      });
    } else {
      setVisitModal({
        open: true,
        patientId,
        visitDate: localDate(),
        actionNeeded: false,
        comment: '',
      });
    }
  }, []);

  const closeVisitModal = useCallback(() => {
    setVisitModal(emptyVisitModal());
  }, []);

  const actions = useMemo(
    () => ({
      refreshPatients,
      loadVisits,
      handleSelectPatient,
      handleSavePatient,
      confirmDeletePatient,
      handleSaveVisit,
      confirmDeleteVisit,
      openCreatePatientModal,
      openEditPatientModal,
      closePatientModal,
      openVisitModal,
      closeVisitModal,
    }),
    [
      refreshPatients,
      loadVisits,
      handleSelectPatient,
      handleSavePatient,
      confirmDeletePatient,
      handleSaveVisit,
      confirmDeleteVisit,
      openCreatePatientModal,
      openEditPatientModal,
      closePatientModal,
      openVisitModal,
      closeVisitModal,
    ],
  );

  return {
    state: {
      patients,
      selectedPatient,
      visits,
      patientModal,
      search,
      groupFilter,
      visitModal,
    },
    setters: {
      setPatients,
      setSelectedPatient,
      setVisits,
      setPatientModal,
      setSearch,
      setGroupFilter,
      setVisitModal,
    },
    derived: {
      filteredPatients,
    },
    actions,
  };
};

export default usePatients;
