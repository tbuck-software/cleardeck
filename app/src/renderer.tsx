import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faDownload,
  faCalendarDays,
  faTrash,
  faTriangleExclamation,
  faGaugeHigh,
  faUsers,
  faGear,
  faPen,
} from '@fortawesome/free-solid-svg-icons';
import { createRoot } from 'react-dom/client';
import './index.css';
import type { EmploymentPeriod, EmployeeWithPeriod, QualificationType, YearDataset } from './shared/types';

type FormState = {
  id?: number;
  periodId?: number;
  name: string;
  qualification: string;
  dataSource: string;
  note: string;
  startDate: string;
  endDate: string;
  fte: number;
};

type Page = 'dashboard' | 'list' | 'new' | 'edit' | 'settings' | 'view';

const statusLabels: Record<EmployeeWithPeriod['status'], string> = {
  active: 'aktiv',
  new: 'Neueintritt',
  left: 'ausgeschieden',
};

const emptyForm = (year: number, defaultQualification = ''): FormState => ({
  name: '',
  qualification: defaultQualification,
  dataSource: '',
  note: '',
  startDate: `${year}-01-01`,
  endDate: '',
  fte: 1,
});

const StatCard = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) => (
  <div className="card stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

const Badge = ({ status }: { status: EmployeeWithPeriod['status'] }) => (
  <span className={`badge badge-${status}`}>{statusLabels[status]}</span>
);

const Sidebar = ({
  current,
  onNavigate,
}: {
  current: Page;
  onNavigate: (page: Page) => void;
}) => {
  const navItems: { key: Page; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: faGaugeHigh },
    { key: 'list', label: 'Mitarbeitende', icon: faUsers },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">DB</div>
        <div>
          <div className="brand-title">Employee DB</div>
          <div className="brand-sub">VZAE & Historie</div>
        </div>
      </div>
      <nav className="nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${current === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <FontAwesomeIcon icon={item.icon} /> {item.label}
          </button>
        ))}
      </nav>
      <div className="nav-footer">
        <button
          className={`nav-item ${current === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <FontAwesomeIcon icon={faGear} /> Einstellungen
        </button>
        <div className="nav-hint">Links: Seiten, rechts: Jahr/Export</div>
      </div>
    </aside>
  );
};

const Table = ({
  employees,
  onSelect,
  onDelete,
  selectedId,
}: {
  employees: EmployeeWithPeriod[];
  onSelect: (emp: EmployeeWithPeriod) => void;
  onDelete: (id: number) => void;
  selectedId?: number;
}) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Qualifikation</th>
          <th>Start</th>
          <th>Ende</th>
          <th>
            <abbr className="help" title={fteHelp}>
              FTE/VZÄ
            </abbr>
          </th>
          <th>Status</th>
          <th>Quelle</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody>
        {employees.length === 0 && (
          <tr>
            <td colSpan={9} className="empty">
              Keine Einträge im ausgewählten Jahr.
            </td>
          </tr>
        )}
        {employees.map((emp) => (
          <tr
            key={`${emp.id}-${emp.periodId}`}
            onClick={() => onSelect(emp)}
            className={selectedId === emp.id ? 'selected' : undefined}
          >
            <td>{emp.name}</td>
            <td>{emp.qualification}</td>
            <td>{emp.startDate}</td>
            <td>{emp.endDate ?? '—'}</td>
            <td>{emp.fte.toFixed(2)}</td>
            <td>
              <Badge status={emp.status} />
            </td>
            <td>{emp.dataSource ?? '—'}</td>
            <td>
              <button
                className="ghost-button danger icon-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(emp.id ?? 0);
                }}
                title="Löschen"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const HistoryList = ({ items }: { items: EmploymentPeriod[] }) => (
  <div className="history">
    <div className="history-header">
      <span>Historie</span>
      <small>Stellenanteil pro Zeitraum</small>
    </div>
    {items.length === 0 && <div className="history-empty">Keine Historie hinterlegt.</div>}
    {items.map((item) => (
      <div className="history-row" key={item.id ?? `${item.startDate}-${item.endDate}`}>
        <div>
          <div className="history-title">
            {item.startDate} – {item.endDate ?? 'aktuell'}
          </div>
          <div className="history-meta">
            FTE/VZÄ: {item.fte} · Quali: {item.qualification ?? '—'}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const YearSelector = ({
  year,
  onChange,
  currentYear,
}: {
  year: number;
  onChange: (y: number) => void;
  currentYear: number;
}) => (
  <div className="year-selector">
    <FontAwesomeIcon icon={faCalendarDays} />
    <input
      type="number"
      value={year}
      onChange={(e) => onChange(Number(e.target.value))}
      min={2000}
      max={2099}
    />
    <button className="ghost-button" onClick={() => onChange(currentYear)}>
      aktuelles Jahr
    </button>
  </div>
);

const fteHelp =
  'FTE (Full Time Equivalent) entspricht VZÄ (Vollzeitäquivalent). 1,0 = Vollzeit, 0,5 = halbe Stelle.';

const AuthScreen = ({
  mode,
  onSubmit,
  busy,
  message,
}: {
  mode: 'setup' | 'login';
  onSubmit: (password: string) => Promise<void>;
  busy: boolean;
  message?: string | null;
}) => {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError(null);
    if (mode === 'setup' && password !== repeat) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    await onSubmit(password);
    setPassword('');
    setRepeat('');
  };

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-title">
          <h1>{mode === 'setup' ? 'Ersteinrichtung' : 'Anmeldung'}</h1>
          <p>
            Lokale Datenbank (SQLite) mit Dateiverschlüsselung und Passwortschutz. Halte das Passwort
            sicher bereit; es wird nicht synchronisiert.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Passwort
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>
          {mode === 'setup' && (
            <label>
              Passwort wiederholen
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
                placeholder="••••••••"
              />
            </label>
          )}
          {error && <div className="error">{error}</div>}
          {message && <div className="info">{message}</div>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Bitte warten…' : mode === 'setup' ? 'Passwort setzen' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [dataset, setDataset] = useState<YearDataset | null>(null);
  const [qualifications, setQualifications] = useState<QualificationType[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm(currentYear));
  const [periods, setPeriods] = useState<EmploymentPeriod[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithPeriod | null>(null);
  const [appReady, setAppReady] = useState<{ configured: boolean; unlocked: boolean }>({
    configured: false,
    unlocked: false,
  });
  const [page, setPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeWithPeriod['status']>('all');
  const [addNewPeriod, setAddNewPeriod] = useState(false);
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [qualificationEdits, setQualificationEdits] = useState<Record<number, string>>({});
  const [qualificationModal, setQualificationModal] = useState<{ open: boolean; id?: number; value: string }>({
    open: false,
    value: '',
  });
  const [dragQualificationId, setDragQualificationId] = useState<number | null>(null);
  const [editModal, setEditModal] = useState<{ open: boolean; name: string; note: string }>({
    open: false,
    name: '',
    note: '',
  });
  const [addPeriodForm, setAddPeriodForm] = useState<{
    startDate: string;
    endDate: string;
    fte: number;
    qualification: string;
    periodId?: number;
  }>({
    startDate: `${currentYear}-01-01`,
    endDate: '',
    fte: 1,
    qualification: '',
  });
  const [periodToDelete, setPeriodToDelete] = useState<{ periodId: number; label: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
    confirmLabel?: string;
    danger?: boolean;
  } | null>(null);

  const handleError = (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    setError(message);
    setTimeout(() => setError(null), 3500);
  };

  const refreshDataset = async (targetYear: number) => {
    setLoading(true);
    try {
      const data = await window.api.listEmployees(targetYear);
      setDataset(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const bootstrap = async () => {
    try {
      const state = await window.api.getAppState();
      setAppReady(state);
      if (state.unlocked) {
        const qualis = await window.api.listQualifications();
        setQualifications(qualis);
        const edits: Record<number, string> = {};
        qualis.forEach((q) => {
          if (q.id) edits[q.id] = q.name;
        });
        setQualificationEdits(edits);
        setForm((prev) => ({ ...prev, qualification: qualis[0]?.name ?? prev.qualification }));
        await refreshDataset(year);
      }
    } catch (err) {
      handleError(err);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (appReady.unlocked) {
      refreshDataset(year);
    }
  }, [year, appReady.unlocked]);

  useEffect(() => {
    if (appReady.unlocked) {
      window.api
        .listQualifications()
        .then((list) => {
          setQualifications(list);
          const edits: Record<number, string> = {};
          list.forEach((q) => {
            if (q.id) edits[q.id] = q.name;
          });
          setQualificationEdits(edits);
          if (!form.qualification) {
            setForm((prev) => ({ ...prev, qualification: list[0]?.name ?? '' }));
            setAddPeriodForm((prev) => ({ ...prev, qualification: list[0]?.name ?? '' }));
          }
        })
        .catch(handleError);
    }
  }, [appReady.unlocked]);

  const handleLogin = async (password: string, mode: 'setup' | 'login') => {
    try {
      setLoading(true);
      const state =
        mode === 'setup' ? await window.api.register(password) : await window.api.login(password);
      setAppReady(state);
      if (state.unlocked) {
        await refreshDataset(year);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (emp: EmployeeWithPeriod) => {
    setSelectedEmployee(emp);
    setEditModal({ open: false, name: emp.name, note: emp.note ?? '' });
    setPage('view');
    setForm({
      id: emp.id,
      periodId: emp.periodId,
      name: emp.name,
      qualification: emp.qualification,
      dataSource: emp.dataSource ?? '',
      note: emp.note ?? '',
      startDate: emp.startDate,
      endDate: emp.endDate ?? '',
      fte: emp.fte,
    });
    setAddNewPeriod(false);
    try {
      const history = await window.api.listPeriods(emp.id ?? 0);
      setPeriods(history);
      setAddPeriodForm((prev) => ({
        ...prev,
        startDate: history[0]?.startDate ?? `${year}-01-01`,
        endDate: '',
        fte: 1,
        qualification: qualifications[0]?.name ?? emp.qualification,
        periodId: undefined,
      }));
    } catch (err) {
      handleError(err);
    }
  };

  const resetForm = () => {
    setForm(emptyForm(year, qualifications[0]?.name ?? ''));
    setPeriods([]);
    setAddNewPeriod(false);
  };

  const goTo = (target: Page) => {
    if (target === 'new') {
      resetForm();
    }
    if (target === 'edit' && !form.id) {
      return;
    }
    if (target === 'qualifications') {
      refreshQualifications();
    }
    if (target === 'view' && !selectedEmployee) return;
    setPage(target);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      handleError(new Error('Name darf nicht leer sein.'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        periodId: addNewPeriod ? undefined : form.periodId,
        endDate: form.endDate ? form.endDate : null,
        fte: Number(form.fte) || 0,
        year,
      };
      const updated = await window.api.saveEmployee(payload);
      setDataset(updated);
      setToast('Gespeichert.');
      setPage('list');
      resetForm();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const deleteEmployee = async (id: number) => {
    setLoading(true);
    try {
      const updated = await window.api.deleteEmployee(id, year);
      setDataset(updated);
      resetForm();
      setPage('list');
      setToast('Gelöscht.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const result = await window.api.exportData(year, format);
      if (result.saved) {
        setToast(`Export gespeichert: ${result.filePath}`);
        setTimeout(() => setToast(null), 2800);
      } else if (result.error) {
        handleError(new Error(result.error));
      }
    } catch (err) {
      handleError(err);
    }
  };

  const refreshQualifications = async () => {
    try {
      const list = await window.api.listQualifications();
      setQualifications(list);
      const edits: Record<number, string> = {};
      list.forEach((q) => {
        if (q.id) edits[q.id] = q.name;
      });
      setQualificationEdits(edits);
      if (!form.qualification && list.length > 0) {
        setForm((prev) => ({ ...prev, qualification: list[0].name }));
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleSaveQualificationModal = async () => {
    const val = qualificationModal.value.trim();
    if (!val) return;
    try {
      let list: QualificationType[] = qualifications;
      if (qualificationModal.id) {
        list = await window.api.updateQualification(qualificationModal.id, val);
      } else {
        list = await window.api.addQualification(val);
      }
      setQualifications(list);
      const edits: Record<number, string> = {};
      list.forEach((q) => {
        if (q.id) edits[q.id] = q.name;
      });
      setQualificationEdits(edits);
      setQualificationModal({ open: false, value: '' });
      setToast('Qualifikation gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteQualification = async (id: number) => {
    confirmAction(
      'Qualifikation wirklich löschen?',
      async () => {
        try {
          const list = await window.api.deleteQualification(id);
          setQualifications(list);
          setQualificationEdits({});
          setToast('Qualifikation gelöscht.');
          setTimeout(() => setToast(null), 2000);
        } catch (err) {
          handleError(err);
        }
      },
      { confirmLabel: 'Löschen', danger: true },
    );
  };

  const confirmAction = (
    message: string,
    action: () => Promise<void> | void,
    opts?: { confirmLabel?: string; danger?: boolean },
  ) => {
    setConfirmState({ message, onConfirm: action, confirmLabel: opts?.confirmLabel, danger: opts?.danger });
  };

  const confirmDeleteEmployee = (id?: number) => {
    if (!id) return;
    confirmAction('Mitarbeiter:in und Historie wirklich löschen?', () => deleteEmployee(id), {
      confirmLabel: 'Löschen',
      danger: true,
    });
  };

  const confirmDeleteQualification = (id: number) => {
    confirmAction('Qualifikation wirklich löschen?', () => handleDeleteQualification(id), {
      confirmLabel: 'Löschen',
      danger: true,
    });
  };

  const reorderQualification = async (orderedIds: number[]) => {
    try {
      const list = await window.api.reorderQualifications(orderedIds);
      setQualifications(list);
      const edits: Record<number, string> = {};
      list.forEach((q) => {
        if (q.id) edits[q.id] = q.name;
      });
      setQualificationEdits(edits);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDbExport = async (mode: 'encrypted' | 'plain') => {
    setDbMessage(null);
    try {
      const result = await window.api.exportDatabase(mode);
      if (result.saved) {
        setDbMessage(`Export gespeichert unter: ${result.filePath}`);
      } else if (result.error) {
        setDbMessage(`Export fehlgeschlagen: ${result.error}`);
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleDbImport = async (mode: 'encrypted' | 'plain') => {
    confirmAction(
      'Import ersetzt die aktuelle Datenbank. Es wird vorher ein Backup erstellt. Fortfahren?',
      async () => {
        try {
          const result = await window.api.importDatabase(mode);
          if (result.imported) {
            await refreshDataset(year);
            const info = result.backupPath
              ? `Import erfolgreich. Backup unter: ${result.backupPath}`
              : 'Import erfolgreich.';
            setToast(info);
          } else if (result.error) {
            setError(`Import fehlgeschlagen: ${result.error}`);
          }
        } catch (err) {
          handleError(err);
        }
      },
      { confirmLabel: 'Importieren', danger: true },
    );
  };

  const handleAddPeriod = async () => {
    if (!selectedEmployee) return;
    if (!addPeriodForm.qualification || !addPeriodForm.startDate) return;
    setLoading(true);
    try {
      const payload = {
        id: selectedEmployee.id,
        name: selectedEmployee.name,
        qualification: addPeriodForm.qualification,
        dataSource: selectedEmployee.dataSource ?? '',
        note: selectedEmployee.note ?? '',
        startDate: addPeriodForm.startDate,
        endDate: addPeriodForm.endDate || null,
        fte: Number(addPeriodForm.fte) || 0,
        periodId: addPeriodForm.periodId,
        year,
      };
      const updated = await window.api.saveEmployee(payload);
      setDataset(updated);
      const history = await window.api.listPeriods(selectedEmployee.id ?? 0);
      setPeriods(history);
      setToast(addPeriodForm.periodId ? 'Periode aktualisiert.' : 'Qualifikation/Periode hinzugefügt.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setShowAddPeriodModal(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    setLoading(true);
    try {
      const updated = await window.api.deletePeriod(periodToDelete.periodId, year);
      setDataset(updated);
      if (selectedEmployee?.id) {
        const history = await window.api.listPeriods(selectedEmployee.id);
        setPeriods(history);
      }
      setToast('Periode gelöscht.');
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
      setPeriodToDelete(null);
      setShowAddPeriodModal(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!dataset) return [];
    return dataset.employees.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.qualification.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : emp.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [dataset, search, statusFilter]);

  const statusCounts = useMemo(
    () =>
      (dataset?.employees ?? []).reduce(
        (acc, emp) => {
          acc[emp.status] += 1;
          return acc;
        },
        { active: 0, new: 0, left: 0 } as Record<EmployeeWithPeriod['status'], number>,
      ),
    [dataset],
  );

  const pageTitle: Record<Page, string> = {
    dashboard: 'Dashboard',
    list: 'Mitarbeitende',
    new: 'Neu anlegen',
    edit: 'Bearbeiten',
    settings: 'Einstellungen',
    view: 'Details',
  };

  const pageSubtitle: Record<Page, string> = {
    dashboard: 'Kennzahlen und Aggregationen zum gewählten Jahr.',
    list: 'Liste mit Filter/Status und Doppelklick zum Bearbeiten.',
    new: 'Neue Person mit Historieneintrag erfassen.',
    edit: form.id ? `Bearbeitung: ${form.name}` : 'Bitte Eintrag aus Liste wählen.',
    settings: 'Datenbank austauschen oder Export/Import (verschlüsselt/unkryptiert).',
    view: selectedEmployee ? `Status: ${selectedEmployee.status}` : '',
  };

  const crumbs = (): { label: string; page?: Page }[] => {
    if (page === 'dashboard') return [{ label: 'Dashboard' }];
    if (page === 'list') return [{ label: 'Dashboard', page: 'dashboard' }, { label: 'Mitarbeitende' }];
    if (page === 'new')
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Mitarbeitende', page: 'list' },
        { label: 'Neu anlegen' },
      ];
    if (page === 'settings')
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Einstellungen' },
      ];
    if (page === 'view' && selectedEmployee)
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Mitarbeitende', page: 'list' },
        { label: selectedEmployee.name },
      ];
    return [
      { label: 'Dashboard', page: 'dashboard' },
      { label: 'Mitarbeitende', page: 'list' },
      { label: 'Bearbeiten' },
    ];
  };

  if (!appReady.configured) {
    return (
      <AuthScreen
        mode="setup"
        onSubmit={(pwd) => handleLogin(pwd, 'setup')}
        busy={loading}
        message="Neues Passwort legt auch den lokalen Schlüssel an."
      />
    );
  }

  if (!appReady.unlocked) {
    return <AuthScreen mode="login" onSubmit={(pwd) => handleLogin(pwd, 'login')} busy={loading} />;
  }

  return (
    <div className="layout">
      <Sidebar current={page} onNavigate={goTo} />
      <div className="main">
        <header className="topbar">
          <div>
            <div className="breadcrumbs">
              {crumbs().map((c, idx) => (
                <span key={`${c.label}-${idx}`}>
                  {c.page ? (
                    <button className="crumb-link" onClick={() => goTo(c.page!)}>
                      {c.label}
                    </button>
                  ) : (
                    <span className="crumb-current">{c.label}</span>
                  )}
                  {idx < crumbs().length - 1 && <span className="crumb-sep">/</span>}
                </span>
              ))}
            </div>
            <p className="eyebrow">Mitarbeiter & VZÄ</p>
            <h1>{pageTitle[page]}</h1>
            <p className="subtitle">{pageSubtitle[page]}</p>
          </div>
          {page !== 'settings' && (
            <div className="controls">
              <YearSelector year={year} onChange={setYear} currentYear={currentYear} />
            </div>
          )}
        </header>

        {page === 'dashboard' && (
          <div className="grid two-columns">
            <section>
              <div className="grid stats-grid">
                <StatCard
                  label="Gesamt VZÄ"
                  value={`${dataset?.aggregation.totalFte.toFixed(2) ?? '0.00'}`}
                  sub="Summe aller Stellenanteile im Jahr"
                />
                <StatCard
                  label="Mitarbeitende"
                  value={`${dataset?.aggregation.totalHeadcount ?? 0}`}
                  sub="alle Kategorien"
                />
                <StatCard
                  label="Kategorien"
                  value={`${dataset?.aggregation.categories.length ?? 0}`}
                  sub="nach Qualifikation"
                />
              </div>

              <div className="card aggregation">
                <h3>
                  <abbr className="help" title={fteHelp}>
                    VZÄ je Qualifikation
                  </abbr>
                </h3>
                <div className="aggregation-grid">
                  {(dataset?.aggregation.categories ?? []).map((cat) => (
                    <div className="agg-row" key={cat.qualification}>
                      <div>
                        <div className="agg-title">{cat.qualification}</div>
                        <div className="agg-sub">{cat.headcount} Personen</div>
                      </div>
                      <div className="agg-value">{cat.fte.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">Status im Jahr</p>
                  <h3>Aktivität</h3>
                </div>
                <button className="ghost-button" onClick={() => goTo('list')}>
                  Zur Liste
                </button>
              </div>
              <div className="status-grid">
                <div className="status-tile">
                  <span>Aktiv</span>
                  <strong>{statusCounts.active}</strong>
                </div>
                <div className="status-tile">
                  <span>Neueintritte</span>
                  <strong>{statusCounts.new}</strong>
                </div>
                <div className="status-tile">
                  <span>Ausgeschieden</span>
                  <strong>{statusCounts.left}</strong>
                </div>
              </div>
              <p className="subtitle small">
                Klicke auf „Zur Liste“ für Detailansicht oder nutze die Navigation links.
              </p>
            </aside>
          </div>
        )}

        {page === 'view' && selectedEmployee && (
          <div className="stack">
            <div className="card detail-header">
              <div className="detail-main">
                <div
                  className="detail-name"
                  onClick={() =>
                    setEditModal({ open: true, name: selectedEmployee.name, note: selectedEmployee.note ?? '' })
                  }
                  title="Name und Notiz bearbeiten"
                >
                  <h2 className="clickable-text">{selectedEmployee.name}</h2>
                  <div className="note-inline clickable-text">
                    {selectedEmployee.note && selectedEmployee.note.trim().length > 0 ? (
                      <span className="note-text-inline">{selectedEmployee.note}</span>
                    ) : (
                      <span className="muted">Notiz hinzufügen</span>
                    )}
                  </div>
                </div>
                <div className="detail-meta">
                  <span className="pill">{selectedEmployee.qualification}</span>
                  <span className="pill">
                    <abbr className="help" title={fteHelp}>
                      FTE/VZÄ
                    </abbr>{' '}
                    {selectedEmployee.fte.toFixed(2)}
                  </span>
                  <span className={`badge badge-${selectedEmployee.status}`}>{statusLabels[selectedEmployee.status]}</span>
                  <span className="muted">
                    {selectedEmployee.startDate} – {selectedEmployee.endDate ?? 'aktuell'}
                  </span>
                </div>
              </div>
              <div className="detail-actions">
                <button className="primary" onClick={() => setShowAddPeriodModal(true)}>
                  <FontAwesomeIcon icon={faPlus} /> Qualifikation hinzufügen
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Historie</h3>
              <div className="timeline">
                {periods.map((p) => (
                  <button
                    className="timeline-item"
                    key={p.id ?? `${p.startDate}-${p.endDate}`}
                    onClick={() => {
                      setAddPeriodForm({
                        startDate: p.startDate,
                        endDate: p.endDate ?? '',
                        fte: p.fte,
                        qualification: p.qualification ?? selectedEmployee.qualification,
                        periodId: p.id,
                      });
                      setShowAddPeriodModal(true);
                    }}
                  >
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-title">
                        {p.startDate} – {p.endDate ?? 'aktuell'}
                      </div>
                      <div className="timeline-meta">
                        <span className="pill">{p.qualification ?? selectedEmployee.qualification}</span>
                        <span className="pill">FTE/VZÄ {p.fte}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {periods.length === 0 && <div className="empty">Keine Historie vorhanden.</div>}
              </div>
            </div>

          </div>
        )}

        {page === 'list' && (
          <div className="stack">
            <div className="card list-toolbar">
              <div className="filters">
                <input
                  type="search"
                  placeholder="Suchen (Name oder Qualifikation)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                  <option value="all">Status: alle</option>
                  <option value="active">aktiv</option>
                  <option value="new">Neueintritt</option>
                  <option value="left">ausgeschieden</option>
                </select>
              </div>
              <div className="toolbar-actions">
                <button className="ghost-button" onClick={() => handleExport('csv')}>
                  <FontAwesomeIcon icon={faDownload} /> CSV
                </button>
                <button className="ghost-button" onClick={() => handleExport('xlsx')}>
                  <FontAwesomeIcon icon={faDownload} /> Excel
                </button>
                <button className="primary" onClick={() => goTo('new')}>
                  <FontAwesomeIcon icon={faPlus} /> Neu anlegen
                </button>
              </div>
            </div>
            <Table
              employees={filteredEmployees}
              onSelect={handleSelect}
              selectedId={form.id}
              onDelete={confirmDeleteEmployee}
            />
            {form.id && (
              <div className="list-actions">
                <button className="ghost-button danger" onClick={() => confirmDeleteEmployee(form.id)}>
                  <FontAwesomeIcon icon={faTrash} /> Löschen
                </button>
              </div>
            )}
          </div>
        )}

        {page === 'settings' && (
          <div className="stack">
            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">Qualifikationen</p>
                  <h3>Typen verwalten</h3>
                </div>
                <button
                  className="primary"
                  onClick={() => setQualificationModal({ open: true, value: '', id: undefined })}
                >
                  <FontAwesomeIcon icon={faPlus} /> Neu
                </button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th style={{ width: 80 }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualifications.map((q) => (
                      <tr
                        key={q.id ?? q.name}
                        className="clickable-row"
                        draggable={!!q.id}
                        onDragStart={() => setDragQualificationId(q.id ?? null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!dragQualificationId || !q.id || dragQualificationId === q.id) return;
                          const orderedIds = qualifications.map((item) => item.id!).filter(Boolean);
                          const from = orderedIds.indexOf(dragQualificationId);
                          const to = orderedIds.indexOf(q.id);
                          if (from === -1 || to === -1) return;
                          const reordered = [...orderedIds];
                          const [moved] = reordered.splice(from, 1);
                          reordered.splice(to, 0, moved);
                          reorderQualification(reordered);
                        }}
                        onClick={() =>
                          q.id &&
                          setQualificationModal({
                            open: true,
                            id: q.id as number,
                            value: qualificationEdits[q.id as number] ?? q.name,
                          })
                        }
                      >
                        <td>{q.name}</td>
                        <td>
                          {q.id && (
                            <button
                              className="ghost-button danger icon-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDeleteQualification(q.id as number);
                              }}
                              title="Löschen"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {qualifications.length === 0 && (
                      <tr>
                        <td colSpan={2} className="empty">
                          Keine Qualifikationen hinterlegt.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">Datenbank</p>
                  <h3>Import / Export</h3>
                </div>
              </div>
              <div className="form-grid">
                <label className="full-width">Export</label>
                <div className="inline-row">
                  <button className="ghost-button" onClick={() => handleDbExport('plain')}>
                    Unverschlüsselt exportieren (SQLite)
                  </button>
                  <button className="ghost-button" onClick={() => handleDbExport('encrypted')}>
                    Verschlüsselt exportieren (.enc)
                  </button>
                </div>
                <label className="full-width">Import</label>
                <div className="inline-row">
                  <button className="ghost-button" onClick={() => handleDbImport('plain')}>
                    Unverschlüsselt importieren (SQLite)
                  </button>
                  <button className="ghost-button" onClick={() => handleDbImport('encrypted')}>
                    Verschlüsselt importieren (.enc)
                  </button>
                </div>
                <p className="subtitle small">
                  Import ersetzt die lokale Datenbank. Verschlüsselte Importe erwarten das aktuelle App-Passwort /
                  den geladenen Schlüssel.
                </p>
              </div>
            </div>

          </div>
        )}

        {(page === 'new' || page === 'edit') && (
          <div className="grid form-layout">
            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">Erfassen / Bearbeiten</p>
                  <h3>{page === 'edit' ? 'Datensatz aktualisieren' : 'Neue Person'}</h3>
                </div>
                <div className="form-actions">
                  {page === 'edit' && form.id && (
                    <button className="ghost-button danger" onClick={() => confirmDeleteEmployee(form.id)}>
                      <FontAwesomeIcon icon={faTrash} /> Löschen
                    </button>
                  )}
                  <button className="ghost-button" onClick={resetForm}>
                    Zurücksetzen
                  </button>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Name*
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Vor- und Nachname"
                  />
                </label>
                <label>
                  Qualifikation
                  <select
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  >
                    {qualifications.map((q) => (
                      <option key={q.id ?? q.name} value={q.name}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quelle / Herkunft
                  <input
                    value={form.dataSource}
                    onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
                    placeholder="Verwaltungssoftware, NAS, ..."
                  />
                </label>
                <label>
                  Start
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  Ende
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
                <label>
                  <abbr className="help" title={fteHelp}>
                    FTE / VZÄ
                  </abbr>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.fte}
                    onChange={(e) => setForm({ ...form, fte: Number(e.target.value) })}
                  />
                </label>
                <label className="full-width">
                  Notiz / Bemerkung
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Fortbildungen, Besonderheiten, Ansprechpartner"
                  />
                </label>
                {page === 'edit' && form.id && (
                  <label className="full-width checkbox">
                    <input
                      type="checkbox"
                      checked={addNewPeriod}
                      onChange={(e) => setAddNewPeriod(e.target.checked)}
                    />
                    Neue Historienperiode anlegen (bestehende Einträge bleiben erhalten)
                  </label>
                )}
              </div>

              <div className="form-actions">
                <button className="primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>

            {page === 'edit' && <HistoryList items={periods} />}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {error && <div className="toast error-toast">{error}</div>}
      {loading && <div className="loading">Lade / speichere …</div>}
      {confirmState && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon danger">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h3>Bist du sicher?</h3>
            <p className="modal-text">{confirmState.message}</p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setConfirmState(null)}>
                Abbrechen
              </button>
              <button
                className={`ghost-button ${confirmState.danger ? 'danger' : ''}`}
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
              >
                {confirmState.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddPeriodModal && selectedEmployee && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={faPlus} />
            </div>
            <h3>{addPeriodForm.periodId ? 'Periode bearbeiten' : 'Qualifikation / Periode hinzufügen'}</h3>
            <div className="form-grid">
              <label>
                Start
                <input
                  type="date"
                  value={addPeriodForm.startDate}
                  onChange={(e) => setAddPeriodForm({ ...addPeriodForm, startDate: e.target.value })}
                />
              </label>
              <label>
                Ende
                <input
                  type="date"
                  value={addPeriodForm.endDate}
                  onChange={(e) => setAddPeriodForm({ ...addPeriodForm, endDate: e.target.value })}
                />
              </label>
              <label>
                Qualifikation
                <select
                  value={addPeriodForm.qualification}
                  onChange={(e) => setAddPeriodForm({ ...addPeriodForm, qualification: e.target.value })}
                >
                  {qualifications.map((q) => (
                    <option key={q.id ?? q.name} value={q.name}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <abbr className="help" title={fteHelp}>
                  FTE / VZÄ
                </abbr>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={addPeriodForm.fte}
                  onChange={(e) => setAddPeriodForm({ ...addPeriodForm, fte: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <div>
                {addPeriodForm.periodId && (
                  <button
                    className="ghost-button danger icon-button"
                    onClick={() =>
                      setPeriodToDelete({
                        periodId: addPeriodForm.periodId as number,
                        label: `${addPeriodForm.startDate} – ${addPeriodForm.endDate || 'aktuell'}`,
                      })
                    }
                    title="Löschen"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
              <div className="inline-row compact">
                <button className="ghost-button" onClick={() => setShowAddPeriodModal(false)}>
                  Abbrechen
                </button>
                <button className="primary" onClick={handleAddPeriod}>
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {periodToDelete && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon danger">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h3>Periode löschen?</h3>
            <p className="modal-text">
              {periodToDelete.label}
              <br />
              Wird endgültig entfernt.
            </p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setPeriodToDelete(null)}>
                Abbrechen
              </button>
              <button className="ghost-button danger" onClick={handleDeletePeriod}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
      {qualificationModal.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={qualificationModal.id ? faPen : faPlus} />
            </div>
            <h3>{qualificationModal.id ? 'Qualifikation bearbeiten' : 'Neue Qualifikation'}</h3>
            <div className="form-grid">
              <label className="full-width">
                Bezeichnung
                <input
                  value={qualificationModal.value}
                  onChange={(e) => setQualificationModal({ ...qualificationModal, value: e.target.value })}
                  placeholder="z. B. 3-jährig examiniert"
                />
              </label>
            </div>
            <div className="modal-actions">
              <div></div>
              <div className="inline-row compact">
                <button className="ghost-button" onClick={() => setQualificationModal({ open: false, value: '' })}>
                  Abbrechen
                </button>
                <button className="primary" onClick={handleSaveQualificationModal}>
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editModal.open && selectedEmployee && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h3>Name & Notiz bearbeiten</h3>
            <div className="form-grid">
              <label className="full-width">
                Name
                <input
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                />
              </label>
              <label className="full-width">
                Notiz
                <textarea
                  value={editModal.note}
                  onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                  placeholder="Fortbildungen, Besonderheiten, Ansprechpartner"
                />
              </label>
            </div>
            <div className="modal-actions">
              <div></div>
              <div className="inline-row compact">
                <button className="ghost-button" onClick={() => setEditModal({ open: false, name: '', note: '' })}>
                  Abbrechen
                </button>
                <button
                  className="primary"
                  onClick={async () => {
                    if (!selectedEmployee) return;
                    setLoading(true);
                    try {
                      const payload = {
                        ...form,
                        name: editModal.name,
                        note: editModal.note,
                        periodId: form.periodId,
                        endDate: form.endDate ? form.endDate : null,
                        fte: Number(form.fte) || 0,
                        year,
                      };
                      const updated = await window.api.saveEmployee(payload);
                      setDataset(updated);
                      setSelectedEmployee({
                        ...selectedEmployee,
                        name: payload.name,
                        note: payload.note,
                      });
                      setForm((prev) => ({
                        ...prev,
                        name: payload.name,
                        note: payload.note,
                      }));
                      setToast('Gespeichert.');
                    } catch (err) {
                      handleError(err);
                    } finally {
                      setLoading(false);
                      setEditModal({ open: false, name: '', note: '' });
                      setTimeout(() => setToast(null), 2000);
                    }
                  }}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
