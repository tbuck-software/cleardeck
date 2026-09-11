import React from 'react';
import Icon from './Icon';
import ListRow from './ListRow';
import type { DashboardTask, TaskTarget } from '../../utils/dashboardTasks';

type TaskRowProps = {
  task: DashboardTask;
  done: boolean;
  onToggle: (id: string) => void;
  onOpen: (target: TaskTarget) => void;
};

/** Shared by the dashboard preview and the full "Heute zu tun" page. */
const TaskRow = ({ task, done, onToggle, onOpen }: TaskRowProps) => (
  <ListRow
    style={{ opacity: done ? 0.45 : 1 }}
    leading={
      <button
        type="button"
        className="cd-check"
        aria-label={done ? 'Wieder öffnen' : 'Erledigt'}
        aria-pressed={done}
        data-done={done}
        onClick={() => onToggle(task.id)}
      >
        <Icon name="check" size={14} />
      </button>
    }
    title={
      <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{task.title}</span>
    }
    subline={task.sub}
    tag={<span className={`tag ${task.tagClass}`}>{task.tag}</span>}
    onOpen={() => onOpen(task.target)}
  />
);

export default TaskRow;
