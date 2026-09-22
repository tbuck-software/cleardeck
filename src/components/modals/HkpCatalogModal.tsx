import React, { useState } from 'react';
import type { CompetencyDefinition } from '../../shared/types';
import { findExistingHkpDefinition, hkpCatalog, HKP_GROUPS, HKP_SOURCE } from '../../shared/hkpCatalog';
import api from '../../services/api';
import Checkbox from '../ui/Checkbox';
import Dialog from '../ui/Dialog';
import ListPanel from '../ui/ListPanel';
import ListRow from '../ui/ListRow';

type Props = { definitions: CompetencyDefinition[]; onImported: () => void; onClose: () => void };
export default function HkpCatalogModal({ definitions, onImported, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matching = hkpCatalog.filter((entry) => !group || entry.groups.some((value) => value === group));
  const available = matching.filter((entry) => !findExistingHkpDefinition(entry, definitions));
  const selectedKeys = selected.filter((key) => available.some((entry) => entry.templateKey === key));
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.competencies.importHkp(selectedKeys);
      onImported();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Übernahme fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };
  return <Dialog open manageFocus width={780} title="HKP-Katalog ergänzen" subtitle={HKP_SOURCE}
    primaryLabel={busy ? 'Wird ergänzt …' : `${selectedKeys.length} ergänzen`}
    primaryDisabled={busy || !selectedKeys.length} onPrimary={() => void save()} onClose={() => { if (!busy) onClose(); }}>
    <p className="cd-muted-13">Vorlage zur Kompetenzbewertung. Betriebliche Anwendbarkeit und persönliche Voraussetzungen prüfen.</p>
    <div className="field">
      <label htmlFor="hkp-catalog-group">Berufsgruppe</label>
      <select id="hkp-catalog-group" className="input" value={group} disabled={busy} onChange={(event) => { setGroup(event.target.value); setSelected([]); }}>
        <option value="">Alle Berufsgruppen</option>
        {HKP_GROUPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
    <div className="cd-section-head">
      <span role="status" className="cd-muted-13">{selectedKeys.length} ausgewählt · {matching.length - available.length} bereits vorhanden</span>
      <button type="button" className="btn btn-ghost" disabled={busy || !available.length} onClick={() => setSelected(selectedKeys.length === available.length ? [] : available.map((entry) => entry.templateKey))}>
        {selectedKeys.length === available.length && available.length ? 'Auswahl aufheben' : 'Alle neuen auswählen'}
      </button>
    </div>
    {error && <p role="alert">{error}</p>}
    <ListPanel style={{ maxHeight: 420, overflowY: 'auto' }}>
      {matching.map((entry) => {
        const existing = findExistingHkpDefinition(entry, definitions);
        const checked = selectedKeys.includes(entry.templateKey);
        const toggle = () => setSelected((keys) => keys.includes(entry.templateKey) ? keys.filter((key) => key !== entry.templateKey) : [...keys, entry.templateKey]);
        return <ListRow key={entry.templateKey} title={entry.name} selected={checked}
          leading={<Checkbox checked={!!existing || checked} disabled={busy || !!existing} aria-label={`${entry.code} ${entry.name} auswählen`} onChange={toggle} />}
          subline={`${entry.serviceGroup} · GPOS ${entry.code}`}
          tag={<span className="tag tag-neutral" title={existing ? `Vorhandener Eintrag bleibt erhalten: ${existing.name}` : entry.note ?? undefined}>{existing ? 'Bereits vorhanden' : 'Betrieblich ungeprüft'}</span>}
          onSelect={busy || existing ? undefined : toggle} />;
      })}
    </ListPanel>
    <p className="cd-muted-13">Bestehende Einträge und Bewertungen bleiben erhalten.</p>
  </Dialog>;
}
