import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import type { EmployeeWithPeriod } from '../../shared/types';
import { fteHelp } from '../../constants';
import Badge from '../ui/Badge';

type EmployeeTableProps = {
  employees: EmployeeWithPeriod[];
  onSelect: (emp: EmployeeWithPeriod) => void | Promise<void>;
  onDelete: (id: number) => void;
  selectedId?: number;
};

type SortKey = 'name' | 'qualification' | 'startDate' | 'endDate' | 'fte' | 'weeklyHours' | 'status';
type SortDirection = 'asc' | 'desc';

const EmployeeTable = ({ employees, onSelect, onDelete, selectedId }: EmployeeTableProps) => {
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

  const sortedEmployees = useMemo(() => {
    const normalized = [...employees];
    const { key, direction } = sort;
    const dir = direction === 'asc' ? 1 : -1;

    const getValue = (emp: EmployeeWithPeriod): string | number => {
      switch (key) {
        case 'fte':
          return emp.fte ?? -1;
        case 'weeklyHours':
          return emp.weeklyHours ?? -1;
        case 'endDate':
          return emp.endDate ?? '';
        case 'name':
          return emp.name ?? '';
        case 'qualification':
          return emp.qualification ?? '';
        case 'startDate':
          return emp.startDate ?? '';
        case 'status':
          return emp.status ?? '';
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
  }, [employees, sort]);

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
            <SortableHeader label="Qualifikation" sortKey="qualification" />
            <SortableHeader label="Start" sortKey="startDate" />
            <SortableHeader label="Ende" sortKey="endDate" />
            <SortableHeader label="VZÄ" sortKey="fte" help={fteHelp} />
            <SortableHeader label="Wochenstunden" sortKey="weeklyHours" />
            <SortableHeader label="Status" sortKey="status" />
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                Keine Einträge im ausgewählten Jahr.
              </td>
            </tr>
          )}
          {sortedEmployees.map((emp) => (
            <tr
              key={`${emp.id}-${emp.periodId}`}
              onClick={() => onSelect(emp)}
              className={selectedId === emp.id ? 'selected' : undefined}
            >
              <td>{emp.name}</td>
              <td>{emp.qualification}</td>
              <td>{emp.startDate}</td>
              <td>{emp.endDate ?? '—'}</td>
              <td>{emp.fte !== undefined && emp.fte !== null ? Math.min(1, Number(emp.fte)).toFixed(2) : '—'}</td>
              <td>{emp.weeklyHours ?? '—'}</td>
              <td>
                <Badge status={emp.status} />
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
};

export default EmployeeTable;
