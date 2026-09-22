import React from 'react';
import Checkbox from './Checkbox';
import { HKP_GROUPS, NO_COMPETENCY_TEMPLATE } from '../../shared/hkpCatalog';

const options = [
  { value: 'Nur PFK', label: 'PFK' }, { value: 'Nur PFA', label: 'Pflegeassistenz / PFA' },
  { value: 'Nur PHK', label: 'PHK' }, { value: 'Azubi', label: 'Auszubildende' },
  { value: 'Praxisanleitung', label: 'Praxisanleitung' }, { value: 'QMB', label: 'QMB' },
  ...HKP_GROUPS.map((group) => ({ ...group, label: `${group.value}: ${group.label}` })),
];
export default function CompetencyRelevanceField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const chosen = value.split(/[;,/]/).map((part) => part.trim()).filter(Boolean);
  const unknown = chosen.filter((part) => part !== 'Alle' && part !== NO_COMPETENCY_TEMPLATE && !options.some((option) => option.value === part));
  const toggle = (key: string) => {
    const current = chosen.filter((part) => part !== 'Alle' && part !== NO_COMPETENCY_TEMPLATE);
    const next = current.includes(key) ? current.filter((part) => part !== key) : [...current, key];
    onChange(next.join('; ') || NO_COMPETENCY_TEMPLATE);
  };
  return <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
    <legend>Berufsgruppen-Vorlage</legend>
    <Checkbox checked={value === 'Alle'} onChange={() => onChange(value === 'Alle' ? NO_COMPETENCY_TEMPLATE : 'Alle')}>Alle</Checkbox>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: 8 }}>
      {[...options, ...unknown.map((key) => ({ value: key, label: key }))].map((option) => <Checkbox key={option.value} checked={chosen.includes(option.value)} onChange={() => toggle(option.value)}>{option.label}</Checkbox>)}
    </div>
    {value === NO_COMPETENCY_TEMPLATE && <span className="cd-muted-13">Keine automatische Vorlagenauswahl</span>}
  </fieldset>;
}
