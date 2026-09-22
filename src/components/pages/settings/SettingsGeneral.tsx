import { annualFteLabel, type AnnualFteMethod } from '../../../shared/annualFte';
import React from 'react';
import Segmented from '../../ui/Segmented';
import type { CareSettings } from '../../../shared/types';

type SettingsGeneralProps = {
  annualFteMethod: AnnualFteMethod;
  annualFteSaving: boolean;
  onAnnualFteMethodChange: (method: AnnualFteMethod) => void | Promise<void>;
  baseHoursInput: string;
  careSettings: CareSettings;
  onBaseHoursInputChange: (value: string) => void;
  onSaveBaseHours: () => void | Promise<void>;
  onCareSettingsChange: (next: Partial<CareSettings>) => void | Promise<void>;
};

const SettingsGeneral = ({
  annualFteMethod,
  annualFteSaving,
  onAnnualFteMethodChange,
  baseHoursInput,
  careSettings,
  onBaseHoursInputChange,
  onSaveBaseHours,
  onCareSettingsChange,
}: SettingsGeneralProps) => (
  <div className="cd-page cd-narrow">
    <header>
      <h1 className="cd-h1" style={{ marginTop: 0 }}>
        Allgemein
      </h1>
    </header>

    <div className="field">
      <label htmlFor="base-hours">Bezugswochenstunden für anteilige VZÄ</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          id="base-hours"
          className="input"
          type="number"
          min={1}
          max={168}
          style={{ width: 110 }}
          value={baseHoursInput}
          onChange={(event) => onBaseHoursInputChange(event.target.value)}
          onBlur={() => void onSaveBaseHours()}
        />
        <span className="cd-muted-13">
          Betriebliche Regel: ab 36 Wochenstunden immer 1,0 VZÄ. Darunter Wochenstunden /
          Bezugswert, höchstens 1,0. Gespeicherte historische Werte bleiben erhalten.
        </span>
      </div>
    </div>

    <div className="field">
      <label htmlFor="annual-fte-method">Berechnung der Jahres-VZÄ</label>
      <select
        id="annual-fte-method"
        className="input"
        value={annualFteMethod}
        disabled={annualFteSaving}
        aria-describedby="annual-fte-help"
        onChange={(event) => void onAnnualFteMethodChange(event.target.value as AnnualFteMethod)}
      >
        <option value="month-end-average">{annualFteLabel('month-end-average')} (Standard)</option>
        <option value="year-average">{annualFteLabel('year-average')}</option>
      </select>
      <p id="annual-fte-help" className="cd-muted-13" style={{ margin: '8px 0 0' }}>
        {annualFteMethod === 'month-end-average'
          ? 'Summe der gültigen Stellenanteile an den zwölf Monatsenden, geteilt durch zwölf.'
          : 'Stellenanteile nach ihren gültigen Kalendertagen gewichtet, geteilt durch die Tage des Jahres.'}
        {' '}Gilt für Dashboard, Jahrestabelle und deren Exporte sowie als Vorauswahl im Jahresnachweis.
        {' '}Die Einstellung wird für diesen Datenbestand gespeichert. Eine gesonderte SGB-XI-Aufteilung ist nicht enthalten.
      </p>
      {annualFteSaving && <p role="status" className="cd-muted-13">Wird gespeichert …</p>}
    </div>

    <div className="field">
      <label>Pflegevisiten-Intervall</label>
      <Segmented
        ariaLabel="Pflegevisiten-Intervall"
        options={[
          { value: 30, label: '30 Tage' },
          { value: 90, label: '90 Tage' },
          { value: 180, label: '180 Tage' },
        ]}
        value={careSettings.visitIntervalDays}
        onChange={(visitIntervalDays) => void onCareSettingsChange({ visitIntervalDays })}
      />
      <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
        Die QPR schreibt kein Intervall vor — die App misst gegen den hier gewählten Wert.
      </p>
    </div>

    <div className="field">
      <label>Einweisungen erinnern</label>
      <Segmented
        ariaLabel="Erinnerung an Einweisungen"
        options={[
          { value: 14, label: '14 Tage' },
          { value: 30, label: '30 Tage' },
          { value: 60, label: '60 Tage' },
        ]}
        value={careSettings.instructionReminderDays}
        onChange={(instructionReminderDays) =>
          void onCareSettingsChange({ instructionReminderDays })
        }
      />
      <p className="cd-muted-13" style={{ margin: '8px 0 0' }}>
        Ab wann eine fällige Einweisung in „Heute zu tun“ erscheint.
      </p>
    </div>
  </div>
);

export default SettingsGeneral;
