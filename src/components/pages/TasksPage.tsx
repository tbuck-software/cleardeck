import React, { useMemo, useState } from 'react';
import Segmented from '../ui/Segmented';
import ListPanel from '../ui/ListPanel';
import TaskRow from '../ui/TaskRow';
import type { DashboardTask, TaskTarget } from '../../utils/dashboardTasks';

type TasksPageProps = {
  tasks: DashboardTask[];
  doneTaskIds: string[];
  onToggleTask: (id: string) => void;
  onOpenTarget: (target: TaskTarget) => void;
};

const TasksPage = ({ tasks, doneTaskIds, onToggleTask, onOpenTarget }: TasksPageProps) => {
  const [category, setCategory] = useState('all');
  const [showDone, setShowDone] = useState(false);

  // Categories come from the tasks themselves, so a new task kind needs no
  // change here — and empty categories never show up as dead filters.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      if (doneTaskIds.includes(task.id)) return;
      counts.set(task.tag, (counts.get(task.tag) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tasks, doneTaskIds]);

  const visible = useMemo(
    () =>
      tasks.filter((task) => {
        const done = doneTaskIds.includes(task.id);
        if (done && !showDone) return false;
        return category === 'all' || task.tag === category;
      }),
    [tasks, doneTaskIds, category, showDone],
  );

  const openCount = tasks.filter((task) => !doneTaskIds.includes(task.id)).length;
  const doneCount = tasks.length - openCount;

  return (
    <div className="cd-page cd-medium" style={{ gap: 22 }}>
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            Heute zu tun
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            {openCount} offen · automatisch aus Fristen, Visiten und Datenlücken. Haken stellen
            Aufgaben für diese Sitzung zurück — was bleibt, verschwindet erst, wenn der Datensatz
            gepflegt ist.
          </p>
        </div>
      </header>

      <div className="cd-filters">
        <Segmented
          ariaLabel="Art der Aufgabe"
          wrap
          options={[
            { value: 'all', label: 'Alle', count: openCount },
            ...categories.map(([tag, count]) => ({ value: tag, label: tag, count })),
          ]}
          value={category}
          onChange={setCategory}
        />
        {doneCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowDone((value) => !value)}
          >
            {showDone ? 'Zurückgestellte ausblenden' : `${doneCount} zurückgestellte anzeigen`}
          </button>
        )}
      </div>

      <ListPanel>
        {visible.length === 0 && (
          <div className="cd-empty">
            {openCount === 0
              ? 'Keine weiteren Aufgaben in dieser Ansicht. Zurückgestellte Aufgaben und nicht erfasste Nachweise sind damit nicht fachlich erledigt.'
              : 'Keine Aufgaben in dieser Kategorie.'}
          </div>
        )}
        {visible.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            done={doneTaskIds.includes(task.id)}
            onToggle={onToggleTask}
            onOpen={onOpenTarget}
          />
        ))}
      </ListPanel>
    </div>
  );
};

export default TasksPage;
