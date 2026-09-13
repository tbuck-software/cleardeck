import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword, verifyPassword } from './passwords.mjs';

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

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
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS accounts (
          username text PRIMARY KEY,
          password_hash text NOT NULL,
          role text NOT NULL CHECK (role IN ('reader', 'editor')),
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
      if (typeof username !== 'string' || !/^[a-zA-Z0-9@._+-]{1,120}$/.test(username) || !['reader', 'editor'].includes(role)) {
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
        await client.query("INSERT INTO sessions VALUES ($1,$2,now() + interval '8 hours')", [tokenHash(token), username]);
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
      const { rows } = await pool.query(`SELECT a.username, a.role FROM sessions s JOIN accounts a USING (username)
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
      const { rows } = await pool.query('SELECT instance_id AS "instanceId", revision, payload FROM workspace');
      return rows[0];
    },
    async write(revision, payload, username, instanceId, token) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Account lock serializes revocation/password changes with writes.
        const account = await client.query('SELECT role FROM accounts WHERE username=$1 AND enabled FOR UPDATE', [username]);
        if (account.rows[0]?.role !== 'editor') { await client.query('ROLLBACK'); return { forbidden: true }; }
        if (token !== undefined) {
          const session = await client.query(`SELECT token_hash FROM sessions
            WHERE token_hash=$1 AND username=$2 AND expires_at>now() FOR UPDATE`, [tokenHash(token), username]);
          if (!session.rowCount) { await client.query('ROLLBACK'); return { forbidden: true }; }
        }
        // Lock the workspace and include its current instance in the CAS. A
        // restore can reuse a revision number, so revision alone cannot fence
        // a request that started before the restore.
        const workspace = await client.query('SELECT instance_id AS "instanceId" FROM workspace FOR UPDATE');
        const currentInstance = workspace.rows[0]?.instanceId;
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
    close: () => pool.end(),
  };
}
