import React, { useMemo, useState } from 'react';
import Dialog from '../ui/Dialog';
import Avatar from '../ui/Avatar';
import { describeInterval } from '../../utils/instructionSchedule';
import type { EmployeeWithPeriod, InstructionDefinition } from '../../shared/types';

export type AssignInstructionModalState = {
  open: boolean;
  definitionId: number | null;
  dueDate: string;
  selectedEmployeeIds: number[];
};

export const emptyAssignInstructionModal = (): AssignInstructionModalState => ({
  open: false,
  definitionId: null,
  dueDate: '',
  selectedEmployeeIds: [],
});

type AssignInstructionModalProps = {
  state: AssignInstructionModalState;
  definition?: InstructionDefinition;
  employees: EmployeeWithPeriod[];
  /** Employee ids that already hold an open entry for this topic. */
  alreadyOpenIds: number[];
  onChange: (next: Partial<AssignInstructionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const AssignInstructionModal = ({
  state,
  definition,
  employees,
  alreadyOpenIds,
  onChange,
  onClose,
  onSave,
}: AssignInstructionModalProps) => {
  const [query, setQuery] = useState('');

  const assignable = useMemo(
    () => employees.filter((employee) => employee.id && !alreadyOpenIds.includes(employee.id)),
    [employees, alreadyOpenIds],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((employee) => employee.name.toLowerCase().includes(needle));
  }, [employees, query]);

  const toggle = (employeeId: number) => {
    const selected = state.selectedEmployeeIds.includes(employeeId)
      ? state.selectedEmployeeIds.filter((id) => id !== employeeId)
      : [...state.selectedEmployeeIds, employeeId];
    onChange({ selectedEmployeeIds: selected });
  };

  const allSelected =
    assignable.length > 0 && assignable.every((employee) => state.selectedEmployeeIds.includes(employee.id as number));

  return (
    <Dialog
      open={state.open}
      width={620}
      title="Einweisung zuordnen"
      subtitle={definition?.topic ?? ''}
      primaryLabel={
        state.selectedEmployeeIds.length > 0
          ? `${state.selectedEmployeeIds.length} zuordnen`
          : 'Zuordnen'
      }
      primaryDisabled={state.selectedEmployeeIds.length === 0}
      onPrimary={onSave}
      onClose={onClose}
    >
      <p className="cd-muted-13" style={{ margin: 0 }}>
        {definition?.legalBasis ?? 'Ohne Rechtsgrundlage'} ·{' '}
        {describeInterval(definition?.intervalMonths ?? null, definition?.intervalSource ?? null)}
      </p>

      <div className="field">
        <label htmlFor="assign-instruction-due">Fällig bis</label>
        <input
          id="assign-instruction-due"
          className="input"
          type="date"
          value={state.dueDate}
          onChange={(event) => onChange({ dueDate: event.target.value })}
        />
        <p className="cd-muted-13" style={{ margin: '4px 0 0' }}>
          Gilt für alle ausgewählten Personen. Leer lassen, wenn noch kein Termin feststeht.
        </p>
      </div>

      <div className="cd-section-head" style={{ marginBottom: 0 }}>
        <span className="cd-muted-13">
          {state.selectedEmployeeIds.length} von {assignable.length} ausgewählt
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={assignable.length === 0}
          onClick={() =>
            onChange({
              selectedEmployeeIds: allSelected ? [] : assignable.map((employee) => employee.id as number),
            })
          }
        >
          {allSelected ? 'Auswahl aufheben' : 'Alle aktivieren'}
        </button>
      </div>

      <input
        className="input"
        type="search"
        placeholder="Person suchen"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="cd-panel" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {visible.length === 0 && <div className="cd-empty">Keine Person gefunden.</div>}
        {visible.map((employee) => {
          const employeeId = employee.id as number;
          const blocked = alreadyOpenIds.includes(employeeId);
          const checked = state.selectedEmployeeIds.includes(employeeId);
          return (
            <label
              key={employeeId}
              className="cd-item"
              style={{ cursor: blocked ? 'default' : 'pointer', opacity: blocked ? 0.55 : 1 }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={blocked}
                onChange={() => toggle(employeeId)}
                style={{ width: 16, height: 16, flex: 'none', accentColor: 'var(--color-accent)' }}
              />
              <Avatar name={employee.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{employee.name}</div>
                <div className="cd-muted-13">{employee.qualification ?? 'Ohne Qualifikation'}</div>
              </div>
              {blocked && <span className="tag tag-neutral">bereits offen</span>}
            </label>
          );
        })}
      </div>
    </Dialog>
  );
};

export default AssignInstructionModal;
