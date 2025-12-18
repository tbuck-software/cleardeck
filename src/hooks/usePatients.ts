import { useCallback, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import type { PatientWithLatestVisit, PatientVisit, QprRating } from '../shared/types';
import type { ConfirmActionOptions, PatientModalState, VisitModalState } from '../types/ui';

export const emptyPatientModal = (): PatientModalState => ({
  open: false,
  mode: 'create',
  name: '',
  birthDate: '',
  diagnosis: '',
  qprStatus: '',
  note: '',
});

export const emptyVisitModal = (patientId = 0): VisitModalState => ({
  open: false,
  patientId,
  visitDate: new Date().toISOString().slice(0, 10),
  qprRating: 'A',
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

const usePatients = ({
  handleError,
  setLoading,
  setToast,
  confirmAction,
}: UsePatientsParams) => {
  const [patients, setPatients] = useState<PatientWithLatestVisit[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientWithLatestVisit | null>(null);
  const selectedPatientRef = useRef(selectedPatient);
  selectedPatientRef.current = selectedPatient;
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [patientModal, setPatientModal] = useState<PatientModalState>(emptyPatientModal());
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | QprRating>('all');
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
      const updated = await api.patients.save({
        id: patientModal.id,
        name: patientModal.name,
        birthDate: patientModal.birthDate || null,
        diagnosis: patientModal.diagnosis || null,
        qprStatus: (patientModal.qprStatus as QprRating) || null,
        note: patientModal.note || null,
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
        setToast('Patient:in geloescht.');
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
        'Patient:in und alle Visiten wirklich loeschen?',
        () => handleDeletePatient(id),
        {
          confirmLabel: 'Loeschen',
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
        qprRating: visitModal.qprRating,
        comment: visitModal.comment || null,
      });
      setVisits(updatedVisits);
      // Refresh patients to update latestQprRating
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
      const effectiveRating = p.latestQprRating ?? p.qprStatus;
      const matchesRating = ratingFilter === 'all' ? true : effectiveRating === ratingFilter;
      return matchesSearch && matchesRating;
    });
  }, [patients, search, ratingFilter]);

  const openCreatePatientModal = useCallback(() => {
    setPatientModal({
      open: true,
      mode: 'create',
      name: '',
      birthDate: '',
      diagnosis: '',
      qprStatus: '',
      note: '',
    });
  }, []);

  const openEditPatientModal = useCallback((patient: PatientWithLatestVisit) => {
    setPatientModal({
      open: true,
      mode: 'edit',
      id: patient.id,
      name: patient.name,
      birthDate: patient.birthDate ?? '',
      diagnosis: patient.diagnosis ?? '',
      qprStatus: patient.qprStatus ?? '',
      note: patient.note ?? '',
    });
  }, []);

  const closePatientModal = useCallback(() => {
    setPatientModal(emptyPatientModal());
  }, []);

  const openVisitModal = useCallback(
    (patientId: number, visit?: PatientVisit) => {
      if (visit) {
        setVisitModal({
          open: true,
          id: visit.id,
          patientId,
          visitDate: visit.visitDate,
          qprRating: visit.qprRating,
          comment: visit.comment ?? '',
        });
      } else {
        setVisitModal({
          open: true,
          patientId,
          visitDate: new Date().toISOString().slice(0, 10),
          qprRating: 'A',
          comment: '',
        });
      }
    },
    [],
  );

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
      ratingFilter,
      visitModal,
    },
    setters: {
      setPatients,
      setSelectedPatient,
      setVisits,
      setPatientModal,
      setSearch,
      setRatingFilter,
      setVisitModal,
    },
    derived: {
      filteredPatients,
    },
    actions,
  };
};

export default usePatients;
