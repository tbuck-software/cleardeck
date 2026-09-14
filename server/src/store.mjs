import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword, verifyPassword } from './passwords.mjs';
import {
  applyChanges,
  canonicalJson,
  createState,
  digestTransaction,
  isUuid,
  SyncValidationError,
  validateTransactionPayload,
} from './syncValidator.mjs';

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const MAX_DEVICE_SLOT = 1_000_000;
const MAX_SYNC_CHANGES = 10_000;
const MAX_SYNC_BODY = 32 * 1024 * 1024;
const MAX_SYNC_PAGE_BYTES = MAX_SYNC_BODY - 64 * 1024;
const MAX_SYNC_PAGE_RECORDS = MAX_SYNC_CHANGES;
const canWrite = (role) => role === 'editor' || role === 'admin';

export class SyncApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'SyncApiError';
    this.status = status;
    this.details = details;
  }
}

export const legacyWorkspaceError = () => new SyncApiError(
  409,
  'Dieser Arbeitsbereich ist ein verschlüsselter v1-Datenbestand. Bitte exportieren und in einem neuen v2-Arbeitsbereich importieren; der bestehende Datenbestand bleibt unverändert.',
);

const accountError = () => new SyncApiError(401, 'Sitzung abgelaufen. Bitte erneut anmelden.');
const readerError = () => new SyncApiError(403, 'Dieses Konto darf nur lesen.');
const instanceError = (instanceId) => new SyncApiError(
  409,
  'Die Serverinstanz hat sich geändert. Bitte neu verbinden und den Datenbestand neu einlesen.',
  { instanceId },
);

