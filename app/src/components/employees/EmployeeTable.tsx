import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import type { EmployeeWithPeriod } from '../../shared/types';
import { fteHelp } from '../../constants';
import Badge from '../ui/Badge';

type EmployeeTableProps = {
  employees: EmployeeWithPeriod[];
  onSelect: (emp: EmployeeWithPeriod) => void | Promise<void>;
  onDelete: (id: number) => void;
  selectedId?: number;
};

const EmployeeTable = ({ employees, onSelect, onDelete, selectedId }: EmployeeTableProps) => (
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
              VZÄ
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
            <td colSpan={8} className="empty">
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

export default EmployeeTable;
