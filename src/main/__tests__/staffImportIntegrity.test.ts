// @vitest-environment node
import * as XLSX from 'xlsx';
import SqliteAdapter from './sqliteAdapter';
import { runMigrations } from '../database/migrations';
import { parseStaffImport, commitStaffImport } from '../staffImport';
import { getYearDataset } from '../repositories/employees';
const state = vi.hoisted(() => ({
  db: null as unknown,
  backup: vi.fn(() => '/synthetic/safety.cdb'),
}));
vi.mock('electron', () => ({ dialog: {} }));
vi.mock('../database/connection', () => ({ getDb: () => state.db, backupDatabase: state.backup }));
const buffer = (rows: unknown[][]) => {
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(rows), 'Personal');
  return XLSX.write(w, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};
const headers = ['Name', 'Qualifikation', 'Eintritt', 'Austritt', 'Wochenstunden', 'VZÄ'];
describe('reviewed staff intake', () => {
  let db: SqliteAdapter;
  beforeEach(() => {
    db = new SqliteAdapter(':memory:');
    state.db = db;
    runMigrations(db as never);
    state.backup.mockClear();
  });
  afterEach(() => db.close());
  it('reads source structure and calculates an unweighted proposal instead of reusing a weighted Excel value', () => {
    const preview = parseStaffImport(
      buffer([headers, ['Import Test', 'Pflegefachkraft', '01.01.2024', '30.06.2024', 18, 0.25]]),
      'personal.xlsx',
    );
    expect(preview.rows[0]).toMatchObject({
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      fte: '0.5',
      sourceRef: 'personal.xlsx · Personal · Zeile 2',
      selected: true,
    });
    expect(commitStaffImport(preview.rows).imported).toBe(1);
    expect(getYearDataset(2024).employees[0]).toMatchObject({
      fte: 0.5,
      hoursVerified: false,
      sourceRef: 'personal.xlsx · Personal · Zeile 2',
    });
  });
  it('keeps ambiguous dates for review and rejects invalid selected rows before writing', () => {
    const preview = parseStaffImport(
      buffer([headers, ['Offen Test', 'Pflegefachkraft', 'etwa März 2024', '', 36, '']]),
      'personal.xlsx',
    );
    expect(preview.rows[0].startDate).toBe('etwa März 2024');
    expect(preview.rows[0].selected).toBe(false);
    preview.rows[0].selected = true;
    expect(() => commitStaffImport(preview.rows)).toThrow(/Beginn/);
    expect(state.backup).not.toHaveBeenCalled();
    expect(getYearDataset(2024).employees).toHaveLength(0);
  });
  it('does not merge duplicate names and rolls back conflicting selected periods together', () => {
    const preview = parseStaffImport(
      buffer([headers, ['Doppel Test', 'Pflegefachkraft', '2024-01-01', '2024-12-31', 36, '']]),
      'personal.xlsx',
    );
    commitStaffImport(preview.rows);
    expect(() => commitStaffImport(preview.rows)).toThrow(/zuordnen/);
    const id = getYearDataset(2024).employees[0].id!;
    const first = {
      ...preview.rows[0],
      employeeId: id,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    };
    const conflict = { ...first, startDate: '2025-06-01' };
    expect(() => commitStaffImport([first, conflict])).toThrow(/überschneiden/);
    expect(getYearDataset(2025).employees).toHaveLength(0);
  });
});