const parseJsonb = (value) => {
  if (value === null || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

/** One installation owns one shared, encrypted workspace. */
export async function openStore(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL fehlt.');
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS workspace (
          singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
          instance_id uuid NOT NULL,
          revision integer NOT NULL DEFAULT 0,
          payload bytea,
          updated_at timestamptz NOT NULL DEFAULT now(),
          initialized boolean NOT NULL DEFAULT false,
          sync_revision bigint NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS accounts (
          username text PRIMARY KEY,
          password_hash text NOT NULL,
          role text NOT NULL CHECK (role IN ('reader', 'editor', 'admin')),
          enabled boolean NOT NULL DEFAULT true
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash text PRIMARY KEY,
          username text NOT NULL REFERENCES accounts(username) ON DELETE CASCADE,
          expires_at timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS changes (
          revision integer PRIMARY KEY,
          username text NOT NULL,
          changed_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      // Existing v1 databases have the narrower inline role check. Replace
      // every role check before account creation can accept an administrator.
      await client.query(`
        DO $$
        DECLARE constraint_name text;
        BEGIN
          FOR constraint_name IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'accounts'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%role%'
          LOOP
            EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT %I', constraint_name);
          END LOOP;
        END $$;
        ALTER TABLE accounts
          ADD CONSTRAINT accounts_role_check CHECK (role IN ('reader', 'editor', 'admin'));
      `);
      // The v1 tables predate protocol 2.  These additive changes deliberately
      // preserve the encrypted payload and its revision history.
      await client.query('ALTER TABLE workspace ADD COLUMN IF NOT EXISTS initialized boolean NOT NULL DEFAULT false');
      await client.query('ALTER TABLE workspace ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 0');
      await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS protocol integer NOT NULL DEFAULT 1');
      await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id uuid');
      await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_slot integer');
      await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS instance_id uuid');
      await client.query(`
        CREATE TABLE IF NOT EXISTS sync_devices (
          device_id uuid PRIMARY KEY,
          username text NOT NULL REFERENCES accounts(username) ON DELETE RESTRICT,
          device_slot integer NOT NULL UNIQUE CHECK (device_slot >= 1 AND device_slot <= ${MAX_DEVICE_SLOT}),
          created_at timestamptz NOT NULL DEFAULT now(),
          last_seen_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS sync_records (
          table_name text NOT NULL,
          record_key text NOT NULL,
          row_data jsonb,
          version bigint NOT NULL CHECK (version >= 1),
          updated_by text NOT NULL REFERENCES accounts(username) ON DELETE RESTRICT,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (table_name, record_key)
        );
        CREATE TABLE IF NOT EXISTS sync_changes (
          revision bigint NOT NULL,
          sequence integer NOT NULL CHECK (sequence >= 0),
          table_name text NOT NULL,
          record_key text NOT NULL,
          row_data jsonb,
          version bigint NOT NULL CHECK (version >= 1),
          username text NOT NULL REFERENCES accounts(username) ON DELETE RESTRICT,
          transaction_id uuid NOT NULL,
          changed_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (revision, sequence)
        );
        CREATE INDEX IF NOT EXISTS idx_sync_changes_revision ON sync_changes(revision, sequence);
        CREATE INDEX IF NOT EXISTS idx_sync_records_table ON sync_records(table_name, record_key);
        CREATE TABLE IF NOT EXISTS sync_receipts (
          username text NOT NULL REFERENCES accounts(username) ON DELETE RESTRICT,
          transaction_id uuid NOT NULL,
          digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
          instance_id uuid NOT NULL,
          cursor bigint NOT NULL CHECK (cursor >= 0),
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (username, transaction_id)
        );
      `);
      await client.query('INSERT INTO workspace (instance_id) VALUES ($1) ON CONFLICT DO NOTHING', [randomUUID()]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }
  const dummyPassword = await hashPassword(randomBytes(32).toString('hex'));
  const metadata = async () => {
    const { rows } = await pool.query('SELECT instance_id AS "instanceId", revision FROM workspace');
    if (!rows[0]) throw new Error('Der Arbeitsbereich ist nicht eingerichtet.');
    return rows[0];
  };
  return {
    async setAccount(username, password, role) {
      if (typeof username !== 'string' || !/^[a-zA-Z0-9@._+-]{1,120}$/.test(username) || !['reader', 'editor', 'admin'].includes(role)) {
        throw new Error('Ungültiger Benutzername oder Rolle.');
      }
      const hash = await hashPassword(password);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO accounts (username, password_hash, role) VALUES ($1,$2,$3)
          ON CONFLICT (username) DO UPDATE SET password_hash=$2, role=$3, enabled=true`, [username, hash, role]);
        await client.query('DELETE FROM sessions WHERE username=$1', [username]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
      finally { client.release(); }
    },
    async disableAccount(username) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('UPDATE accounts SET enabled=false WHERE username=$1 RETURNING username', [username]);
        await client.query('DELETE FROM sessions WHERE username=$1', [username]);
        await client.query('COMMIT');
        return result.rowCount > 0;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async login(username, password) {
      const client = await pool.connect();
      let session = null;
      try {
        await client.query('BEGIN');
        // Lock the account while checking its password. This closes the race
        // where a password change could commit and then an old-password login
        // insert a fresh session after the revocation DELETE.
        const { rows } = await client.query('SELECT * FROM accounts WHERE username=$1 AND enabled FOR UPDATE', [username]);
        const valid = await verifyPassword(password, rows[0]?.password_hash ?? dummyPassword);
        if (!valid || !rows.length) {
          await client.query('ROLLBACK');
          return null;
        }
        const token = randomBytes(32).toString('base64url');
        await client.query('DELETE FROM sessions WHERE expires_at <= now()');
        await client.query("INSERT INTO sessions (token_hash, username, expires_at, protocol) VALUES ($1,$2,now() + interval '8 hours',1)", [tokenHash(token), username]);
        await client.query('COMMIT');
        session = { token, role: rows[0].role };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return session ? { ...session, ...(await metadata()) } : null;
    },
    async authenticate(token) {
      const { rows } = await pool.query(`SELECT a.username, a.role, s.protocol,
        s.device_id AS "deviceId", s.device_slot AS "deviceSlot", s.instance_id AS "instanceId"
        FROM sessions s JOIN accounts a USING (username)
        WHERE s.token_hash=$1 AND s.expires_at>now() AND a.enabled`, [tokenHash(token)]);
      return rows[0] ?? null;
    },
    async logout(token) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const session = await client.query('SELECT username FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
        if (session.rows[0]) {
          // Keep the lock order identical to write(), setAccount(), and
          // disableAccount() so logout cannot race a write into a live token.
          await client.query('SELECT username FROM accounts WHERE username=$1 FOR UPDATE', [session.rows[0].username]);
          await client.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    metadata,
    async read() {
      const { rows } = await pool.query('SELECT instance_id AS "instanceId", revision, payload, initialized FROM workspace');
      if (rows[0]?.initialized) throw legacyWorkspaceError();
      return rows[0];
    },
    async write(revision, payload, username, instanceId, token) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Account lock serializes revocation/password changes with writes.
        const account = await client.query('SELECT role FROM accounts WHERE username=$1 AND enabled FOR UPDATE', [username]);
        if (!canWrite(account.rows[0]?.role)) { await client.query('ROLLBACK'); return { forbidden: true }; }
        if (token !== undefined) {
          const session = await client.query(`SELECT token_hash FROM sessions
            WHERE token_hash=$1 AND username=$2 AND protocol=1 AND expires_at>now() FOR UPDATE`, [tokenHash(token), username]);
          if (!session.rowCount) { await client.query('ROLLBACK'); return { forbidden: true }; }
        }
        // Lock the workspace and include its current instance in the CAS. A
        // restore can reuse a revision number, so revision alone cannot fence
        // a request that started before the restore.
        const workspace = await client.query('SELECT instance_id AS "instanceId", initialized, payload, revision FROM workspace FOR UPDATE');
        const currentInstance = workspace.rows[0]?.instanceId;
        if (workspace.rows[0]?.initialized) {
          await client.query('ROLLBACK');
          return { protocol2: true };
        }
        if (workspace.rows[0]?.payload === null && Number(workspace.rows[0]?.revision) === 0 && account.rows[0].role !== 'admin') {
          await client.query('ROLLBACK');
          return { forbidden: true, bootstrap: true };
        }
        if (!currentInstance || (instanceId !== undefined && instanceId !== currentInstance)) {
          await client.query('ROLLBACK');
          return null;
        }
        const result = await client.query(`UPDATE workspace SET payload=$1, revision=revision+1, updated_at=now()
          WHERE revision=$2 AND instance_id=$3 RETURNING revision`, [payload, revision, currentInstance]);
        if (!result.rowCount) { await client.query('ROLLBACK'); return null; }
        const next = result.rows[0].revision;
        await client.query('INSERT INTO changes (revision, username) VALUES ($1,$2)', [next, username]);
        await client.query('COMMIT');
        return { revision: next };
      } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
      finally { client.release(); }
    },
    async loginV2(username, password, deviceId) {
      if (!isUuid(deviceId)) throw new SyncValidationError('Die Geräte-ID ist ungültig.');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: accounts } = await client.query(
          'SELECT username, role, password_hash FROM accounts WHERE username=$1 AND enabled FOR UPDATE',
          [username],
        );
        const valid = await verifyPassword(password, accounts[0]?.password_hash ?? dummyPassword);
        if (!valid || !accounts.length) {
          await client.query('ROLLBACK');
          return null;
        }
        const workspaceResult = await client.query(
          'SELECT instance_id AS "instanceId", payload, initialized, sync_revision AS "syncRevision" FROM workspace FOR UPDATE',
        );
        const workspace = workspaceResult.rows[0];
        if (!workspace) throw new Error('Der Arbeitsbereich ist nicht eingerichtet.');
        if (workspace.payload !== null) {
          await client.query('ROLLBACK');
          throw legacyWorkspaceError();
        }
        const existing = await client.query(
          'SELECT username, device_slot AS "deviceSlot" FROM sync_devices WHERE device_id=$1 FOR UPDATE',
          [deviceId],
        );
        let deviceSlot;
        if (existing.rows[0]) {
          if (existing.rows[0].username !== username) {
            await client.query('ROLLBACK');
            throw new SyncApiError(409, 'Diese Geräte-ID ist bereits einem anderen Konto zugeordnet.');
          }
          deviceSlot = Number(existing.rows[0].deviceSlot);
          await client.query('UPDATE sync_devices SET last_seen_at=now() WHERE device_id=$1', [deviceId]);
        } else {
          const nextSlotResult = await client.query('SELECT COALESCE(MAX(device_slot), 0) + 1 AS "nextSlot" FROM sync_devices');
          deviceSlot = Number(nextSlotResult.rows[0].nextSlot);
          if (!Number.isSafeInteger(deviceSlot) || deviceSlot < 1 || deviceSlot > MAX_DEVICE_SLOT) {
            await client.query('ROLLBACK');
            throw new SyncApiError(503, 'Es können keine weiteren Gerätebereiche vergeben werden.');
          }
          await client.query(
            'INSERT INTO sync_devices (device_id, username, device_slot) VALUES ($1,$2,$3)',
            [deviceId, username, deviceSlot],
          );
        }
        const token = randomBytes(32).toString('base64url');
        await client.query('DELETE FROM sessions WHERE expires_at <= now()');
        await client.query(
          `INSERT INTO sessions (token_hash, username, expires_at, protocol, device_id, device_slot, instance_id)
           VALUES ($1,$2,now() + interval '8 hours',2,$3,$4,$5)`,
          [tokenHash(token), username, deviceId, deviceSlot, workspace.instanceId],
        );
        await client.query('COMMIT');
        return {
          token,
          role: accounts[0].role,
          instanceId: workspace.instanceId,
          deviceSlot,
          revision: Number(workspace.syncRevision),
          protocol: 2,
        };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async changesV2(token, since = 0, limit = 1000) {
      if (!Number.isSafeInteger(since) || since < 0) throw new SyncValidationError('since muss eine nichtnegative ganze Zahl sein.');
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SYNC_CHANGES) throw new SyncValidationError('limit liegt außerhalb des zulässigen Bereichs.');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const accountResult = await client.query(
          'SELECT username, role FROM accounts WHERE username=(SELECT username FROM sessions WHERE token_hash=$1) AND enabled FOR UPDATE',
          [tokenHash(token)],
        );
        if (!accountResult.rows[0]) { await client.query('ROLLBACK'); throw accountError(); }
        const sessionResult = await client.query(
          `SELECT username, protocol, instance_id AS "sessionInstance"
           FROM sessions WHERE token_hash=$1 AND username=$2 AND expires_at>now() FOR UPDATE`,
          [tokenHash(token), accountResult.rows[0].username],
        );
        if (!sessionResult.rows[0] || sessionResult.rows[0].protocol !== 2) { await client.query('ROLLBACK'); throw accountError(); }
        const workspaceResult = await client.query(
          'SELECT instance_id AS "instanceId", payload, initialized, sync_revision AS "syncRevision" FROM workspace FOR UPDATE',
        );
        const workspace = workspaceResult.rows[0];
        if (!workspace) throw new Error('Der Arbeitsbereich ist nicht eingerichtet.');
        if (workspace.payload !== null) { await client.query('ROLLBACK'); throw legacyWorkspaceError(); }
        if (sessionResult.rows[0].sessionInstance !== workspace.instanceId) {
          await client.query('ROLLBACK');
          throw instanceError(workspace.instanceId);
        }
        const currentRevision = Number(workspace.syncRevision);
        if (!Number.isSafeInteger(currentRevision)) throw new Error('Der Synchronisationszeiger ist zu groß.');
        if (since > currentRevision) {
          await client.query('ROLLBACK');
          throw new SyncValidationError('Der Synchronisationszeiger liegt hinter dem aktuellen Serverbestand.');
        }
        if (!workspace.initialized) {
          await client.query('COMMIT');
          return { instanceId: workspace.instanceId, cursor: currentRevision, initialized: false, changes: [], hasMore: false };
        }
        // since is a revision cursor.  Include every row from a revision so a
        // response never splits an atomic transaction across pages.  Aggregate
        // the textual JSON sizes first so a long history cannot be loaded into
        // Node before the page cap is applied.
        const revisions = await client.query(
          `SELECT revision, COUNT(*)::int AS "recordCount",
             COALESCE(SUM(length(COALESCE(row_data::text, 'null')) + length(table_name) + length(record_key) + 128), 0) AS "estimatedBytes"
           FROM sync_changes WHERE revision>$1
           GROUP BY revision ORDER BY revision LIMIT $2`,
          [since, limit + 1],
        );
        const candidateRevisionValues = revisions.rows.map((row) => row.revision);
        const candidateMore = candidateRevisionValues.length > limit;
        const revisionRows = revisions.rows.slice(0, limit);
        const revisionValues = revisionRows.map((row) => row.revision);
        let changes = [];
        let cursor = currentRevision;
        let hasMore = false;
        if (revisionValues.length) {
          const selectedRevisionValues = [];
          let estimatedBytes = 0;
          let estimatedRecords = 0;
          for (const revision of revisionRows) {
            const recordCount = Number(revision.recordCount);
            const groupBytes = Number(revision.estimatedBytes);
            if (!Number.isSafeInteger(recordCount) || recordCount < 1 ||
                !Number.isSafeInteger(groupBytes) || groupBytes < 0) {
              throw new Error('Ungültige Größenangabe im Synchronisierungsprotokoll.');
            }
            const projectedRecords = estimatedRecords + recordCount;
            const projectedBytes = estimatedBytes + groupBytes;
            if (selectedRevisionValues.length &&
                (projectedRecords > MAX_SYNC_PAGE_RECORDS || projectedBytes > MAX_SYNC_PAGE_BYTES)) break;
            if (!selectedRevisionValues.length &&
                (recordCount > MAX_SYNC_PAGE_RECORDS || groupBytes > MAX_SYNC_PAGE_BYTES)) {
              throw new SyncApiError(413, 'Die Synchronisierungsseite ist zu groß.');
            }
            selectedRevisionValues.push(revision.revision);
            estimatedRecords = projectedRecords;
            estimatedBytes = projectedBytes;
          }
          const result = await client.query(
            `SELECT table_name AS "table", record_key AS key, row_data AS row, version, revision, sequence
             FROM sync_changes WHERE revision = ANY($1::bigint[]) ORDER BY revision, sequence`,
            [selectedRevisionValues],
          );
          const allChanges = result.rows.map((row) => ({
            table: row.table,
            key: row.key,
            row: parseJsonb(row.row),
            version: Number(row.version),
            revision: String(row.revision),
          }));
          const grouped = new Map();
          for (const change of allChanges) {
            const group = grouped.get(change.revision) ?? [];
            group.push(change);
            grouped.set(change.revision, group);
          }
          const selected = [];
          let selectedBytes = 0;
          let selectedRecords = 0;
          const encodedChange = (change) => JSON.stringify({
            table: change.table,
            key: change.key,
            row: change.row,
            version: change.version,
          });
          const responseEnvelopeBytes = (revision) => Buffer.byteLength(JSON.stringify({
            instanceId: workspace.instanceId,
            cursor: Number(revision),
            initialized: true,
            changes: [],
            hasMore: false,
          })) - 2;
          for (const revision of selectedRevisionValues.map(String)) {
            const group = grouped.get(revision) ?? [];
            const groupBytes = group.reduce((total, change) => total + Buffer.byteLength(encodedChange(change)), 0) + Math.max(0, group.length - 1);
            const projectedRecords = selectedRecords + group.length;
            const projectedBytes = selectedBytes + (selectedRecords ? 1 : 0) + groupBytes;
            const projectedResponseBytes = responseEnvelopeBytes(revision) + projectedBytes;
            if (selected.length &&
                (projectedRecords > MAX_SYNC_PAGE_RECORDS || projectedResponseBytes > MAX_SYNC_PAGE_BYTES)) break;
            if (!selected.length &&
                (group.length > MAX_SYNC_PAGE_RECORDS || projectedResponseBytes > MAX_SYNC_PAGE_BYTES)) {
              throw new SyncApiError(413, 'Die Synchronisierungsseite ist zu groß.');
            }
            selected.push(...group);
            selectedRecords = projectedRecords;
            selectedBytes = projectedBytes;
          }
          changes = selected.map(({ revision: _revision, ...change }) => change);
          if (selected.length) cursor = Number(selected.at(-1).revision);
          const selectedRevisionCount = new Set(selected.map((change) => change.revision)).size;
          hasMore = candidateMore || selectedRevisionCount < revisionValues.length;
        }
        await client.query('COMMIT');
        return { instanceId: workspace.instanceId, cursor, initialized: true, changes, hasMore };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async transactionV2(token, input) {
      let serializedInput;
      try { serializedInput = JSON.stringify(input); } catch { throw new SyncValidationError('Die Transaktion enthält ungültige JSON-Daten.'); }
      if (Buffer.byteLength(serializedInput ?? '', 'utf8') > MAX_SYNC_BODY) throw new SyncApiError(413, 'Anfrage zu groß.');
      const digest = digestTransaction(input);
      // Validation happens before acquiring locks.  It is repeated against
      // the current state below for the per-record CAS and relationship rules.
      const transaction = validateTransactionPayload(input, { maxChanges: MAX_SYNC_CHANGES });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const accountResult = await client.query(
          'SELECT username, role FROM accounts WHERE username=(SELECT username FROM sessions WHERE token_hash=$1) AND enabled FOR UPDATE',
          [tokenHash(token)],
        );
        if (!accountResult.rows[0]) { await client.query('ROLLBACK'); throw accountError(); }
        const username = accountResult.rows[0].username;
        if (!canWrite(accountResult.rows[0].role)) { await client.query('ROLLBACK'); throw readerError(); }
        const sessionResult = await client.query(
          `SELECT protocol, instance_id AS "sessionInstance"
           FROM sessions WHERE token_hash=$1 AND username=$2 AND expires_at>now() FOR UPDATE`,
          [tokenHash(token), username],
        );
        if (!sessionResult.rows[0] || sessionResult.rows[0].protocol !== 2) { await client.query('ROLLBACK'); throw accountError(); }
        const workspaceResult = await client.query(
          `SELECT instance_id AS "instanceId", payload, initialized,
                  sync_revision AS "syncRevision"
           FROM workspace FOR UPDATE`,
        );
        const workspace = workspaceResult.rows[0];
        if (!workspace) throw new Error('Der Arbeitsbereich ist nicht eingerichtet.');
        if (workspace.payload !== null) { await client.query('ROLLBACK'); throw legacyWorkspaceError(); }
        if (sessionResult.rows[0].sessionInstance !== workspace.instanceId || transaction.instanceId !== workspace.instanceId) {
          await client.query('ROLLBACK');
          throw instanceError(workspace.instanceId);
        }
        if (transaction.initialize && accountResult.rows[0].role !== 'admin') {
          await client.query('ROLLBACK');
          throw new SyncApiError(403, 'Nur ein Administratorkonto darf den Arbeitsbereich initialisieren.');
        }
        const receiptResult = await client.query(
          `SELECT digest, cursor FROM sync_receipts
           WHERE username=$1 AND transaction_id=$2 FOR UPDATE`,
          [username, transaction.id],
        );
        if (receiptResult.rows[0]) {
          if (receiptResult.rows[0].digest !== digest) {
            await client.query('ROLLBACK');
            throw new SyncApiError(409, 'Diese Transaktions-ID wurde bereits mit einem anderen Inhalt verwendet.');
          }
          const cursor = Number(receiptResult.rows[0].cursor);
          await client.query('COMMIT');
          return { cursor };
        }
        const currentRowsResult = await client.query(
          `SELECT table_name AS "tableName", record_key AS key, row_data AS "rowData", version
           FROM sync_records WHERE row_data IS NOT NULL`,
        );
        const state = createState(currentRowsResult.rows.map((row) => ({
          tableName: row.tableName,
          key: row.key,
          rowData: parseJsonb(row.rowData),
          version: Number(row.version),
        })));
        if (transaction.initialize) {
          if (workspace.initialized || Number(workspace.syncRevision) !== 0 || currentRowsResult.rowCount > 0) {
            await client.query('ROLLBACK');
            throw new SyncApiError(409, 'Der Arbeitsbereich ist bereits initialisiert.');
          }
          if (transaction.changes.some((change) => change.before !== null)) {
            await client.query('ROLLBACK');
            throw new SyncApiError(409, 'Die Initialisierung darf nur neue Datensätze enthalten.');
          }
        } else if (!workspace.initialized) {
          await client.query('ROLLBACK');
          throw new SyncApiError(409, 'Der Arbeitsbereich muss zuerst initialisiert werden.');
        }
        let applied;
        try {
          applied = applyChanges(state, transaction.changes).applied;
        } catch (error) {
          await client.query('ROLLBACK');
          if (error instanceof SyncValidationError && error.details?.conflict) {
            throw new SyncApiError(409, error.message, error.details);
          }
          throw error;
        }
        const actualChanges = applied.filter((change) => canonicalJson(change.before) !== canonicalJson(change.after));
        const currentRevision = Number(workspace.syncRevision);
        if (!Number.isSafeInteger(currentRevision)) throw new Error('Der Synchronisationszeiger ist zu groß.');
        const nextRevision = actualChanges.length || transaction.initialize ? currentRevision + 1 : currentRevision;
        if (nextRevision > Number.MAX_SAFE_INTEGER) throw new Error('Der Synchronisationszeiger ist zu groß.');
        let sequence = 0;
        for (const change of actualChanges) {
          const rowValue = change.after === null ? null : JSON.stringify(change.after);
          await client.query(
            `INSERT INTO sync_records (table_name, record_key, row_data, version, updated_by)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (table_name, record_key) DO UPDATE SET row_data=EXCLUDED.row_data,
               version=EXCLUDED.version, updated_by=EXCLUDED.updated_by, updated_at=now()`,
            [change.table, change.key, rowValue, nextRevision, username],
          );
          await client.query(
            `INSERT INTO sync_changes (revision, sequence, table_name, record_key, row_data, version, username, transaction_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [nextRevision, sequence++, change.table, change.key, rowValue, nextRevision, username, transaction.id],
          );
        }
        if (actualChanges.length || transaction.initialize) {
          await client.query(
            'UPDATE workspace SET initialized=$1, sync_revision=$2, updated_at=now() WHERE singleton=true',
            [workspace.initialized || transaction.initialize, nextRevision],
          );
        }
        await client.query(
          `INSERT INTO sync_receipts (username, transaction_id, digest, instance_id, cursor)
           VALUES ($1,$2,$3,$4,$5)`,
          [username, transaction.id, digest, workspace.instanceId, nextRevision],
        );
        await client.query('COMMIT');
        return { cursor: nextRevision };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async logoutV2(token) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const sessionIdentity = await client.query(
          `SELECT username FROM sessions
           WHERE token_hash=$1 AND protocol=2 AND expires_at>now()`,
          [tokenHash(token)],
        );
        if (!sessionIdentity.rows[0]) { await client.query('ROLLBACK'); throw accountError(); }
        // Match the account -> session lock order used by every v2 read/write
        // and by account administration, so revocation cannot deadlock logout.
        const account = await client.query(
          'SELECT username FROM accounts WHERE username=$1 AND enabled FOR UPDATE',
          [sessionIdentity.rows[0].username],
        );
        if (!account.rows[0]) { await client.query('ROLLBACK'); throw accountError(); }
        const session = await client.query(
          `SELECT username FROM sessions
           WHERE token_hash=$1 AND username=$2 AND protocol=2 AND expires_at>now() FOR UPDATE`,
          [tokenHash(token), account.rows[0].username],
        );
        if (!session.rows[0]) { await client.query('ROLLBACK'); throw accountError(); }
        await client.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
