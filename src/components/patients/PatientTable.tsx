import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import type { PatientWithLatestVisit } from '../../shared/types';
import QprBadge from '../ui/QprBadge';

type PatientTableProps = {
  patients: PatientWithLatestVisit[];
  onSelect: (patient: PatientWithLatestVisit) => void | Promise<void>;
  onDelete: (id: number) => void;
  selectedId?: number;
};

type SortKey = 'name' | 'birthDate' | 'diagnosis' | 'qprStatus' | 'latestVisitDate' | 'visitCount';
type SortDirection = 'asc' | 'desc';

const PatientTable = ({ patients, onSelect, onDelete, selectedId }: PatientTableProps) => {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedPatients = useMemo(() => {
    const normalized = [...patients];
    const { key, direction } = sort;
    const dir = direction === 'asc' ? 1 : -1;

    const getValue = (patient: PatientWithLatestVisit): string | number => {
      switch (key) {
        case 'visitCount':
          return patient.visitCount ?? 0;
        case 'name':
          return patient.name ?? '';
        case 'birthDate':
          return patient.birthDate ?? '';
        case 'diagnosis':
          return patient.diagnosis ?? '';
        case 'qprStatus':
          return patient.latestQprRating ?? patient.qprStatus ?? '';
        case 'latestVisitDate':
          return patient.latestVisitDate ?? '';
      }
    };

    normalized.sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }

      return String(aVal).localeCompare(String(bVal), 'de', { sensitivity: 'base' }) * dir;
    });

    return normalized;
  }, [patients, sort]);

  const getSortIcon = (key: SortKey) => {
    if (sort.key !== key) return faSort;
    return sort.direction === 'asc' ? faSortUp : faSortDown;
  };

  const SortableHeader = ({
    label,
    sortKey,
    help,
  }: {
    label: React.ReactNode;
    sortKey: SortKey;
    help?: string;
  }) => (
    <th>
      <div
        className={`sort-header ${sort.key === sortKey ? 'active' : ''}`}
        onClick={() => toggleSort(sortKey)}
        title={`Nach ${label} sortieren`}
      >
        {help ? (
          <abbr className="help" title={help}>
            {label}
          </abbr>
        ) : (
          label
        )}
        <FontAwesomeIcon icon={getSortIcon(sortKey)} className="sort-icon" />
      </div>
    </th>
  );

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <SortableHeader label="Name" sortKey="name" />
            <SortableHeader label="Geburtsdatum" sortKey="birthDate" />
            <SortableHeader label="Diagnose" sortKey="diagnosis" />
            <SortableHeader label="QPR-Status" sortKey="qprStatus" help="Qualitaetspruefung nach QPR 2026" />
            <SortableHeader label="Letzte Visite" sortKey="latestVisitDate" />
            <SortableHeader label="Visiten" sortKey="visitCount" />
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {sortedPatients.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                Keine Patient:innen gefunden.
              </td>
            </tr>
          )}
          {sortedPatients.map((patient) => (
            <tr
              key={patient.id}
              onClick={() => onSelect(patient)}
              className={selectedId === patient.id ? 'selected' : undefined}
            >
              <td>{patient.name}</td>
              <td>{patient.birthDate ?? '-'}</td>
              <td>{patient.diagnosis ?? '-'}</td>
              <td>
                <QprBadge rating={patient.latestQprRating ?? patient.qprStatus} />
              </td>
              <td>{patient.latestVisitDate ?? '-'}</td>
              <td>{patient.visitCount ?? 0}</td>
              <td>
                <button
                  className="ghost-button danger icon-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(patient.id ?? 0);
                  }}
                  title="Loeschen"
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
};

export default PatientTable;
