import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faDownload, faCalendarDays, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
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
  documentPath: string;
  startDate: string;
  endDate: string;
  fte: number;
};

type Page = 'dashboard' | 'list' | 'new' | 'edit' | 'qualifications';

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
  documentPath: '',
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
  const navItems: { key: Page; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'list', label: 'Mitarbeitende' },
    { key: 'qualifications', label: 'Qualifikationen' },
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
              {item.label}
            </button>
          ))}
        </nav>
      <div className="nav-hint">Links: Seiten, rechts: Jahr/Export</div>
    </aside>
  );
};

const Table = ({
  employees,
  onSelect,
  onOpenDocument,
  onDelete,
  selectedId,
}: {
  employees: EmployeeWithPeriod[];
  onSelect: (emp: EmployeeWithPeriod) => void;
  onOpenDocument: (path: string) => void;
  onDelete: (id: number) => void;
  selectedId?: number;
}) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Qualifikation</th>
          <th>Eintritt</th>
          <th>Austritt</th>
          <th>
            <abbr className="help" title={fteHelp}>
              FTE/VZÄ
            </abbr>
          </th>
          <th>Status</th>
          <th>Quelle</th>
          <th>Dokument</th>
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
              {emp.documentPath ? (
                <button
                  className="ghost-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDocument(emp.documentPath ?? '');
                  }}
                >
                  Öffnen
                </button>
              ) : (
                '—'
              )}
            </td>
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
  const [newQualification, setNewQualification] = useState('');
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
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
          if (!form.qualification) {
            setForm((prev) => ({ ...prev, qualification: list[0]?.name ?? '' }));
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
    setPage('edit');
    setForm({
      id: emp.id,
      periodId: emp.periodId,
      name: emp.name,
      qualification: emp.qualification,
      dataSource: emp.dataSource ?? '',
      note: emp.note ?? '',
      documentPath: emp.documentPath ?? '',
      startDate: emp.startDate,
      endDate: emp.endDate ?? '',
      fte: emp.fte,
    });
    setAddNewPeriod(false);
    try {
      const history = await window.api.listPeriods(emp.id ?? 0);
      setPeriods(history);
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
      if (!form.qualification && list.length > 0) {
        setForm((prev) => ({ ...prev, qualification: list[0].name }));
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleAddQualification = async () => {
    if (!newQualification.trim()) return;
    try {
      const list = await window.api.addQualification(newQualification.trim());
      setQualifications(list);
      setNewQualification('');
      setToast('Qualifikation gespeichert.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteQualification = async (id: number) => {
    try {
      const list = await window.api.deleteQualification(id);
      setQualifications(list);
      setToast('Qualifikation gelöscht.');
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      handleError(err);
    }
  };

  const confirmAction = (message: string, action: () => Promise<void> | void) => {
    setConfirmState({ message, onConfirm: action });
  };

  const confirmDeleteEmployee = (id?: number) => {
    if (!id) return;
    confirmAction('Mitarbeiter:in und Historie wirklich löschen?', () => deleteEmployee(id));
  };

  const confirmDeleteQualification = (id: number) => {
    confirmAction('Qualifikation wirklich löschen?', () => handleDeleteQualification(id));
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
    qualifications: 'Qualifikationen',
  };

  const pageSubtitle: Record<Page, string> = {
    dashboard: 'Kennzahlen und Aggregationen zum gewählten Jahr.',
    list: 'Liste mit Filter/Status und Doppelklick zum Bearbeiten.',
    new: 'Neue Person mit Historieneintrag erfassen.',
    edit: form.id ? `Bearbeitung: ${form.name}` : 'Bitte Eintrag aus Liste wählen.',
    qualifications: 'Qualifikationstypen verwalten und im Formular nutzen.',
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
    if (page === 'qualifications')
      return [
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Qualifikationen' },
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
          <div className="controls">
            <YearSelector year={year} onChange={setYear} currentYear={currentYear} />
          </div>
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
              onOpenDocument={(p) => window.api.openDocument(p)}
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

        {page === 'qualifications' && (
          <div className="grid form-layout">
            <div className="card form-card">
              <div className="form-header">
                <div>
                  <p className="eyebrow">Qualifikationen</p>
                  <h3>Typen verwalten</h3>
                </div>
              </div>
              <div className="form-grid">
                <label className="full-width">
                  Neue Qualifikation
                  <div className="inline-row">
                    <input
                      value={newQualification}
                      onChange={(e) => setNewQualification(e.target.value)}
                      placeholder="z. B. 3-jährig examiniert"
                    />
                    <button className="primary" onClick={handleAddQualification}>
                      <FontAwesomeIcon icon={faPlus} /> Hinzufügen
                    </button>
                  </div>
                </label>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualifications.map((q) => (
                      <tr key={q.id ?? q.name}>
                        <td>{q.name}</td>
                        <td>
                          <button
                            className="ghost-button danger"
                            onClick={() => confirmDeleteQualification(q.id ?? 0)}
                          >
                            Löschen
                          </button>
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
                  Dokumentenpfad
                  <input
                    value={form.documentPath}
                    onChange={(e) => setForm({ ...form, documentPath: e.target.value })}
                    placeholder="Pfad zur Personalakte / Datei"
                  />
                </label>
                <label>
                  Eintritt
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  Austritt
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
                className="ghost-button danger"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
              >
                <FontAwesomeIcon icon={faTrash} /> Löschen
              </button>
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
