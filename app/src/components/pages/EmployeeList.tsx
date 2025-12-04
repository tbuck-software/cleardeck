import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { QualificationType, EmployeeWithPeriod } from '../../shared/types';
import EmployeeTable from '../employees/EmployeeTable';

type EmployeeListProps = {
  search: string;
  statusFilter: 'all' | EmployeeWithPeriod['status'];
  qualificationFilter: string;
  qualifications: QualificationType[];
  filteredEmployees: EmployeeWithPeriod[];
  selectedId?: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: 'all' | EmployeeWithPeriod['status']) => void;
  onQualificationChange: (value: string) => void;
  onExport: (format: 'csv' | 'xlsx') => void | Promise<void>;
  onCreate: () => void;
  onSelect: (emp: EmployeeWithPeriod) => void | Promise<void>;
  onDelete: (id: number) => void;
};

const EmployeeList = ({
  search,
  statusFilter,
  qualificationFilter,
  qualifications,
  filteredEmployees,
  selectedId,
  onSearchChange,
  onStatusChange,
  onQualificationChange,
  onExport,
  onCreate,
  onSelect,
  onDelete,
}: EmployeeListProps) => (
  <div className="stack">
    <div className="card list-toolbar">
      <div className="filters">
        <input
          type="search"
          placeholder="Suchen (Name oder Qualifikation)…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value as any)}>
          <option value="all">Status: alle</option>
          <option value="active">aktiv</option>
          <option value="left">ausgeschieden</option>
        </select>
        <select value={qualificationFilter} onChange={(e) => onQualificationChange(e.target.value)}>
          <option value="all">Qualifikation: alle</option>
          {qualifications.map((q) => (
            <option key={q.id ?? q.name} value={q.name}>
              {q.name}
            </option>
          ))}
        </select>
      </div>
    </div>
    <div className="card">
      <div className="form-header">
        <div>
          <p className="eyebrow">Mitarbeitende</p>
          <h3>Liste</h3>
        </div>
        <div className="toolbar-actions">
          <button className="ghost-button" onClick={() => onExport('csv')}>
            <FontAwesomeIcon icon={faDownload} /> CSV
          </button>
          <button className="ghost-button" onClick={() => onExport('xlsx')}>
            <FontAwesomeIcon icon={faDownload} /> Excel
          </button>
          <button className="primary" onClick={onCreate}>
            <FontAwesomeIcon icon={faPlus} /> Neu anlegen
          </button>
        </div>
      </div>
      <EmployeeTable employees={filteredEmployees} onSelect={onSelect} selectedId={selectedId} onDelete={onDelete} />
    </div>
  </div>
);

export default EmployeeList;
