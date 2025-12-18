import { useCallback, useMemo, useState } from 'react';
import api from '../services/api';
import type { PatientWithLatestVisit, PatientVisit, QprRating } from '../shared/types';
import type { ConfirmActionOptions, PatientFormState, Page, VisitModalState } from '../types/ui';

export const emptyPatientForm = (): PatientFormState => ({
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
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [form, setForm] = useState<PatientFormState>(emptyPatientForm());
  const [page, setPage] = useState<Page>('patients');
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
      setForm({
        id: patient.id,
        name: patient.name,
        birthDate: patient.birthDate ?? '',
        diagnosis: patient.diagnosis ?? '',
        qprStatus: patient.qprStatus ?? '',
        note: patient.note ?? '',
      });
      if (patient.id) {
        await loadVisits(patient.id);
      }
      setPage('patient-view');
    },
    [loadVisits],
  );

  const handleSavePatient = useCallback(async () => {
    if (!form.name.trim()) {
      handleError(new Error('Name darf nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const updated = await api.patients.save({
        id: form.id,
        name: form.name,
        birthDate: form.birthDate || null,
        diagnosis: form.diagnosis || null,
        qprStatus: (form.qprStatus as QprRating) || null,
        note: form.note || null,
      });
      setPatients(updated);
      setToast('Patient:in gespeichert.');
      setPage('patients');
      setForm(emptyPatientForm());
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  }, [form, handleError, setLoading, setToast]);

  const handleDeletePatient = useCallback(
    async (id: number) => {
      setLoading(true);
      try {
        const updated = await api.patients.delete(id);
        setPatients(updated);
        setSelectedPatient(null);
        setForm(emptyPatientForm());
        setPage('patients');
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
      // Update selected patient if it exists
      if (selectedPatient?.id === visitModal.patientId) {
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
  }, [handleError, selectedPatient, setLoading, setToast, visitModal]);

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

  const goToPatients = useCallback(
    (target: Page) => {
      if (target === 'patient-new') {
        setForm(emptyPatientForm());
        setSelectedPatient(null);
      }
      if (target === 'patient-edit' && !form.id) {
        return;
      }
      if (target === 'patient-view' && !selectedPatient) return;
      setPage(target);
    },
    [form.id, selectedPatient],
  );

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
      goToPatients,
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
      goToPatients,
      openVisitModal,
      closeVisitModal,
    ],
  );

  return {
    state: {
      patients,
      selectedPatient,
      visits,
      form,
      page,
      search,
      ratingFilter,
      visitModal,
    },
    setters: {
      setPatients,
      setSelectedPatient,
      setVisits,
      setForm,
      setPage,
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
