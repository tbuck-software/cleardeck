import React, { useState } from 'react';
import Icon, { DragHandleIcon } from '../ui/Icon';

export type AdminItem = {
  id: number;
  title: string;
  note: string;
  tags: string[];
  usage: string;
};

type AdminListPageProps = {
  title: string;
  subtitle: string;
  items: AdminItem[];
  emptyLabel: string;
  onCreate: () => void;
  onEdit: (id: number) => void;
  /** Moves the item to a new index; the caller persists the new sort order. */
  onReorder: (id: number, targetIndex: number) => void;
  /** Optional per-row bulk action, e.g. assigning an instruction to many people. */
  assignLabel?: string;
  onAssign?: (id: number) => void;
};

const AdminListPage = ({
  title,
  subtitle,
  items,
  emptyLabel,
  onCreate,
  onEdit,
  onReorder,
  assignLabel,
  onAssign,
}: AdminListPageProps) => {
  const [draggingId, setDraggingId] = useState<number | null>(null);

  return (
    <div className="cd-page" style={{ maxWidth: 960 }}>
      <header className="cd-page-header">
        <div>
          <h1 className="cd-h1" style={{ marginTop: 0 }}>
            {title}
          </h1>
          <p className="cd-muted" style={{ margin: '4px 0 0' }}>
            {subtitle}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          <Icon name="plus" size={16} />
          Neu
        </button>
      </header>

      <div className="cd-panel">
        {items.length === 0 && <div className="cd-empty">{emptyLabel}</div>}
        {items.map((item, index) => (
          <div
            key={item.id}
            className="cd-item"
            role="link"
            tabIndex={0}
            draggable
            data-dragging={draggingId === item.id}
            onDragStart={() => setDraggingId(item.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingId != null && draggingId !== item.id) onReorder(draggingId, index);
              setDraggingId(null);
            }}
            onClick={() => onEdit(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEdit(item.id);
              }
            }}
          >
            <span className="cd-drag" title="Ziehen zum Sortieren" aria-hidden="true">
              <DragHandleIcon />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div className="cd-muted-13">{item.note}</div>
            </div>
            <div className="cd-tag-row">
              {item.tags.filter(Boolean).map((tag) => (
                <span key={tag} className="tag tag-neutral">
                  {tag}
                </span>
              ))}
            </div>
            <span className="cd-usage">{item.usage}</span>
            {onAssign && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 'none' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onAssign(item.id);
                }}
              >
                {assignLabel ?? 'Zuordnen'}
              </button>
            )}
            <span className="cd-arrow">→</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminListPage;
