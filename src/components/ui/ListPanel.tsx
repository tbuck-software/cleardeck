import React from 'react';

type ListPanelProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Container for a run of ListRow entries: one surface, hairlines between rows. */
const ListPanel = ({ children, className, style }: ListPanelProps) => (
  <div className={`cd-list${className ? ` ${className}` : ''}`} style={style}>
    {children}
  </div>
);

export default ListPanel;
