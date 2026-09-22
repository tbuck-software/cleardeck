import React, { useState } from 'react';
import Icon, { DragHandleIcon } from '../ui/Icon';
import ListPanel from '../ui/ListPanel';
import ListRow from '../ui/ListRow';

export type AdminItem = {
  id: number;
  title: string;
  note?: string;
  tags: string[];
  usage: string;
  active?: boolean;
};

type AdminListPageProps = {
  title: string;
  subtitle: string;
  items: AdminItem[];
  emptyLabel: string;
  onCreate: () => void;
  extraActions?: React.ReactNode;
  onEdit: (id: number) => void;
  /** Moves the item to a new index; the caller persists the new sort order. */
  onReorder: (id: number, targetIndex: number) => void;
};

const AdminListPage = ({
  title,
  subtitle,
  items,
  emptyLabel,
  onCreate,
  extraActions,
  onEdit,
  onReorder,
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {extraActions}
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          <Icon name="plus" size={16} />
          Neu
        </button>
        </div>
      </header>

      <ListPanel>
        {items.length === 0 && <div className="cd-empty">{emptyLabel}</div>}
        {items.map((item, index) => {
          const tags = item.tags.filter(Boolean);
          return (
            <ListRow
              key={item.id}
              className={item.active === false ? 'cd-row-departed' : undefined}
              leading={
                <span className="cd-drag" title="Ziehen zum Sortieren" aria-hidden="true">
                  <DragHandleIcon />
                </span>
              }
              title={item.title}
              subline={item.note}
              meta={item.usage}
              tag={
                tags.length > 0
                  ? tags.map((tag) => (
                      <span key={tag} className="tag tag-neutral">
                        {tag}
                      </span>
                    ))
                  : undefined
              }
              ariaLabel={`${item.title} bearbeiten`}
              onOpen={() => onEdit(item.id)}
              drag={{
                dragging: draggingId === item.id,
                onDragStart: () => setDraggingId(item.id),
                onDragEnd: () => setDraggingId(null),
                onDrop: () => {
                  if (draggingId != null && draggingId !== item.id) onReorder(draggingId, index);
                  setDraggingId(null);
                },
              }}
            />
          );
        })}
      </ListPanel>
    </div>
  );
};

export default AdminListPage;
