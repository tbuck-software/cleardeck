import Checkbox from '../ui/Checkbox';
import React from 'react';
import Dialog from '../ui/Dialog';
import Segmented from '../ui/Segmented';
import { describeInterval } from '../../utils/instructionSchedule';
import type { IntervalSource } from '../../shared/types';
import type { InstructionModalState } from '../../types/ui';

/** Only the values that actually occur; see docs/adr/0002. */
const INTERVALS: { value: number | 0; label: string }[] = [
  { value: 0, label: 'keines' },
  { value: 6, label: '6 Monate' },
  { value: 12, label: '12 Monate' },
  { value: 24, label: '24 Monate' },
  { value: 36, label: '36 Monate' },
];

type InstructionModalProps = {
  state: InstructionModalState;
  onChange: (next: Partial<InstructionModalState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (id: number) => void;
};

const InstructionModal = ({
  state,
  onChange,
  onClose,
  onSave,
  onDelete,
}: InstructionModalProps) => (
  <Dialog
    open={state.open}
    width={480}
    title={state.id ? 'Einweisung bearbeiten' : 'Neue Einweisung'}
    subtitle="Änderungen gelten sofort für alle Zuordnungen."
    help={[
      {
        title: 'Wann gilt die halbjährliche Wiederholung?',
        body: 'Nur für Unterweisungen über Unfall- und Gesundheitsgefahren: bei Minderjährigen mindestens halbjährlich. Die Zuordnung ist anhand der Tätigkeit zu prüfen.',
      },
    ]}
    primaryLabel="Speichern"
    primaryDisabled={!state.topic.trim()}
    onPrimary={onSave}
    deleteLabel={state.id && onDelete ? 'Löschen' : undefined}
    onDelete={state.id && onDelete ? () => onDelete(state.id as number) : undefined}
    onClose={onClose}
  >
    <div className="field">
      <label htmlFor="instruction-topic">Thema</label>
      <input
        id="instruction-topic"
        className="input"
        placeholder="z. B. Hygiene & Händedesinfektion"
        value={state.topic}
        onChange={(event) => onChange({ topic: event.target.value })}
      />
    </div>
    <div className="field">
      <label htmlFor="instruction-basis">Gesetzliche Grundlage</label>
      <input
        id="instruction-basis"
        className="input"
        placeholder="z. B. ArbSchG § 12"
        value={state.legalBasis}
        onChange={(event) => onChange({ legalBasis: event.target.value })}
      />
    </div>
    <div className="field">
      <label>Wiederholung</label>
      <Segmented
        fill
        wrap
        ariaLabel="Wiederholungsintervall"
        options={INTERVALS}
        value={state.intervalMonths ?? 0}
        onChange={(months) => onChange({ intervalMonths: months === 0 ? null : months })}
      />
      <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
        {state.intervalMonths == null
          ? 'Ohne Intervall wird nichts automatisch fällig — richtig für anlassbezogene Einweisungen wie Medizinprodukte.'
          : 'Beim Abschließen entsteht ein Folgeeintrag mit dem nächsten Termin.'}
      </p>
    </div>

    {state.intervalMonths != null && (
      <div className="field">
        <label>Herkunft des Intervalls</label>
        <Segmented
          fill
          ariaLabel="Herkunft des Intervalls"
          options={[
            { value: 'norm' as IntervalSource, label: 'Aus der Rechtsgrundlage' },
            { value: 'betrieblich' as IntervalSource, label: 'Betriebliche Festlegung' },
          ]}
          value={state.intervalSource}
          onChange={(intervalSource) => onChange({ intervalSource })}
        />
        <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
          {describeInterval(state.intervalMonths, state.intervalSource)} — in einer Prüfung ist eine
          betriebliche Festlegung zu begründen, eine Frist aus der Norm zu belegen.
        </p>
      </div>
    )}

    <Checkbox
      checked={state.minorHazardInstruction ?? false}
      onChange={(event) => onChange({ minorHazardInstruction: event.target.checked })}
    >
      Gefahrenunterweisung nach § 29 JArbSchG
    </Checkbox>
    <div className="field">
      <label htmlFor="instruction-note">Notiz</label>
      <textarea
        id="instruction-note"
        className="input"
        style={{ minHeight: 70 }}
        placeholder="Wofür gilt das, was ist zu beachten?"
        value={state.note}
        onChange={(event) => onChange({ note: event.target.value })}
      />
    </div>
  </Dialog>
);

export default InstructionModal;
