import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { PatientWithLatestVisit, QprRating } from '../../shared/types';
import PatientTable from '../patients/PatientTable';

type PatientListProps = {
  search: string;
  ratingFilter: 'all' | QprRating;
  filteredPatients: PatientWithLatestVisit[];
  selectedId?: number;
  onSearchChange: (value: string) => void;
  onRatingChange: (value: 'all' | QprRating) => void;
  onCreate: () => void;
  onSelect: (patient: PatientWithLatestVisit) => void | Promise<void>;
  onDelete: (id: number) => void;
};

const PatientList = ({
  search,
  ratingFilter,
  filteredPatients,
  selectedId,
  onSearchChange,
  onRatingChange,
  onCreate,
  onSelect,
  onDelete,
}: PatientListProps) => (
  <div className="stack">
    <div className="card list-toolbar">
      <div className="filters">
        <input
          type="search"
          placeholder="Suchen (Name oder Diagnose)..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          value={ratingFilter}
          onChange={(e) => onRatingChange(e.target.value as 'all' | QprRating)}
        >
          <option value="all">QPR: alle</option>
          <option value="A">A - Keine Auffaelligkeiten</option>
          <option value="B">B - Auffaelligkeiten</option>
          <option value="C">C - Defizite/Risiko</option>
          <option value="D">D - Defizite/Folgen</option>
        </select>
      </div>
    </div>
    <div className="card">
      <div className="form-header">
        <div>
          <p className="eyebrow">Patient:innen</p>
          <h3>Liste</h3>
        </div>
        <div className="toolbar-actions">
          <button className="primary" onClick={onCreate}>
            <FontAwesomeIcon icon={faPlus} /> Neu anlegen
          </button>
        </div>
      </div>
      <PatientTable
        patients={filteredPatients}
        onSelect={onSelect}
        selectedId={selectedId}
        onDelete={onDelete}
      />
    </div>
  </div>
);

export default PatientList;
