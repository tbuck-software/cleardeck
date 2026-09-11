import React from 'react';
import Icon from './Icon';

export type ListRowDrag = {
  dragging?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
};

export type ListRowProps = {
  /** Drag handle, checkbox, status dot, code chip or avatar — stays outside the
      clickable area so interactive handles keep working. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subline?: React.ReactNode;
  meta?: React.ReactNode;
  tag?: React.ReactNode;
  /** Click opens something: the row becomes a button and shows the chevron. */
  onOpen?: () => void;
  /** Click only picks the row: button without chevron, for selection lists. */
  onSelect?: () => void;
  selected?: boolean;
  /** Reorder by dragging the whole row; the visible handle belongs in `leading`. */
  drag?: ListRowDrag;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
};

const ListRow = ({
  leading,
  title,
  subline,
  meta,
  tag,
  onOpen,
  onSelect,
  selected,
  drag,
  ariaLabel,
  className,
  style,
}: ListRowProps) => {
  const action = onOpen ?? onSelect;
  const body = (
    <>
      <span className="cd-listrow-copy">
        <span className="cd-listrow-title">{title}</span>
        {subline != null && subline !== '' && <span className="cd-listrow-sub">{subline}</span>}
      </span>
      {meta != null && meta !== '' && <span className="cd-listrow-meta">{meta}</span>}
      {tag != null && tag !== '' && <span className="cd-listrow-tag">{tag}</span>}
      {onOpen && <Icon name="chevronRight" size={16} className="cd-listrow-chevron" />}
    </>
  );
  return (
    <div
      className={`cd-listrow${className ? ` ${className}` : ''}`}
      data-selected={selected ? 'true' : undefined}
      data-dragging={drag?.dragging ? 'true' : undefined}
      draggable={drag ? true : undefined}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag ? (event) => event.preventDefault() : undefined}
      onDrop={
        drag
          ? (event) => {
              event.preventDefault();
              drag.onDrop();
            }
          : undefined
      }
      style={style}
    >
      {leading != null && leading !== false && <div className="cd-listrow-lead">{leading}</div>}
      {action ? (
        <button type="button" className="cd-listrow-main" aria-label={ariaLabel} onClick={action}>
          {body}
        </button>
      ) : (
        <div className="cd-listrow-main">{body}</div>
      )}
    </div>
  );
};

export default ListRow;
