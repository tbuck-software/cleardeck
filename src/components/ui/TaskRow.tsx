import React from 'react';
import Icon from './Icon';
import type { DashboardTask, TaskTarget } from '../../utils/dashboardTasks';

type TaskRowProps = {
  task: DashboardTask;
  done: boolean;
  onToggle: (id: string) => void;
  onOpen: (target: TaskTarget) => void;
};

/** Shared by the dashboard preview and the full "Heute zu tun" page. */
const TaskRow = ({ task, done, onToggle, onOpen }: TaskRowProps) => (
  <div
    className="cd-item"
    role="link"
    tabIndex={0}
    style={{ opacity: done ? 0.45 : 1 }}
    onClick={() => onOpen(task.target)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(task.target);
      }
    }}
  >
    <button
      type="button"
      className="cd-check"
      aria-label={done ? 'Wieder öffnen' : 'Erledigt'}
      aria-pressed={done}
      data-done={done}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(task.id);
      }}
    >
      <Icon name="check" size={14} />
    </button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{task.title}</div>
      <div className="cd-muted-13">{task.sub}</div>
    </div>
    <span className={`tag ${task.tagClass}`} style={{ flex: 'none' }}>
      {task.tag}
    </span>
    <span className="cd-arrow">→</span>
  </div>
);

export default TaskRow;
