import React from 'react';
import type { CompetencyReviewStatus } from '../../shared/types';

export default function CompetencyReviewBadge({ status, note }: { status?: CompetencyReviewStatus | null; note?: string | null }) {
  if (!status) return null;
  return <span className={`tag ${status === 'pending' ? 'tag-neutral' : 'tag-accent-2'}`} title={note || 'Prüfstatus der Katalogvorlage, unabhängig vom Einarbeitungsstand.'}>
    {status === 'pending' ? 'Vorlage ungeprüft' : 'Vorlage betrieblich geprüft'}
  </span>;
}
