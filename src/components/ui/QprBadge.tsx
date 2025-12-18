import React from 'react';
import type { QprRating } from '../../shared/types';

type QprBadgeProps = {
  rating?: QprRating | null;
  showLabel?: boolean;
};

const ratingLabels: Record<QprRating, string> = {
  A: 'Keine Auffaelligkeiten',
  B: 'Auffaelligkeiten',
  C: 'Defizite/Risiko',
  D: 'Defizite/Folgen',
};

const QprBadge = ({ rating, showLabel = false }: QprBadgeProps) => {
  if (!rating) {
    return <span className="badge badge-muted">-</span>;
  }

  return (
    <span className={`badge badge-qpr-${rating.toLowerCase()}`} title={ratingLabels[rating]}>
      {rating}
      {showLabel && ` - ${ratingLabels[rating]}`}
    </span>
  );
};

export default QprBadge;
