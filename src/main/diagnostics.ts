import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { DiagnosticEntry, DiagnosticSnapshot, UpdateStatus } from '../shared/types';

const MAX_RECORDS = 250;
const MAX_BYTES = 256 * 1024;
const states = ['idle', 'checking', 'available', 'not-available', 'downloading', 'downloaded', 'installing'] as const;
const errorCodes = ['signature-resources', 'signature-identity', 'signature', 'asset', 'authorization', 'network', 'storage', 'configuration', 'unknown'] as const;
type ErrorCode = typeof errorCodes[number];
type Record = { at: string; event: 'start' | 'update' | 'error'; version?: string; state?: typeof states[number]; progress?: number; code?: ErrorCode };
let storageError: string | undefined;
let lastFingerprint = '';

const filePath = () => path.join(app.getPath('userData'), 'logs', 'diagnostics.json');
const safeVersion = (value: unknown): string | undefined => {
  if (value === 'dev-demo') return value;
  if (typeof value !== 'string' || value.length > 64) return undefined;
  return /^(\d{1,4}\.\d{1,4}\.\d{1,4})(?:[-+][a-zA-Z0-9.-]+)?$/.exec(value)?.[1];
};

const classifyError = (message: string): ErrorCode => {
  if (/code has no resources|67056/i.test(message)) return 'signature-resources';
  if (/code failed to satisfy|specified code requirement/i.test(message)) return 'signature-identity';
  if (/signature|signatur|code.?sign/i.test(message)) return 'signature';
  if (/cannot find asset|no.*update.*file/i.test(message)) return 'asset';
  if (/401|403|unauthorized|forbidden/i.test(message)) return 'authorization';
  if (/ENOTFOUND|ECONN|ETIMEDOUT|network|net::|offline/i.test(message)) return 'network';
  if (/ENOSPC|EACCES|EPERM/i.test(message)) return 'storage';
  if (/update.?quelle|update.?feed|nicht konfiguriert/i.test(message)) return 'configuration';
  return 'unknown';
};

// Only known fields and values survive. Neither arbitrary log text nor unknown
// JSON properties can reach the UI, even if the file was edited externally.
const validate = (value: unknown): Record | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as { [key: string]: unknown };
  if (typeof item.at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item.at) || !Number.isFinite(Date.parse(item.at))) return null;
  const version = safeVersion(item.version);
  if (item.event === 'start') return { at: item.at, event: 'start', version };
  if (item.event === 'error' && errorCodes.includes(item.code as ErrorCode)) return { at: item.at, event: 'error', code: item.code as ErrorCode, version };
  if (item.event === 'update' && states.includes(item.state as typeof states[number])) {
    const progress = typeof item.progress === 'number' && Number.isInteger(item.progress) && item.progress >= 0 && item.progress <= 100 ? item.progress : undefined;
    return { at: item.at, event: 'update', state: item.state as typeof states[number], version, progress };
  }
  return null;
};

const readRecords = (): Record[] => {
  try {
    if (!fs.existsSync(filePath())) return [];
    if (fs.statSync(filePath()).size > MAX_BYTES) throw new Error('Oversized diagnostics');
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Invalid diagnostics');
    return parsed.slice(-MAX_RECORDS).map(validate).filter((item): item is Record => item !== null);
  } catch {
    storageError = 'Die gespeicherten Diagnoseeinträge konnten nicht gelesen werden.';
    return [];
  }
};

const writeRecord = (record: Record): void => {
  const { at: _at, ...fields } = record;
  void _at;
  const fingerprint = JSON.stringify(fields);
  if (fingerprint === lastFingerprint) return;
  try {
    const records = [...readRecords(), record].slice(-MAX_RECORDS);
    const target = filePath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(`${target}.tmp`, JSON.stringify(records));
    fs.renameSync(`${target}.tmp`, target);
    storageError = undefined;
    lastFingerprint = fingerprint;
  } catch {
    storageError = 'Diagnoseeinträge konnten nicht gespeichert werden.';
  }
};

export const recordAppStart = (): void => writeRecord({ at: new Date().toISOString(), event: 'start', version: safeVersion(app.getVersion()) });

export const recordUpdateStatus = (status: UpdateStatus): void => {
  const common = { at: new Date().toISOString(), version: safeVersion(status.version) };
  if (status.state === 'error') {
    // Store a known error category, never raw error strings, URLs, tokens,
    // response bodies, local file paths or database contents.
    writeRecord({ ...common, event: 'error', code: classifyError(status.message) });
  } else {
    const progress = status.state === 'downloading' && Number.isFinite(status.progress)
      ? Math.floor(Math.max(0, Math.min(100, status.progress ?? 0)) / 25) * 25 : undefined;
    writeRecord({ ...common, event: 'update', state: status.state, progress });
  }
};

const errors: { [key in ErrorCode]: string } = {
  'signature-resources': 'macOS hat die Update-Signatur abgelehnt: Die Ressourcensignatur fehlt oder ist unvollständig (OSStatus -67056).',
  'signature-identity': 'Die Signatur des Updates erfüllt die Signaturanforderung der installierten App nicht.',
  signature: 'Die Signaturprüfung des Updates ist fehlgeschlagen.',
  asset: 'Die in den Update-Metadaten genannte Installationsdatei wurde nicht gefunden.',
  authorization: 'Der Update-Server hat den Zugriff abgelehnt (HTTP 401/403).',
  network: 'Der Update-Server konnte nicht erreicht werden oder die Verbindung wurde unterbrochen.',
  storage: 'Die Update-Dateien konnten nicht geschrieben werden. Speicherplatz oder Dateiberechtigungen prüfen.',
  configuration: 'Die Update-Quelle ist nicht verfügbar oder nicht konfiguriert.',
  unknown: 'Das Update ist mit einem nicht klassifizierten Fehler fehlgeschlagen. Weitere Details stehen in der Update-Anzeige.',
};
const stateMessages: { [key in typeof states[number]]: string } = {
  idle: 'Updater bereit.', checking: 'Update-Prüfung gestartet.', available: 'Update verfügbar.',
  'not-available': 'Kein neueres Update gefunden.', downloading: 'Update wird heruntergeladen.',
  downloaded: 'Download abgeschlossen; wartet auf Installationsklick.', installing: 'Installationsklick empfangen; Installation und Neustart werden vorbereitet.',
};

const format = (record: Record): DiagnosticEntry => ({
  at: record.at,
  level: record.event === 'error' ? 'error' : 'info',
  source: record.event === 'start' ? 'App' : 'Updates',
  message: `${record.event === 'start' ? 'App gestartet.' : record.event === 'error' ? errors[record.code!] : stateMessages[record.state!]}${record.version ? ` Version ${record.version}.` : ''}${record.progress === undefined ? '' : ` ${record.progress} %.`}`,
});

export const readDiagnostics = (): DiagnosticSnapshot => {
  const entries = readRecords().reverse().map(format);
  return { entries, storageError };
};

