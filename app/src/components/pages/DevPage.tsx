import React, { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import api from '../../services/api';

type TableData = Record<string, Record<string, unknown>[]>;

const DevPage = () => {
  const [tables, setTables] = useState<TableData | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dev.getTables();
      setTables(data);
      // Erste Tabelle als aktiv setzen, falls noch keine ausgewählt
      const tableNames = Object.keys(data);
      if (tableNames.length > 0 && !activeTable) {
        // Bevorzuge 'employees' falls vorhanden
        setActiveTable(tableNames.includes('employees') ? 'employees' : tableNames[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [activeTable]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const tableNames = tables ? Object.keys(tables).sort() : [];
  const currentData = activeTable && tables?.[activeTable] ? tables[activeTable] : [];
  const columns = currentData.length > 0 ? Object.keys(currentData[0]) : [];

  return (
    <div className="stack">
      <div className="card">
        <div className="form-header">
          <div>
            <p className="eyebrow">Entwickler</p>
            <h3>Rohe Datenbank-Tabellen</h3>
          </div>
          <button className="ghost-button" onClick={loadTables} disabled={loading}>
            <FontAwesomeIcon icon={faSync} spin={loading} /> Aktualisieren
          </button>
        </div>

        {error && <div className="toast error-toast">{error}</div>}

        <div className="dev-tabs">
          {tableNames.map((name) => (
            <button
              key={name}
              className={`ghost-button ${activeTable === name ? 'active' : ''}`}
              onClick={() => setActiveTable(name)}
            >
              {name}
              <span className="badge-count">{tables?.[name]?.length ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper dev-table">
          {currentData.length === 0 ? (
            <p className="empty">Keine Daten in dieser Tabelle.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col}>
                        <code>{formatCell(row[col])}</code>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const formatCell = (value: unknown): string => {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export default DevPage;
