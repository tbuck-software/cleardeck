import Checkbox from '../ui/Checkbox';
import BirthDateInput from '../ui/BirthDateInput';
import FieldHelp from '../ui/FieldHelp';
import React from 'react';
import { validDate } from '../../utils/calendarDate';
import Dialog from '../ui/Dialog';
import type { StaffImportPreview, StaffImportRow } from '../../shared/staffImport';
import type { EmployeeWithPeriod } from '../../shared/types';

type Props = {
  preview: StaffImportPreview | null;
  employees: EmployeeWithPeriod[];
  busy: boolean;
  onChange: (value: StaffImportPreview) => void;
  onClose: () => void;
  onSave: () => void;
};
export default function StaffImportModal({
  preview,
  employees,
  busy,
  onChange,
  onClose,
  onSave,
}: Props) {
  if (!preview) return null;
  const change = (i: number, patch: Partial<StaffImportRow>) =>
    onChange({
      ...preview,
      rows: preview.rows.map((row, index) => (index === i ? { ...row, ...patch } : row)),
    });
  const count = preview.rows.filter((row) => row.selected).length;
  return (
    <Dialog
      open
      width={1080}
      title="Mitarbeiterliste prüfen"
      subtitle={preview.source}
      primaryLabel={`${count} Zeilen übernehmen`}
      primaryDisabled={busy || !count}
      onPrimary={onSave}
      onClose={onClose}
    >
      <FieldHelp title="Hinweise zur Übernahme">
        Übernommen werden nur ausgewählte Zeilen. Gleiche Namen werden nicht automatisch
        zusammengeführt. Der Stellenanteil wird zunächst aus Wochenstunden mit der Vorlagenregel bis
        36 Stunden / 36 vorgeschlagen; bereits taggewichtete Excel-VZÄ werden nicht erneut
        gewichtet. Zeiträume, Qualifikation und vorgeschlagene Werte bitte prüfen. Vor der Übernahme
        wird gesichert. Überschneidungen werden abgewiesen; ein Fehler verwirft die gesamte Auswahl.
        Belege anschließend je Zeitraum bestätigen.
      </FieldHelp>
      <div className="cd-table-wrap cd-import-table">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Übernehmen</th>
              <th>Person / Zuordnung</th>
              <th>Qualifikation</th>
              <th>Beginn / Ende</th>
              <th>Stunden / VZÄ</th>
              <th>Prüfhinweise</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i}>
                <td>
                  <Checkbox
                    aria-label={`Zeile ${row.rowNumber} übernehmen`}
                    checked={row.selected}
                    onChange={(e) => change(i, { selected: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Name Zeile ${row.rowNumber}`}
                    className="input"
                    value={row.name}
                    onChange={(e) => change(i, { name: e.target.value })}
                  />
                  <select
                    aria-label={`Zuordnung Zeile ${row.rowNumber}`}
                    className="input"
                    value={row.employeeId ?? ''}
                    onChange={(e) =>
                      change(i, { employeeId: e.target.value ? Number(e.target.value) : undefined })
                    }
                  >
                    <option value="">Neue Person anlegen</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.birthDate || 'Geburtsdatum fehlt'}
                      </option>
                    ))}
                  </select>
                  {row.birthDate && !validDate(row.birthDate) && (
                    <small>Geburtsdatum aus Datei: {row.birthDate}</small>
                  )}
                  <BirthDateInput
                    id={`import-birth-${i}`}
                    value={row.birthDate}
                    onChange={(birthDate) => change(i, { birthDate })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Qualifikation Zeile ${row.rowNumber}`}
                    className="input"
                    value={row.qualification}
                    onChange={(e) => change(i, { qualification: e.target.value })}
                  />
                </td>
                <td>
                  {row.startDate && !validDate(row.startDate) && (
                    <small>Originalwert: {row.startDate}</small>
                  )}
                  <input
                    aria-label={`Beginn Zeile ${row.rowNumber}`}
                    className="input"
                    type="date"
                    value={row.startDate}
                    onChange={(e) => change(i, { startDate: e.target.value })}
                  />
                  <input
                    aria-label={`Ende Zeile ${row.rowNumber}`}
                    className="input"
                    type="date"
                    value={row.endDate}
                    onChange={(e) => change(i, { endDate: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Wochenstunden Zeile ${row.rowNumber}`}
                    className="input"
                    value={row.weeklyHours}
                    onChange={(e) => change(i, { weeklyHours: e.target.value })}
                  />
                  <input
                    aria-label={`VZÄ Zeile ${row.rowNumber}`}
                    className="input"
                    value={row.fte}
                    onChange={(e) => change(i, { fte: e.target.value })}
                  />
                </td>
                <td style={{ minWidth: 200 }}>
                  {row.issues.length ? row.issues.join('; ') : 'Belege noch prüfen'}
                  <br />
                  <small>{row.sourceRef}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cd-muted-13">
        {preview.rows.length - count} Zeilen nicht ausgewählt · Übernahme zunächst ungeprüft
      </p>
    </Dialog>
  );
}
